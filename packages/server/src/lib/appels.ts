import type { Prisma, PrismaClient, StatutChoix } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { decalerJour, jourISO } from './agenda.ts'
import { BENEVOLES_MAX } from './benevoles.ts'
import { erreurSaisie } from './erreurs.ts'
import { journal } from './journal.ts'
import { empreinte, jetonDe } from './liens.ts'
import { heureLocale, instantDepuisHeureLocale } from './heures.ts'
import { PLACES_MAX } from './programme.ts'
import { i18n } from './langue.ts'

// Appels à bénévoles, candidatures et répartition (ADR 0041).
//
// Un appel ouvre les candidatures sur une partie du programme d'une période. Une
// candidature choisit des séquences et porte des plages de disponibilité.
// L'équipe accepte un choix : la candidate ou le candidat reçoit une fiche
// bénévole et une place à confirmer. Les règles pures de ce module (dates d'un
// appel, plages, adéquation, état d'une place, couverture) se testent sans base.

type Base = PrismaClient | Prisma.TransactionClient

/** Une séquence recherche 200 renforts au plus. */
export const BESOIN_MAX = 200
export const CONSIGNES_MAX = 2000
export const NOM_APPEL_MAX = 120
export const INTRODUCTION_MAX = 2000
/** Une candidature choisit 30 séquences au plus. */
export const CHOIX_MAX = 30
/** Une candidature, ou une fiche pour une période, porte 20 plages au plus. */
export const PLAGES_MAX = 20
export const PRECISIONS_MAX = 600
export const MESSAGE_MAX = 600
/** Un appel compte 500 candidatures en attente au plus. */
export const CANDIDATURES_EN_ATTENTE_MAX = 500
/** Une période compte 20 appels ouverts au plus. */
export const APPELS_OUVERTS_MAX = 20
/** Une place encore à confirmer après sept jours est signalée. */
export const JOURS_AVANT_SIGNAL = 7
/** Une plage dure 24 heures au plus. */
export const PLAGE_DUREE_MAX_MS = 24 * 60 * 60 * 1000
/** La vue « Répartition » découpe la journée en tranches de 30 minutes. */
export const TRANCHE_MS = 30 * 60 * 1000

const JOUR_MS = 24 * 60 * 60 * 1000

export interface Plage {
  debut: Date
  fin: Date
}

/** Le premier et le dernier jour d'une période, au format AAAA-MM-JJ. */
export async function joursDeLaPeriode(
  base: Base,
  editionId: string
): Promise<{ debut: string; fin: string }> {
  const edition = await base.edition.findUniqueOrThrow({
    where: { id: editionId },
    select: { debut: true, fin: true },
  })
  return { debut: jourISO(edition.debut), fin: jourISO(edition.fin) }
}

// ── Besoin et appel ──────────────────────────────────────────────────────────

/** Le besoin d'une séquence : un entier de 1 à BESOIN_MAX, ou rien. Zéro vaut rien. */
export function besoinValide(brut: number | null | undefined): number | null {
  if (brut === null || brut === undefined || brut === 0) return null
  if (!Number.isInteger(brut) || brut < 0 || brut > BESOIN_MAX) {
    throw erreurSaisie(
      i18n._('Le besoin en bénévoles est un nombre entier de 0 à {max}.', {
        max: BESOIN_MAX,
      })
    )
  }
  return brut
}

export type EtatAppel = 'A_VENIR' | 'OUVERT' | 'FERME'

/**
 * L'état d'un appel à un instant. Un appel fermé à la main, ou de portée
 * « séquence » dont la séquence a disparu, est fermé.
 */
export function etatAppel(
  appel: {
    portee: string
    sequenceId: string | null
    ouvertLe: Date
    fermeLe: Date
    fermeManuellementLe: Date | null
  },
  maintenant: Date
): EtatAppel {
  if (appel.fermeManuellementLe !== null) return 'FERME'
  if (appel.portee === 'SEQUENCE' && appel.sequenceId === null) return 'FERME'
  if (maintenant.getTime() >= appel.fermeLe.getTime()) return 'FERME'
  if (maintenant.getTime() < appel.ouvertLe.getTime()) return 'A_VENIR'
  return 'OUVERT'
}

/**
 * Les dates d'un appel : la fermeture suit l'ouverture, et tombe au plus tard à
 * la fin du dernier jour de la période.
 */
