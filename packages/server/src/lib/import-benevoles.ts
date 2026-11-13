import { randomUUID } from 'node:crypto'

import {
  cleCourriel,
  cleTelephone,
  indexerFiches,
  nomVide,
  type Niveau,
} from '@relaytour/commun'
import { Prisma, prisma } from '@relaytour/database'

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
//
// Une ligne qui porte un identifiant externe désigne une personne, comme un
// billet : deux identifiants différents restent deux personnes, même avec la
// même adresse. Sur option, un admin de l'activité met à jour les personnes déjà
// importées, retrouvées par leur identifiant externe : les champs vides se
// complètent et les nouvelles séquences s'ajoutent. Une mise à jour n'envoie
// aucun mail.

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
  /** Met à jour les personnes déjà importées, retrouvées par leur identifiant externe. */
  mettreAJour?: boolean
  accord: boolean
  personnes: readonly PersonneSaisie[]
}

export type EtatLigne =
  'A_IMPORTER' | 'IMPORTEE' | 'DEJA_IMPORTEE' | 'MISE_A_JOUR' | 'ECARTEE'

/** Un champ qu'une mise à jour complète, ou qu'elle laisse en conflit. */
export type ChampImport =
  'COURRIEL' | 'TELEPHONE' | 'PRECISIONS' | 'PLAGES' | 'SEQUENCES'

export interface LigneRapport {
  cle: string
  etat: EtatLigne
  motif: string | null
  rapprochement: { benevoleId: string; nom: string; niveau: Niveau } | null
  /** La fiche que la ligne rejoint, quand l'import la rattache. */
  rattacheeA: string | null
  /** Vrai si l'adresse est celle d'un compte de l'organisation (admins seulement). */
  compte: boolean
  /** Les champs qu'une mise à jour complète. */
  champs: ChampImport[]
  /** Les champs déjà remplis d'une autre valeur, que la mise à jour garde. */
  conflits: ChampImport[]
}

