import { randomUUID } from 'node:crypto'

import { indexerFiches, nomVide, type Niveau } from '@relaytour/commun'
import { prisma, type Prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { jourISO } from './agenda.ts'
import {
  accepterSurSequence,
  CHOIX_MAX,
  fusionnerPlages,
  joursDeLaPeriode,
  joursDesPlages,
  NOM_APPEL_MAX,
  perimetresEcrits,
  PLAGES_MAX,
  plagesValides,
  PRECISIONS_MAX,
  type Plage,
} from './appels.ts'
import {
  BENEVOLES_MAX,
  coordonneesLisibles,
  courrielValide,
  NOM_BENEVOLE_MAX,
  telephoneValide,
} from './benevoles.ts'
import { statutAuDepot } from './candidatures.ts'
import { accesRefuse, erreurSaisie } from './erreurs.ts'
import { annoncerPlace } from './espace-benevole.ts'
import { publierPourActivite } from './flux.ts'
import { journal } from './journal.ts'
import { sousVerrouOrganisation } from './limites.ts'
import { empreinte, nouveauSel } from './liens.ts'
import { texteFacultatif, texteRequis } from './saisie.ts'
import { i18n } from './langue.ts'
import { exigerModule } from './modules.ts'

// Import de listes de bénévoles (ADR 0042). Le navigateur lit le fichier, associe
// les colonnes et réunit les lignes d'une même personne ; il envoie ensuite les
// personnes par lots. Le serveur revalide chaque lot, le rapproche des fiches de
// l'activité, puis le simule ou l'écrit dans l'appel d'import de sa source.
//
// Chaque personne devient une candidature de l'appel d'import. En mode « places
// directes », ou avec « Accepter tout », ses séquences sont acceptées aussitôt :
// la fiche naît, ou se rattache, avec une place par séquence (ADR 0041).

/** Un lot compte 500 personnes au plus : le corps d'une requête reste sous 1 Mo. */
export const LOT_MAX = 500
export const SOURCE_MAX = 120
export const REF_EXTERNE_MAX = 120
/** Une ligne se désigne dans le rapport par la clé que le navigateur lui donne. */
const CLE_MAX = 64

export type ModeImport = 'A_REPARTIR' | 'PLACES_DIRECTES'

export interface PersonneSaisie {
  cle: string
  nom: string
  courriel?: string | null
  telephone?: string | null
  precisions?: string | null
  refExterne?: string | null
  accordLe?: Date | null
  plages?:
    | readonly {
        jour: Date
        jourFin?: Date | null
        heureDebut: string
        heureFin: string
      }[]
    | null
  sequenceIds?: readonly (string | number)[] | null
  rattachement?: string | number | null
  nouvelleFiche?: boolean | null
}

export interface DemandeImport {
  editionId: string | number
  perimetreId?: string | number | null
  source: string
  mode: ModeImport
  prevenirParMail: boolean
  accepterTout: boolean
  accord: boolean
  personnes: readonly PersonneSaisie[]
}

export type EtatLigne = 'A_IMPORTER' | 'IMPORTEE' | 'DEJA_IMPORTEE' | 'ECARTEE'

export interface LigneRapport {
  cle: string
  etat: EtatLigne
  motif: string | null
  rapprochement: { benevoleId: string; nom: string; niveau: Niveau } | null
  /** La fiche que la ligne rejoint, quand l'import la rattache. */
  rattacheeA: string | null
  /** Vrai si l'adresse est celle d'un compte de l'organisation (admins seulement). */
  compte: boolean
}

export interface RapportImport {
  simulation: boolean
  personnes: number
  aImporter: number
  dejaImportees: number
  ecartees: number
  fichesCreees: number
  fichesRattachees: number
  places: number
  /** Les fiches que l'activité peut encore recevoir avant ce lot. */
  fichesRestantes: number
  depassements: {
    sequenceId: string
    titre: string
    besoin: number
    renforts: number
  }[]
  lignes: LigneRapport[]
}

interface PersonneValide {
  cle: string
  nom: string
  courriel: string | null
  telephone: string | null
  precisions: string | null
  refExterne: string | null
  accordLe: Date
  plages: Plage[]
  sequenceIds: string[]
  rattachement: string | null
  nouvelleFiche: boolean
}

interface Portee {
  edition: { id: string; activiteId: string; organisationId: string }
  perimetreId: string | null
  admin: boolean
}

/**
 * La période et la portée de l'import, si la personne peut importer : un admin de
 * l'activité pour le programme entier, une personne qui écrit dans le périmètre
 * pour ce périmètre. Une période archivée ne reçoit rien.
 */
export async function porteeImport(
  ctx: AppContext,
  editionId: string | number,
  perimetreId: string | number | null | undefined
): Promise<Portee> {
  const lue = await ctx.exigerEdition(editionId)
  await exigerModule(lue.activiteId, 'BENEVOLES')
  const edition = {
    id: lue.id,
    activiteId: lue.activiteId,
    organisationId: ctx.organisation!.id,
  }
  if (lue.statut === 'ARCHIVEE') {
    throw erreurSaisie(i18n._('Cette période est archivée.'))
  }
  const ecrits = await perimetresEcrits(ctx, lue)
  const admin = ecrits === 'TOUS'
  if (perimetreId === null || perimetreId === undefined) {
    if (!admin) throw accesRefuse()
    return { edition, perimetreId: null, admin }
  }
  const perimetre = await prisma.perimetre.findFirst({
    where: {
      id: String(perimetreId),
      activiteId: edition.activiteId,
      archivedAt: null,
    },
    select: { id: true },
  })
  if (perimetre === null) throw accesRefuse()
  if (!admin && !ecrits.has(perimetre.id)) throw accesRefuse()
  return { edition, perimetreId: perimetre.id, admin }
}

/** Une personne revalidée, ou le motif qui l'écarte. */
function valider(
  saisie: PersonneSaisie,
  jours: readonly string[],
  fuseau: string,
  maintenant: Date
): PersonneValide | { cle: string; motif: string } {
  const cle = String(saisie.cle).slice(0, CLE_MAX)
  try {
    if (nomVide(saisie.nom)) {
      throw erreurSaisie(i18n._('La ligne ne porte aucun nom.'))
    }
    const sequenceIds = [...new Set((saisie.sequenceIds ?? []).map(String))]
    if (sequenceIds.length > CHOIX_MAX) {
      throw erreurSaisie(
        i18n._('Une personne choisit {max} séquences au plus.', {
          max: CHOIX_MAX,
        })
      )
    }
    const accordLe = saisie.accordLe ?? maintenant
    if (accordLe.getTime() > maintenant.getTime()) {
      throw erreurSaisie(i18n._('La date de l’accord ne peut pas être future.'))
    }
    return {
      cle,
      nom: texteRequis(saisie.nom, i18n._('Le nom'), NOM_BENEVOLE_MAX),
      courriel: courrielValide(saisie.courriel),
      telephone: telephoneValide(saisie.telephone),
      precisions: texteFacultatif(
        saisie.precisions,
        i18n._('Les précisions'),
        PRECISIONS_MAX
      ),
      refExterne: texteFacultatif(
        saisie.refExterne,
        i18n._('L’identifiant externe'),
        REF_EXTERNE_MAX
      ),
      accordLe,
      plages: plagesValides(
        (saisie.plages ?? []).map(p => ({
          jour: jourISO(p.jour),
          jourFin: p.jourFin ? jourISO(p.jourFin) : null,
          heureDebut: p.heureDebut,
          heureFin: p.heureFin,
        })),
        jours,
        fuseau
      ),
      sequenceIds,
      rattachement:
        saisie.rattachement === null || saisie.rattachement === undefined
          ? null
          : String(saisie.rattachement),
      nouvelleFiche: saisie.nouvelleFiche ?? false,
    }
  } catch (erreur) {
    return { cle, motif: (erreur as Error).message }
  }
}

/** Le nom de l'appel d'import d'une source. */
const nomAppelImport = (source: string) =>
  `Import : ${source}`.slice(0, NOM_APPEL_MAX)

/**
 * Simule ou écrit un lot. La simulation rend le rapport sans rien écrire.
 * L'écriture relit sous le verrou de l'organisation l'appel d'import, ses lignes
 * déjà importées et le plafond des fiches : deux envois du même lot ne
 * s'importent qu'une fois.
 */
export async function importerLot(
  ctx: AppContext,
  demande: DemandeImport,
  ecrire: boolean
): Promise<RapportImport> {
  const portee = await porteeImport(ctx, demande.editionId, demande.perimetreId)
  const { edition } = portee
  if (!demande.accord) {
    throw erreurSaisie(
      i18n._(
        'Un import exige que les personnes du fichier aient donné leur accord.'
      )
    )
  }
  const source = texteRequis(demande.source, i18n._('La source'), SOURCE_MAX)
  if (demande.personnes.length === 0 || demande.personnes.length > LOT_MAX) {
    throw erreurSaisie(
      i18n._('Un lot compte de 1 à {max} personnes.', { max: LOT_MAX })
    )
  }
  const cles = demande.personnes.map(p => String(p.cle).slice(0, CLE_MAX))
  if (new Set(cles).size !== cles.length) {
    throw erreurSaisie(i18n._('Chaque personne d’un lot porte une clé unique.'))
  }
  const maintenant = new Date()
  const fuseau = ctx.organisation!.fuseauHoraire
  const programme = await prisma.sequence.findMany({
    where: { editionId: edition.id },
    select: {
      id: true,
      titre: true,
      debut: true,
      fin: true,
      perimetreId: true,
      besoinBenevoles: true,
      _count: { select: { places: { where: { role: 'RENFORT' } } } },
    },
  })
  const jours = joursDesPlages(
    await joursDeLaPeriode(prisma, edition.id),
    programme,
    fuseau
  )
  const sequences = new Map(programme.map(s => [s.id, s] as const))

  // Revalidation de chaque ligne : une ligne invalide est écartée, avec son motif.
  const lignes = new Map<string, LigneRapport>()
  const valides: PersonneValide[] = []
  for (const saisie of demande.personnes) {
    const resultat = valider(saisie, jours, fuseau, maintenant)
    if ('motif' in resultat) {
      lignes.set(
        resultat.cle,
        ligneVide(resultat.cle, 'ECARTEE', resultat.motif)
      )
      continue
    }
    const horsPortee = resultat.sequenceIds.find(id => {
      const s = sequences.get(id)
      return (
        s === undefined ||
        (portee.perimetreId !== null && s.perimetreId !== portee.perimetreId)
      )
    })
    if (horsPortee !== undefined) {
      lignes.set(
        resultat.cle,
        ligneVide(
          resultat.cle,
          'ECARTEE',
          i18n._(
            'Une séquence associée n’appartient pas à la portée de l’import.'
          )
        )
      )
      continue
    }
    valides.push(resultat)
  }
  if (
    demande.mode === 'PLACES_DIRECTES' &&
    !valides.some(p => p.sequenceIds.length > 0)
  ) {
    throw erreurSaisie(
      i18n._(
        'Le mode « places directes » exige au moins une colonne associée à une séquence.'
      )
    )
  }

  // L'appel d'import de la source, s'il existe : il porte les lignes déjà importées.
  const appel = await prisma.appelBenevoles.findUnique({
    where: {
      editionId_sourceImport: { editionId: edition.id, sourceImport: source },
    },
    select: {
      id: true,
      sansAdresse: true,
      portee: true,
      perimetreId: true,
      candidatures: {
        select: { refExterne: true, courriel: true },
      },
    },
  })
  if (
    appel !== null &&
    (!appel.sansAdresse || appel.perimetreId !== portee.perimetreId)
  ) {
    throw erreurSaisie(
      i18n._(
        'Cette source sert déjà à un autre appel. Choisissez une autre source.'
      )
    )
  }
  const refsDeja = new Set(
    (appel?.candidatures ?? []).map(c => c.refExterne).filter(Boolean)
  )
  // Une adresse déjà importée dans l'appel compte, que sa candidature soit
  // encore en attente ou déjà traitée.
  const courrielsDeja = new Set(
    (appel?.candidatures ?? []).map(c => c.courriel).filter(Boolean)
  )

  // Rapprochement avec les fiches de l'activité, et avec les comptes pour un
  // admin. Une personne qui n'administre pas l'activité ne se rapproche que des
  // fiches dont elle lit les coordonnées : l'import ne lui apprend pas quelle
  // fiche porte une adresse ou un numéro qu'elle ne lit pas.
  const toutes = await prisma.benevole.findMany({
    where: { activiteId: edition.activiteId },
    select: { id: true, nom: true, courriel: true, telephone: true },
  })
  const lisibles = portee.admin
    ? null
    : await coordonneesLisibles(
        ctx,
        edition.activiteId,
        toutes.map(f => f.id)
      )
  const fiches =
    lisibles === null ? toutes : toutes.filter(f => lisibles.has(f.id))
  const chercher = indexerFiches(fiches)
  const fichesConnues = new Set(fiches.map(f => f.id))
  const comptes = portee.admin
    ? new Set(
        (
          await prisma.user.findMany({
            where: {
              email: {
                in: valides.map(p => p.courriel).filter(c => c !== null),
              },
              appartenances: {
                some: { organisationId: edition.organisationId },
              },
            },
            select: { email: true },
          })
        ).map(u => u.email.toLowerCase())
      )
    : new Set<string>()

  const accepter = demande.mode === 'PLACES_DIRECTES' || demande.accepterTout
  const trouvees = new Map(valides.map(p => [p.cle, chercher(p)] as const))
  // Les places que les fiches rejointes tiennent déjà : une acceptation n'y
  // ajoute rien, ni dans le compte des places, ni dans les dépassements.
  const rejointes = [
    ...new Set(
      valides.flatMap(p => [
        ...(p.rattachement ? [p.rattachement] : []),
        ...(trouvees.get(p.cle)?.niveau === 'FORT'
          ? [trouvees.get(p.cle)!.fiche.id]
          : []),
      ])
    ),
  ]
  const placesTenues = new Set(
    rejointes.length === 0
      ? []
      : (
          await prisma.placeSequence.findMany({
            where: {
              benevoleId: { in: rejointes },
              sequence: { editionId: edition.id },
            },
            select: { benevoleId: true, sequenceId: true },
          })
        ).map(p => `${p.benevoleId}:${p.sequenceId}`)
  )
  const aImporter: ImportPrevu[] = []
  let fichesCreees = 0
  let fichesRattachees = 0
  let places = 0
  const renfortsApres = new Map<string, number>()
  for (const p of valides) {
    const trouve = trouvees.get(p.cle) ?? null
    const ligne = ligneVide(p.cle, 'A_IMPORTER', null)
    ligne.rapprochement = trouve
      ? {
          benevoleId: trouve.fiche.id,
          nom: trouve.fiche.nom,
          niveau: trouve.niveau,
        }
      : null
    ligne.compte = p.courriel !== null && comptes.has(p.courriel)
    if (
      (p.refExterne !== null && refsDeja.has(p.refExterne)) ||
      (p.courriel !== null && courrielsDeja.has(p.courriel))
    ) {
      ligne.etat = 'DEJA_IMPORTEE'
      lignes.set(p.cle, ligne)
      continue
    }
    if (p.rattachement !== null && !fichesConnues.has(p.rattachement)) {
      lignes.set(
        p.cle,
        ligneVide(
          p.cle,
          'ECARTEE',
          i18n._('La fiche à rattacher n’existe plus.')
        )
      )
      continue
    }
    // Une adresse identique rattache d'office, sauf demande contraire ; un
    // rapprochement plus faible ne rattache que sur demande.
    const ficheId =
      p.rattachement ??
      (!p.nouvelleFiche && trouve?.niveau === 'FORT' ? trouve.fiche.id : null)
    ligne.rattacheeA = ficheId
    // Une fiche naît pour une personne acceptée aussitôt, ou pour une personne
    // que l'aperçu demande de séparer d'une fiche de même adresse.
    const creerFiche =
      ficheId === null &&
      ((accepter && p.sequenceIds.length > 0) || p.nouvelleFiche)
    if (ficheId !== null) fichesRattachees += 1
    else if (creerFiche) fichesCreees += 1
    if (accepter) {
      for (const id of p.sequenceIds) {
        if (ficheId !== null && placesTenues.has(`${ficheId}:${id}`)) continue
        places += 1
        renfortsApres.set(id, (renfortsApres.get(id) ?? 0) + 1)
      }
    }
    if (p.refExterne !== null) refsDeja.add(p.refExterne)
    if (p.courriel !== null) courrielsDeja.add(p.courriel)
    lignes.set(p.cle, ligne)
    aImporter.push({ ...p, ficheId, creerFiche })
  }

  const fichesRestantes = Math.max(0, BENEVOLES_MAX - fiches.length)
  if (fichesCreees > fichesRestantes && ecrire) {
    throw erreurSaisie(
      i18n._(
        'Une activité compte {max} fiches bénévoles au plus : ce lot en créerait {fichesCreees}, il en reste {fichesRestantes}.',
        { max: BENEVOLES_MAX, fichesCreees, fichesRestantes }
      )
    )
  }
  const depassements = [...renfortsApres.entries()].flatMap(([id, ajout]) => {
    const s = sequences.get(id)!
    const renforts = s._count.places + ajout
    return s.besoinBenevoles !== null && renforts > s.besoinBenevoles
      ? [
          {
            sequenceId: id,
            titre: s.titre,
            besoin: s.besoinBenevoles,
            renforts,
          },
        ]
      : []
  })

  const rapport = (simulation: boolean): RapportImport => ({
    simulation,
    personnes: demande.personnes.length,
    aImporter: aImporter.length,
    dejaImportees: [...lignes.values()].filter(l => l.etat === 'DEJA_IMPORTEE')
      .length,
    ecartees: [...lignes.values()].filter(l => l.etat === 'ECARTEE').length,
    fichesCreees,
    fichesRattachees,
    places,
    fichesRestantes,
    depassements,
    lignes: demande.personnes
      .map(p => lignes.get(String(p.cle).slice(0, CLE_MAX)))
      .filter((l): l is LigneRapport => l !== undefined),
  })
  if (!ecrire || aImporter.length === 0) return rapport(!ecrire)

  const { annonces, deja } = await ecrireLot(ctx, {
    portee,
    source,
    personnes: aImporter,
    accepter,
    prevenirParMail: demande.prevenirParMail,
    maintenant,
  })
  for (const p of aImporter) {
    lignes.get(p.cle)!.etat = deja.has(p.cle) ? 'DEJA_IMPORTEE' : 'IMPORTEE'
  }
  // Les mails partent après la validation : la file relit chaque fiche.
  for (const benevoleId of annonces) {
    await annoncerPlace(prisma, {
      benevoleId,
      organisationId: edition.organisationId,
      activiteId: edition.activiteId,
    })
  }
  publierPourActivite(
    'CANDIDATURE',
    edition.organisationId,
    edition.activiteId,
    {
      editionId: edition.id,
    }
  )
  publierPourActivite('PROGRAMME', edition.organisationId, edition.activiteId, {
    editionId: edition.id,
  })
  journal.info(
    {
      evenement: 'benevoles-importes',
      activiteId: edition.activiteId,
      personnes: aImporter.length,
      fichesCreees,
      mode: demande.mode,
    },
    'Un lot de bénévoles a été importé.'
  )
  return rapport(false)
}

function ligneVide(
  cle: string,
  etat: EtatLigne,
  motif: string | null
): LigneRapport {
  return {
    cle,
    etat,
    motif,
    rapprochement: null,
    rattacheeA: null,
    compte: false,
  }
}

/** Une personne du lot, avec la fiche qu'elle rejoint ou qu'elle crée. */
type ImportPrevu = PersonneValide & {
  ficheId: string | null
  creerFiche: boolean
}

/**
 * Écrit un lot dans une transaction, sous le verrou de l'organisation puis des
 * séquences du lot, dans l'ordre de leurs identifiants : l'ordre des acceptations
 * (ADR 0041). Rend les fiches qui ont reçu une place, pour leur premier mail, et
 * les lignes qu'un envoi croisé a importées entre-temps.
 */
async function ecrireLot(
  ctx: AppContext,
  lot: {
    portee: Portee
    source: string
    personnes: ImportPrevu[]
    accepter: boolean
    prevenirParMail: boolean
    maintenant: Date
  }
): Promise<{ annonces: string[]; deja: Set<string> }> {
  const { edition, perimetreId } = lot.portee
  const acteurId = ctx.personne!.id
  const sequenceIds = [
    ...new Set(lot.personnes.flatMap(p => p.sequenceIds)),
  ].sort()
  return sousVerrouOrganisation(
    edition.organisationId,
    async tx => {
      // Tous les verrous avant la première lecture ordinaire (MariaDB 11.8).
      for (const id of sequenceIds) {
        await tx.$queryRaw`SELECT id FROM Sequence WHERE id = ${id} FOR UPDATE`
      }
      // L'appel et ses lignes se relisent sous le verrou de l'organisation : un
      // envoi croisé du même lot a pu les écrire entre la simulation et ici.
      const existant = await tx.appelBenevoles.findUnique({
        where: {
          editionId_sourceImport: {
            editionId: edition.id,
            sourceImport: lot.source,
          },
        },
        select: {
          id: true,
          candidatures: { select: { refExterne: true, courriel: true } },
        },
      })
      const appelId = existant?.id ?? (await creerAppelImport(tx, lot))
      const refs = new Set(
        (existant?.candidatures ?? []).map(c => c.refExterne).filter(Boolean)
      )
      const courriels = new Set(
        (existant?.candidatures ?? []).map(c => c.courriel).filter(Boolean)
      )
      const deja = new Set(
        lot.personnes
          .filter(
            p =>
              (p.refExterne !== null && refs.has(p.refExterne)) ||
              (p.courriel !== null && courriels.has(p.courriel))
          )
          .map(p => p.cle)
      )
      const personnes = lot.personnes.filter(p => !deja.has(p.cle))
      const fichesNouvelles = personnes.filter(p => p.creerFiche).length
      if (fichesNouvelles > 0) {
        const nombre = await tx.benevole.count({
          where: { activiteId: edition.activiteId },
        })
        if (nombre + fichesNouvelles > BENEVOLES_MAX) {
          throw erreurSaisie(
            i18n._('Une activité compte {max} fiches bénévoles au plus.', {
              max: BENEVOLES_MAX,
            })
          )
        }
      }
      const renforts = new Map(
        (
          await tx.sequence.findMany({
            where: { id: { in: sequenceIds } },
            select: {
              id: true,
              besoinBenevoles: true,
              _count: { select: { places: { where: { role: 'RENFORT' } } } },
            },
          })
        ).map(s => [
          s.id,
          { besoin: s.besoinBenevoles ?? 0, renforts: s._count.places },
        ])
      )
      const annonces: string[] = []
      const touchees = new Set<string>()
      for (const p of personnes) {
        let ficheId = p.ficheId
        if (p.creerFiche) {
          ficheId = (
            await tx.benevole.create({
              data: {
                organisationId: edition.organisationId,
                activiteId: edition.activiteId,
                nom: p.nom,
                courriel: p.courriel,
                telephone: p.telephone,
                precisionsDisponibilite: p.precisions,
                accordLe: p.accordLe,
                origine: 'IMPORT',
                sourceImport: lot.source,
                perimetreImportId: perimetreId,
                prevenirParMail: lot.prevenirParMail,
                creeParId: acteurId,
              },
              select: { id: true },
            })
          ).id
        }
        const candidature = await tx.candidature.create({
          data: {
            organisationId: edition.organisationId,
            activiteId: edition.activiteId,
            editionId: edition.id,
            appelId,
            nom: p.nom,
            courriel: p.courriel,
            courrielEnAttente: p.courriel,
            telephone: p.telephone,
            precisionsDisponibilite: p.precisions,
            accordLe: p.accordLe,
            origine: 'IMPORT',
            sourceImport: lot.source,
            refExterne: p.refExterne,
            benevoleId: ficheId,
            choix: {
              create: p.sequenceIds.map(sequenceId => ({
                sequenceId,
                statut: statutAuDepot(renforts.get(sequenceId)!),
              })),
            },
            plages: {
              create: p.plages.map(pl => ({ editionId: edition.id, ...pl })),
            },
          },
          select: { id: true },
        })
        for (const sequenceId of p.sequenceIds) {
          const etat = renforts.get(sequenceId)!
          etat.renforts += lot.accepter ? 1 : 0
        }
        if (ficheId !== null) {
          await verserPlages(tx, ficheId, edition.id, p)
        }
        if (!lot.accepter) continue
        let placeCreee = false
        for (const sequenceId of p.sequenceIds) {
          const acceptee = await accepterSurSequence(tx, {
            candidatureId: candidature.id,
            sequenceId,
            acteurId,
            maintenant: lot.maintenant,
          })
          placeCreee ||= acceptee.placeCreee
          touchees.add(sequenceId)
        }
        if (placeCreee && ficheId !== null) annonces.push(ficheId)
      }
      // Une seule nouvelle version par séquence acceptée dans le lot.
      for (const sequenceId of touchees) {
        await tx.sequence.update({
          where: { id: sequenceId },
          data: { version: { increment: 1 } },
        })
      }
      return { annonces, deja }
    },
    { timeout: 60_000 }
  )
}

/** Les plages et les précisions d'une personne rejoignent sa fiche pour la période. */
async function verserPlages(
  tx: Prisma.TransactionClient,
  benevoleId: string,
  editionId: string,
  p: PersonneValide
) {
  if (p.precisions !== null) {
    await tx.benevole.updateMany({
      where: { id: benevoleId, precisionsDisponibilite: null },
      data: { precisionsDisponibilite: p.precisions },
    })
  }
  if (p.plages.length === 0) return
  const actuelles = await tx.plageDisponibilite.findMany({
    where: { benevoleId, editionId },
  })
  const reunies = fusionnerPlages([...actuelles, ...p.plages]).slice(
    0,
    PLAGES_MAX
  )
  await tx.plageDisponibilite.deleteMany({ where: { benevoleId, editionId } })
  await tx.plageDisponibilite.createMany({
    data: reunies.map(pl => ({
      editionId,
      benevoleId,
      debut: pl.debut,
      fin: pl.fin,
    })),
  })
}

/**
 * Crée l'appel d'import d'une source : sans adresse publique et fermé. Son sel et
 * son empreinte existent pour les contraintes de la table, et ne servent jamais.
 */
async function creerAppelImport(
  tx: Prisma.TransactionClient,
  lot: { portee: Portee; source: string; maintenant: Date }
): Promise<string> {
  const { edition, perimetreId } = lot.portee
  const fin = await tx.edition.findUniqueOrThrow({
    where: { id: edition.id },
    select: { fin: true },
  })
  const appel = await tx.appelBenevoles.create({
    data: {
      organisationId: edition.organisationId,
      activiteId: edition.activiteId,
      editionId: edition.id,
      portee: perimetreId === null ? 'PERIODE' : 'PERIMETRE',
      perimetreId,
      nom: nomAppelImport(lot.source),
      ouvertLe: lot.maintenant,
      fermeLe: new Date(
        Math.max(lot.maintenant.getTime() + 1000, fin.fin.getTime())
      ),
      fermeManuellementLe: lot.maintenant,
      sansAdresse: true,
      sourceImport: lot.source,
      sel: nouveauSel(),
      empreinte: empreinte(randomUUID()),
      fin: 'import',
    },
    select: { id: true },
  })
  return appel.id
}