export function datesAppelValides(
  ouvertLe: Date,
  fermeLe: Date,
  finPeriode: string,
  fuseau: string
): void {
  if (fermeLe.getTime() <= ouvertLe.getTime()) {
    throw erreurSaisie(i18n._('La fermeture de l’appel suit son ouverture.'))
  }
  const limite = instantDepuisHeureLocale(
    decalerJour(finPeriode, 1),
    '00:00',
    fuseau
  )
  if (fermeLe.getTime() > limite.getTime()) {
    throw erreurSaisie(
      i18n._(
        'L’appel se ferme au plus tard à la fin du dernier jour de la période.'
      )
    )
  }
}

// ── Plages de disponibilité ──────────────────────────────────────────────────

/** Réunit les plages qui se chevauchent ou se touchent, dans l'ordre. */
export function fusionnerPlages(plages: readonly Plage[]): Plage[] {
  const triees = [...plages].sort(
    (x, y) => x.debut.getTime() - y.debut.getTime()
  )
  const fusion: Plage[] = []
  for (const plage of triees) {
    const derniere = fusion.at(-1)
    if (derniere && plage.debut.getTime() <= derniere.fin.getTime()) {
      if (plage.fin.getTime() > derniere.fin.getTime()) {
        derniere.fin = new Date(plage.fin)
      }
    } else {
      fusion.push({ debut: new Date(plage.debut), fin: new Date(plage.fin) })
    }
  }
  return fusion
}

export interface PlageSaisie {
  jour: string
  jourFin?: string | null
  heureDebut: string
  heureFin: string
}

/**
 * Les plages saisies, vérifiées puis réunies. Chacune dure 24 heures au plus,
 * commence et finit un des jours permis : ceux de la période, et ceux des
 * séquences de son programme.
 */
export function plagesValides(
  saisies: readonly PlageSaisie[] | null | undefined,
  jours: readonly string[],
  fuseau: string
): Plage[] {
  const liste = saisies ?? []
  if (liste.length > PLAGES_MAX) {
    throw erreurSaisie(
      i18n._('Une disponibilité compte {max} plages au plus.', {
        max: PLAGES_MAX,
      })
    )
  }
  const plages = liste.map(saisie => {
    const debut = instantDepuisHeureLocale(
      saisie.jour,
      saisie.heureDebut,
      fuseau
    )
    const fin = instantDepuisHeureLocale(
      saisie.jourFin || saisie.jour,
      saisie.heureFin,
      fuseau
    )
    if (fin.getTime() <= debut.getTime()) {
      throw erreurSaisie(i18n._('La fin d’une plage suit son début.'))
    }
    if (fin.getTime() - debut.getTime() > PLAGE_DUREE_MAX_MS) {
      throw erreurSaisie(i18n._('Une plage dure 24 heures au plus.'))
    }
    if (
      !jours.includes(saisie.jour) ||
      !jours.includes(saisie.jourFin || saisie.jour)
    ) {
      throw erreurSaisie(
        i18n._(
          'Une plage tombe dans les jours de la période ou de son programme.'
        )
      )
    }
    return { debut, fin }
  })
  return fusionnerPlages(plages)
}

/**
 * Les jours où une plage peut tomber, dans l'ordre : ceux de la période, et ceux
 * des séquences de son programme (une installation la veille, par exemple).
 */
export function joursDesPlages(
  periode: { debut: string; fin: string },
  sequences: readonly Plage[],
  fuseau: string
): string[] {
  const jours = new Set<string>()
  for (
    let jour = periode.debut;
    jour <= periode.fin;
    jour = decalerJour(jour, 1)
  ) {
    jours.add(jour)
  }
  for (const s of sequences) {
    jours.add(heureLocale(s.debut, fuseau).jour)
    jours.add(heureLocale(s.fin, fuseau).jour)
  }
  return [...jours].sort()
}

export type Adequation = 'TOTALE' | 'PARTIELLE' | 'AUCUNE'

/**
 * Comment des plages couvrent un intervalle : une plage le couvre entièrement,
 * une plage en couvre une partie, ou aucune ne le touche.
 */
export function adequation(plages: readonly Plage[], cible: Plage): Adequation {
  let partielle = false
  for (const plage of fusionnerPlages(plages)) {
    const debut = Math.max(plage.debut.getTime(), cible.debut.getTime())
    const fin = Math.min(plage.fin.getTime(), cible.fin.getTime())
    if (fin <= debut) continue
    if (
      plage.debut.getTime() <= cible.debut.getTime() &&
      plage.fin.getTime() >= cible.fin.getTime()
    ) {
      return 'TOTALE'
    }
    partielle = true
  }
  return partielle ? 'PARTIELLE' : 'AUCUNE'
}