export interface RapportImport {
  simulation: boolean
  personnes: number
  aImporter: number
  dejaImportees: number
  /** Les personnes déjà importées que la ligne met à jour. */
  misesAJour: number
  /** Les lignes dont un champ diffère de la personne déjà importée. */
  conflits: number
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

/** Ce qu'une personne déjà importée porte : sa fiche, ou sa candidature sans fiche. */
export interface Existant {
  courriel: string | null
  telephone: string | null
  precisions: string | null
  plages: readonly Plage[]
  /** Les séquences de la candidature, quel que soit leur statut. */
  sequences: ReadonlySet<string>
}

/** Ce qu'une ligne change dans une personne déjà importée. */
export interface PlanMiseAJour {
  champs: ChampImport[]
  conflits: ChampImport[]
  /** Les valeurs à écrire ; null : le champ ne change pas. */
  courriel: string | null
  telephone: string | null
  precisions: string | null
  plages: Plage[] | null
  /** Les séquences que la candidature n'a pas encore choisies. */
  sequenceIds: string[]
}

const memesPlages = (a: readonly Plage[], b: readonly Plage[]) =>
  a.length === b.length &&
  a.every(
    (p, i) =>
      p.debut.getTime() === b[i]!.debut.getTime() &&
      p.fin.getTime() === b[i]!.fin.getTime()
  )

/**
 * Ce qu'une ligne change dans une personne déjà importée. Un champ vide se
 * complète ; un champ rempli d'une autre valeur reste tel quel et compte comme
 * conflit. Les plages se réunissent. Une séquence déjà choisie, même refusée, ne
 * revient pas : un fichier n'annule pas une décision de l'équipe.
 */
export function planifierMiseAJour(
  existant: Existant,
  ligne: Pick<
    PersonneValide,
    'courriel' | 'telephone' | 'precisions' | 'plages' | 'sequenceIds'
  >
): PlanMiseAJour {
  const plan: PlanMiseAJour = {
    champs: [],
    conflits: [],
    courriel: null,
    telephone: null,
    precisions: null,
    plages: null,
    sequenceIds: [],
  }
  if (ligne.courriel !== null) {
    if (existant.courriel === null) {
      plan.courriel = ligne.courriel
      plan.champs.push('COURRIEL')
    } else if (cleCourriel(existant.courriel) !== cleCourriel(ligne.courriel)) {
      plan.conflits.push('COURRIEL')
    }
  }
  if (ligne.telephone !== null) {
    const cle = (t: string) => cleTelephone(t) ?? t.trim()
    if (existant.telephone === null) {
      plan.telephone = ligne.telephone
      plan.champs.push('TELEPHONE')
    } else if (cle(existant.telephone) !== cle(ligne.telephone)) {
      plan.conflits.push('TELEPHONE')
    }
  }
  if (ligne.precisions !== null && existant.precisions === null) {
    plan.precisions = ligne.precisions
    plan.champs.push('PRECISIONS')
  }
  if (ligne.plages.length > 0) {
    const avant = fusionnerPlages(existant.plages).slice(0, PLAGES_MAX)
    const apres = fusionnerPlages([...existant.plages, ...ligne.plages]).slice(
      0,
      PLAGES_MAX
    )
    if (!memesPlages(avant, apres)) {
      plan.plages = apres
      plan.champs.push('PLAGES')
    }
  }
  plan.sequenceIds = ligne.sequenceIds.filter(id => !existant.sequences.has(id))
  if (plan.sequenceIds.length > 0) plan.champs.push('SEQUENCES')
  return plan
}

/** Une candidature déjà importée, que retrouve son identifiant externe. */
interface Cible {
  candidatureId: string
  benevoleId: string | null
  /** Faux pour une candidature retirée, ou refusée sans fiche : le fichier n'y touche pas. */
  modifiable: boolean
  existant: Existant
}

/**
 * Les candidatures d'un appel d'import désignées par ces identifiants externes,
 * avec la fiche qu'elles ont rejointe. Une personne qui a une fiche se lit dans sa
 * fiche ; sinon, dans sa candidature.
 */
async function lireCibles(
  base: typeof prisma | Prisma.TransactionClient,
  appelId: string,
  editionId: string,
  refs: readonly string[]
): Promise<Map<string, Cible>> {
  if (refs.length === 0) return new Map()
  const candidatures = await base.candidature.findMany({
    where: { appelId, refExterne: { in: [...refs] } },
    select: {
      id: true,
      statut: true,
      refExterne: true,
      courriel: true,
      telephone: true,
      precisionsDisponibilite: true,
      benevoleId: true,
      choix: { select: { sequenceId: true } },
      plages: { select: { debut: true, fin: true } },
      benevole: {
        select: {
          courriel: true,
          telephone: true,
          precisionsDisponibilite: true,
          plages: { where: { editionId }, select: { debut: true, fin: true } },
        },
      },
    },
  })
  return new Map(
    candidatures.map(c => {
      const source = c.benevole ?? c
      return [
        c.refExterne!,
        {
          candidatureId: c.id,
          benevoleId: c.benevoleId,
          modifiable:
            c.statut !== 'RETIREE' &&
            !(c.statut === 'TRAITEE' && c.benevoleId === null),
          existant: {
            courriel: source.courriel,
            telephone: source.telephone,
            precisions: source.precisionsDisponibilite,
            plages: source.plages,
            sequences: new Set(c.choix.map(x => x.sequenceId)),
          },
        },
      ] as const
    })
  )
}

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
        select: { refExterne: true, courriel: true, benevoleId: true },
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
  // La mise à jour touche des fiches que d'autres personnes ont créées ou
  // modifiées : elle est réservée aux admins de l'activité.
  const mettreAJour = demande.mettreAJour === true
  if (mettreAJour && !portee.admin) {
    throw erreurSaisie(
      i18n._(
        'Seuls les admins de l’activité mettent à jour les personnes déjà importées.'
      )
    )
  }
  const refsDeja = new Set(
    (appel?.candidatures ?? []).map(c => c.refExterne).filter(Boolean)
  )
  // Une adresse déjà importée dans l'appel compte, que sa candidature soit
  // encore en attente ou déjà traitée. Une ligne qui porte un identifiant
  // externe se reconnaît par lui seul : l'adresse d'un acheteur couvre parfois
  // plusieurs billets.
  const courrielsDeja = new Set(
    (appel?.candidatures ?? []).map(c => c.courriel).filter(Boolean)
  )
  const dejaImportee = (p: PersonneValide) =>
    p.refExterne !== null
      ? refsDeja.has(p.refExterne)
      : p.courriel !== null && courrielsDeja.has(p.courriel)
  // Les fiches liées à une ligne de l'appel par son identifiant externe : une
  // ligne qui porte un autre identifiant ne s'en rapproche pas.
  const fichesDeLignes = new Set(
    (appel?.candidatures ?? [])
      .filter(c => c.refExterne !== null && c.benevoleId !== null)
      .map(c => c.benevoleId!)
  )
  const cibles =
    mettreAJour && appel !== null
      ? await lireCibles(
          prisma,
          appel.id,
          edition.id,
          valides
            .map(p => p.refExterne)
            .filter((r): r is string => r !== null && refsDeja.has(r))
        )
      : new Map<string, Cible>()

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
  const chercherHorsLignes = indexerFiches(
    fiches.filter(f => !fichesDeLignes.has(f.id))
  )
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
  const trouvees = new Map(
    valides.map(
      p =>
        [
          p.cle,
          p.refExterne !== null ? chercherHorsLignes(p) : chercher(p),
        ] as const
    )
  )
  // Les places que les fiches rejointes tiennent déjà : une acceptation n'y
  // ajoute rien, ni dans le compte des places, ni dans les dépassements.
  const rejointes = [
    ...new Set([
      ...valides.flatMap(p => [
        ...(p.rattachement ? [p.rattachement] : []),
        ...(trouvees.get(p.cle)?.niveau === 'FORT'
          ? [trouvees.get(p.cle)!.fiche.id]
          : []),
      ]),
      ...[...cibles.values()].flatMap(c =>
        c.benevoleId === null ? [] : [c.benevoleId]
      ),
    ]),
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
  const aMettreAJour: PersonneValide[] = []
  let fichesCreees = 0
  let fichesRattachees = 0
  let places = 0
  const renfortsApres = new Map<string, number>()
  const compterPlaces = (ficheId: string | null, sequenceIds: string[]) => {
    for (const id of sequenceIds) {
      if (ficheId !== null && placesTenues.has(`${ficheId}:${id}`)) continue
      places += 1
      renfortsApres.set(id, (renfortsApres.get(id) ?? 0) + 1)
    }
  }
  for (const p of valides) {
    const trouve = trouvees.get(p.cle) ?? null
    const ligne = ligneVide(p.cle, 'A_IMPORTER', null)
    ligne.compte = p.courriel !== null && comptes.has(p.courriel)
    if (dejaImportee(p)) {
      // Une ligne déjà importée ne rejoint aucune fiche : son rapprochement ne
      // demande aucune décision.
      ligne.etat = 'DEJA_IMPORTEE'
      lignes.set(p.cle, ligne)
      const cible = p.refExterne === null ? undefined : cibles.get(p.refExterne)
      if (cible === undefined || !cible.modifiable) continue
      const plan = planifierMiseAJour(cible.existant, p)
      ligne.conflits = plan.conflits
      if (plan.champs.length === 0) continue
      ligne.etat = 'MISE_A_JOUR'
      ligne.champs = plan.champs
      ligne.rattacheeA = cible.benevoleId
      aMettreAJour.push(p)
      if (accepter && plan.sequenceIds.length > 0) {
        if (cible.benevoleId === null) fichesCreees += 1
        compterPlaces(cible.benevoleId, plan.sequenceIds)
      }
      continue
    }
    ligne.rapprochement = trouve
      ? {
          benevoleId: trouve.fiche.id,
          nom: trouve.fiche.nom,
          niveau: trouve.niveau,
        }
      : null
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
    if (accepter) compterPlaces(ficheId, p.sequenceIds)
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

  const rapport = (simulation: boolean): RapportImport => {
    const toutes = [...lignes.values()]
    return {
      simulation,
      personnes: demande.personnes.length,
      aImporter: aImporter.length,
      dejaImportees: toutes.filter(l => l.etat === 'DEJA_IMPORTEE').length,
      misesAJour: toutes.filter(l => l.etat === 'MISE_A_JOUR').length,
      conflits: toutes.filter(l => l.conflits.length > 0).length,
      ecartees: toutes.filter(l => l.etat === 'ECARTEE').length,
      fichesCreees,
      fichesRattachees,
      places,
      fichesRestantes,
      depassements,
      lignes: demande.personnes
        .map(p => lignes.get(String(p.cle).slice(0, CLE_MAX)))
        .filter((l): l is LigneRapport => l !== undefined),
    }
  }
  if (!ecrire || aImporter.length + aMettreAJour.length === 0) {
    return rapport(!ecrire)
  }

  const ecrit = await ecrireLot(ctx, {
    portee,
    source,
    personnes: aImporter,
    misesAJour: aMettreAJour,
    accepter,
    prevenirParMail: demande.prevenirParMail,
    maintenant,
  })
  for (const p of aImporter) {
    lignes.get(p.cle)!.etat = ecrit.deja.has(p.cle)
      ? 'DEJA_IMPORTEE'
      : 'IMPORTEE'
  }
  // L'état écrit remplace celui de la simulation : un autre envoi a pu changer
  // la personne entre-temps.
  for (const p of aMettreAJour) {
    const ligne = lignes.get(p.cle)!
    const plan = ecrit.plans.get(p.cle)
    ligne.etat = plan === undefined ? 'DEJA_IMPORTEE' : 'MISE_A_JOUR'
    ligne.champs = plan?.champs ?? []
    ligne.conflits = plan?.conflits ?? ligne.conflits
  }
  // Les mails partent après la validation : la file relit chaque fiche. Une
  // mise à jour n'en envoie aucun.
  for (const benevoleId of ecrit.annonces) {
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
      misesAJour: ecrit.plans.size,
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
    champs: [],
    conflits: [],
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
 * (ADR 0041). Les candidatures à mettre à jour et leurs fiches se verrouillent
 * ensuite, avant toute lecture ordinaire. Rend les fiches qui ont reçu une place,
 * pour leur premier mail, les lignes qu'un envoi croisé a importées entre-temps,
 * et ce que chaque mise à jour a changé.
 */
async function ecrireLot(
  ctx: AppContext,
  lot: {
    portee: Portee
    source: string
    personnes: ImportPrevu[]
    misesAJour: PersonneValide[]
    accepter: boolean
    prevenirParMail: boolean
    maintenant: Date
  }
): Promise<{
  annonces: string[]
  deja: Set<string>
  plans: Map<string, PlanMiseAJour>
}> {
  const { edition, perimetreId } = lot.portee
  const acteurId = ctx.personne!.id
  const sequenceIds = [
    ...new Set(
      [...lot.personnes, ...lot.misesAJour].flatMap(p => p.sequenceIds)
    ),
  ].sort()
  const refsAMettreAJour = lot.misesAJour.map(p => p.refExterne!)
  return sousVerrouOrganisation(
    edition.organisationId,
    async tx => {
      // Tous les verrous avant la première lecture ordinaire (MariaDB 11.8).
      for (const id of sequenceIds) {
        await tx.$queryRaw`SELECT id FROM Sequence WHERE id = ${id} FOR UPDATE`
      }
      if (refsAMettreAJour.length > 0) {
        const verrouillees = await tx.$queryRaw<
          { id: string; benevoleId: string | null }[]
        >`SELECT c.id, c.benevoleId FROM Candidature c
          JOIN AppelBenevoles a ON a.id = c.appelId
          WHERE a.editionId = ${edition.id} AND a.sourceImport = ${lot.source}
            AND c.refExterne IN (${Prisma.join(refsAMettreAJour)})
          ORDER BY c.id FOR UPDATE`
        const benevoleIds = [
          ...new Set(
            verrouillees.flatMap(c =>
              c.benevoleId === null ? [] : [c.benevoleId]
            )
          ),
        ].sort()
        if (benevoleIds.length > 0) {
          await tx.$queryRaw`SELECT id FROM Benevole WHERE id IN (${Prisma.join(benevoleIds)}) ORDER BY id FOR UPDATE`
        }
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
          .filter(p =>
            p.refExterne !== null
              ? refs.has(p.refExterne)
              : p.courriel !== null && courriels.has(p.courriel)
          )
          .map(p => p.cle)
      )
      const personnes = lot.personnes.filter(p => !deja.has(p.cle))

      // Les mises à jour se recalculent sur l'état relu sous le verrou.
      const cibles = await lireCibles(tx, appelId, edition.id, refsAMettreAJour)
      const misesAJour = lot.misesAJour.flatMap(p => {
        const cible = cibles.get(p.refExterne!)
        if (cible === undefined || !cible.modifiable) return []
        const plan = planifierMiseAJour(cible.existant, p)
        return plan.champs.length === 0 ? [] : [{ p, cible, plan }]
      })

      const fichesNouvelles =
        personnes.filter(p => p.creerFiche).length +
        (lot.accepter
          ? misesAJour.filter(
              m => m.cible.benevoleId === null && m.plan.sequenceIds.length > 0
            ).length
          : 0)
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
            // Une ligne à identifiant externe se reconnaît par lui : deux
            // billets d'un même acheteur attendent ensemble dans l'appel.
            courrielEnAttente: p.refExterne === null ? p.courriel : null,
            telephone: p.telephone,
            precisionsDisponibilite: p.precisions,
            accordLe: p.accordLe,
            origine: 'IMPORT',
            sourceImport: lot.source,
            refExterne: p.refExterne,
            prevenirParMail: lot.prevenirParMail,
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

      // Les mises à jour : aucune n'annonce de place, donc aucun mail.
      const plans = new Map<string, PlanMiseAJour>()
      for (const { p, cible, plan } of misesAJour) {
        await appliquerMiseAJour(tx, {
          cible,
          plan,
          editionId: edition.id,
        })
        for (const sequenceId of plan.sequenceIds) {
          const etat = renforts.get(sequenceId)!
          await tx.choixCandidature.create({
            data: {
              candidatureId: cible.candidatureId,
              sequenceId,
              statut: statutAuDepot(etat),
            },
          })
          etat.renforts += lot.accepter ? 1 : 0
        }
        if (plan.sequenceIds.length > 0) {
          // Un nouveau choix remet la candidature dans la file de l'équipe ;
          // une acceptation l'en retire aussitôt.
          await tx.candidature.updateMany({
            where: { id: cible.candidatureId, statut: 'TRAITEE' },
            data: { statut: 'EN_ATTENTE' },
          })
          if (lot.accepter) {
            for (const sequenceId of plan.sequenceIds) {
              await accepterSurSequence(tx, {
                candidatureId: cible.candidatureId,
                sequenceId,
                acteurId,
                maintenant: lot.maintenant,
              })
              touchees.add(sequenceId)
            }
          }
        }
        plans.set(p.cle, plan)
      }
      // Une seule nouvelle version par séquence acceptée dans le lot.
      for (const sequenceId of touchees) {
        await tx.sequence.update({
          where: { id: sequenceId },
          data: { version: { increment: 1 } },
        })
      }
      return { annonces, deja, plans }
    },
    { timeout: 60_000 }
  )
}

/**
 * Complète la fiche d'une personne déjà importée, ou sa candidature quand elle
 * n'a pas de fiche. Une adresse ajoutée laisse la personne non joignable :
 * l'option « Prévenir par mail » passe à faux, et l'équipe la coche fiche par
 * fiche. Les plages réunies remplacent celles de la période.
 */
async function appliquerMiseAJour(
  tx: Prisma.TransactionClient,
  m: { cible: Cible; plan: PlanMiseAJour; editionId: string }
) {
  const { cible, plan, editionId } = m
  const donnees = {
    ...(plan.courriel === null
      ? {}
      : { courriel: plan.courriel, prevenirParMail: false }),
    ...(plan.telephone === null ? {} : { telephone: plan.telephone }),
    ...(plan.precisions === null
      ? {}
      : { precisionsDisponibilite: plan.precisions }),
  }
  if (cible.benevoleId !== null) {
    if (Object.keys(donnees).length > 0) {
      await tx.benevole.update({
        where: { id: cible.benevoleId },
        data: donnees,
      })
    }
    if (plan.plages !== null) {
      await tx.plageDisponibilite.deleteMany({
        where: { benevoleId: cible.benevoleId, editionId },
      })
      await tx.plageDisponibilite.createMany({
        data: plan.plages.map(pl => ({
          editionId,
          benevoleId: cible.benevoleId,
          debut: pl.debut,
          fin: pl.fin,
        })),
      })
    }
    return
  }
  if (Object.keys(donnees).length > 0) {
    await tx.candidature.update({
      where: { id: cible.candidatureId },
      data: donnees,
    })
  }
  if (plan.plages !== null) {
    await tx.plageDisponibilite.deleteMany({
      where: { candidatureId: cible.candidatureId },
    })
    await tx.plageDisponibilite.createMany({
      data: plan.plages.map(pl => ({
        editionId,
        candidatureId: cible.candidatureId,
        debut: pl.debut,
        fin: pl.fin,
      })),
    })
  }
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