/** Vrai si deux intervalles se chevauchent. */
export function chevauche(x: Plage, y: Plage): boolean {
  return (
    x.debut.getTime() < y.fin.getTime() && y.debut.getTime() < x.fin.getTime()
  )
}

// ── Places ───────────────────────────────────────────────────────────────────

export type EtatPlace = 'CONFIRMEE' | 'A_CONFIRMER' | 'NON_CONFIRMEE'

/**
 * L'état d'une place. Une place à confirmer devient « non confirmée » sept jours
 * après sa création, ou dès la veille de sa séquence si elle arrive avant.
 */
export function etatPlace(
  place: { confirmeeLe: Date | null; createdAt: Date },
  debutSequence: Date,
  maintenant: Date,
  fuseau: string
): EtatPlace {
  if (place.confirmeeLe !== null) return 'CONFIRMEE'
  const septJours = place.createdAt.getTime() + JOURS_AVANT_SIGNAL * JOUR_MS
  const veille = instantDepuisHeureLocale(
    decalerJour(heureLocale(debutSequence, fuseau).jour, -1),
    '00:00',
    fuseau
  ).getTime()
  return maintenant.getTime() >= Math.min(septJours, veille)
    ? 'NON_CONFIRMEE'
    : 'A_CONFIRMER'
}

// ── Couverture ───────────────────────────────────────────────────────────────

export interface SequenceCouverte {
  debut: Date
  fin: Date
  besoin: number | null
  confirmees: number
  aConfirmer: number
}

export interface PersonneDisponible {
  plages: readonly Plage[]
  /** Les séquences où la personne est déjà placée. */
  places: readonly Plage[]
}

export interface Tranche {
  debut: Date
  fin: Date
  besoin: number
  confirmees: number
  aConfirmer: number
  disponibles: number
}

/**
 * La couverture du programme par tranches de 30 minutes, de la première à la
 * dernière tranche qu'une séquence avec un besoin occupe. Chaque tranche additionne
 * les besoins et les places en renfort des séquences qui la touchent. Elle compte
 * les personnes dont une plage la couvre entièrement et qui n'y tiennent aucune
 * place.
 */
export function couverture(
  sequences: readonly SequenceCouverte[],
  disponibles: readonly PersonneDisponible[]
): Tranche[] {
  const avecBesoin = sequences.filter(s => (s.besoin ?? 0) > 0)
  if (avecBesoin.length === 0) return []
  const premiere =
    Math.floor(
      Math.min(...avecBesoin.map(s => s.debut.getTime())) / TRANCHE_MS
    ) * TRANCHE_MS
  const derniere =
    Math.ceil(Math.max(...avecBesoin.map(s => s.fin.getTime())) / TRANCHE_MS) *
    TRANCHE_MS
  const personnes = disponibles.map(p => ({
    plages: fusionnerPlages(p.plages),
    places: p.places,
  }))
  const tranches: Tranche[] = []
  for (let t = premiere; t < derniere; t += TRANCHE_MS) {
    const tranche = { debut: new Date(t), fin: new Date(t + TRANCHE_MS) }
    let besoin = 0
    let confirmees = 0
    let aConfirmer = 0
    for (const s of avecBesoin) {
      if (!chevauche(s, tranche)) continue
      besoin += s.besoin ?? 0
      confirmees += s.confirmees
      aConfirmer += s.aConfirmer
    }
    const libres = personnes.filter(
      p =>
        adequation(p.plages, tranche) === 'TOTALE' &&
        !p.places.some(place => chevauche(place, tranche))
    ).length
    tranches.push({
      ...tranche,
      besoin,
      confirmees,
      aConfirmer,
      disponibles: libres,
    })
  }
  return tranches
}

// ── Adresse ──────────────────────────────────────────────────────────────────

/**
 * Le jeton de l'adresse d'un appel, recalculé depuis son sel. L'empreinte et les
 * derniers caractères gardés se réalignent après un changement du secret du
 * serveur ; l'écriture porte le sel observé, pour ne jamais écraser un
 * renouvellement simultané.
 */
export async function jetonAppel(base: Base, appelId: string): Promise<string> {
  for (let essai = 0; essai < 3; essai += 1) {
    const appel = await base.appelBenevoles.findUniqueOrThrow({
      where: { id: appelId },
      select: { sel: true, empreinte: true },
    })
    const jeton = await jetonDe('appel', appel.sel)
    if (appel.empreinte === empreinte(jeton)) return jeton
    const { count } = await base.appelBenevoles.updateMany({
      where: { id: appelId, sel: appel.sel },
      data: { empreinte: empreinte(jeton), fin: jeton.slice(-6) },
    })
    if (count === 1) return jeton
  }
  throw new Error('L’adresse de l’appel change trop souvent : réessayez.')
}

// ── Droits ───────────────────────────────────────────────────────────────────

/**
 * Les périmètres où la personne écrit pour la période, ou « TOUS » pour un admin
 * de l'activité. Une période archivée n'en donne aucun.
 */
export async function perimetresEcrits(
  ctx: AppContext,
  edition: { id: string; activiteId: string; statut: string }
): Promise<'TOUS' | Set<string>> {
  if (edition.statut === 'ARCHIVEE') return new Set()
  if (await ctx.estAdminDe(edition.activiteId)) return 'TOUS'
  return ctx.perimetresAffectes(edition.id)
}

/**
 * Vrai si la personne gère l'appel : un admin de l'activité, ou une personne qui
 * écrit dans le périmètre d'un appel de portée « périmètre » ou « séquence ».
 */
export function gereLAppel(
  ecrits: 'TOUS' | Set<string>,
  appel: { portee: string; perimetreId: string | null }
): boolean {
  if (ecrits === 'TOUS') return true
  return appel.perimetreId !== null && ecrits.has(appel.perimetreId)
}

/**
 * Vrai si la personne voit une personne à répartir venue de cet appel : toute
 * personne qui écrit dans l'activité pour un appel de portée « période », les
 * personnes qui écrivent dans le périmètre de l'appel sinon (ADR 0041).
 */
export function voitLAppel(
  ecrits: 'TOUS' | Set<string>,
  appel: { portee: string; perimetreId: string | null }
): boolean {
  if (ecrits === 'TOUS') return true
  if (appel.portee === 'PERIODE') return ecrits.size > 0
  return appel.perimetreId !== null && ecrits.has(appel.perimetreId)
}

// ── Traitement ───────────────────────────────────────────────────────────────

/** Statuts d'un choix qui attend la décision de l'équipe. */
export const CHOIX_EN_ATTENTE: StatutChoix[] = ['EN_ATTENTE', 'LISTE_ATTENTE']

/**
 * Recalcule le statut d'une candidature après une décision. Elle reste en attente
 * tant qu'un choix attend, ou tant qu'une personne « là où il manque du monde »
 * n'a reçu aucune place. Traitée, elle libère son adresse : la personne peut
 * déposer de nouveau.
 */
export async function recalculerCandidature(
  tx: Prisma.TransactionClient,
  candidatureId: string
): Promise<void> {
  const candidature = await tx.candidature.findUniqueOrThrow({
    where: { id: candidatureId },
    select: {
      statut: true,
      ouAilleurs: true,
      choix: { select: { statut: true } },
    },
  })
  if (candidature.statut !== 'EN_ATTENTE') return
  const attend = candidature.choix.some(c =>
    CHOIX_EN_ATTENTE.includes(c.statut)
  )
  const acceptee = candidature.choix.some(c => c.statut === 'ACCEPTE')
  if (attend || (candidature.ouAilleurs && !acceptee)) return
  await tx.candidature.update({
    where: { id: candidatureId },
    data: { statut: 'TRAITEE', courrielEnAttente: null },
  })
}

/**
 * Accepte une candidature sur une séquence, dans une transaction ouverte par
 * `sousVerrouOrganisation` :
 * la fiche bénévole est créée, ou rattachée par son adresse ; elle reçoit les
 * plages de la candidature pour la période et une place à confirmer en renfort.
 * Le choix de la séquence passe à « accepté », créé s'il n'existait pas. La
 * séquence est verrouillée : deux acceptations simultanées ne se croisent pas.
 * Rend l'identifiant de la fiche, et vrai si la place est nouvelle.
 */
export async function accepterSurSequence(
  tx: Prisma.TransactionClient,
  entree: {
    candidatureId: string
    sequenceId: string
    acteurId: string
    maintenant: Date
  }
): Promise<{ benevoleId: string; placeCreee: boolean }> {
  const { candidatureId, sequenceId, acteurId, maintenant } = entree
  // Ordre des verrous, commun à tout traitement d'une candidature : la
  // candidature, puis la séquence. L'appelant tient déjà le verrou de
  // l'organisation, qui protège la recherche et la création de la fiche.
  await tx.$queryRaw`SELECT id FROM Candidature WHERE id = ${candidatureId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM Sequence WHERE id = ${sequenceId} FOR UPDATE`
  const candidature = await tx.candidature.findUniqueOrThrow({
    where: { id: candidatureId },
    include: { plages: true },
  })
  let benevoleId = candidature.benevoleId
  if (benevoleId === null && candidature.courriel !== null) {
    const existante = await tx.benevole.findFirst({
      where: {
        activiteId: candidature.activiteId,
        courriel: candidature.courriel,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    benevoleId = existante?.id ?? null
  }
  if (benevoleId === null) {
    const nombre = await tx.benevole.count({
      where: { activiteId: candidature.activiteId },
    })
    if (nombre >= BENEVOLES_MAX) {
      throw erreurSaisie(
        i18n._('Une activité compte {max} fiches bénévoles au plus.', {
          max: BENEVOLES_MAX,
        })
      )
    }
    benevoleId = (
      await tx.benevole.create({
        data: {
          organisationId: candidature.organisationId,
          activiteId: candidature.activiteId,
          nom: candidature.nom,
          courriel: candidature.courriel,
          telephone: candidature.telephone,
          accordLe: candidature.accordLe,
          origine: 'CANDIDATURE',
          creeParId: acteurId,
        },
        select: { id: true },
      })
    ).id
  }
  if (candidature.benevoleId !== benevoleId) {
    await tx.candidature.update({
      where: { id: candidature.id },
      data: { benevoleId },
    })
    // Les plages de la candidature rejoignent celles de la fiche pour la période.
    const actuelles = await tx.plageDisponibilite.findMany({
      where: { benevoleId, editionId: candidature.editionId },
    })
    const reunies = fusionnerPlages([...actuelles, ...candidature.plages])
    await tx.plageDisponibilite.deleteMany({
      where: { benevoleId, editionId: candidature.editionId },
    })
    await tx.plageDisponibilite.createMany({
      data: reunies.slice(0, PLAGES_MAX).map(p => ({
        editionId: candidature.editionId,
        benevoleId,
        debut: p.debut,
        fin: p.fin,
      })),
    })
  }
  await tx.choixCandidature.upsert({
    where: { candidatureId_sequenceId: { candidatureId, sequenceId } },
    create: {
      candidatureId,
      sequenceId,
      statut: 'ACCEPTE',
      traiteParId: acteurId,
      traiteLe: maintenant,
    },
    update: { statut: 'ACCEPTE', traiteParId: acteurId, traiteLe: maintenant },
  })
  const place = await tx.placeSequence.findUnique({
    where: { sequenceId_benevoleId: { sequenceId, benevoleId } },
    select: { id: true },
  })
  if (place === null) {
    // Une fiche joignable reçoit une place à confirmer ; une autre, une place
    // confirmée (ADR 0041).
    const fiche = await tx.benevole.findUniqueOrThrow({
      where: { id: benevoleId },
      select: { courriel: true, prevenirParMail: true },
    })
    const joignable = fiche.courriel !== null && fiche.prevenirParMail
    const nombre = await tx.placeSequence.count({ where: { sequenceId } })
    if (nombre >= PLACES_MAX) {
      throw erreurSaisie(
        i18n._('Une séquence compte {max} places au plus.', { max: PLACES_MAX })
      )
    }
    await tx.placeSequence.create({
      data: {
        sequenceId,
        benevoleId,
        role: 'RENFORT',
        confirmeeLe: joignable ? null : maintenant,
      },
    })
  }
  await recalculerCandidature(tx, candidature.id)
  return { benevoleId, placeCreee: place === null }
}

/** Les places en renfort d'une séquence : confirmées et à confirmer. */
export async function renfortsDe(
  base: Base,
  sequenceId: string
): Promise<number> {
  return base.placeSequence.count({ where: { sequenceId, role: 'RENFORT' } })
}

/**
 * Supprime les candidatures et les plages des périodes archivées, quel que soit
 * leur état (ADR 0041). `organisationId` limite la purge à une organisation.
 */
export async function purgerCandidatures(
  base: Base,
  options: { organisationId?: string } = {}
): Promise<{ candidatures: number; plages: number }> {
  const archivee = {
    statut: 'ARCHIVEE' as const,
    ...(options.organisationId === undefined
      ? {}
      : { organisationId: options.organisationId }),
  }
  const candidatures = await base.candidature.deleteMany({
    where: { edition: archivee },
  })
  const plages = await base.plageDisponibilite.deleteMany({
    where: { edition: archivee },
  })
  if (candidatures.count + plages.count > 0) {
    journal.info(
      {
        evenement: 'candidatures-purgees',
        candidatures: candidatures.count,
        plages: plages.count,
      },
      'Les candidatures et les plages des périodes archivées ont été supprimées.'
    )
  }
  return { candidatures: candidatures.count, plages: plages.count }
}
