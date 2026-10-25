import {
  prisma,
  type AttendusDossier,
  type EtatAccesFournisseur,
  type EtatCompteFournisseur,
} from '@relaytour/database'

import { membreActif } from '../lib/appartenances.ts'
import { avecDelai } from '../lib/delai.ts'
import { publierChangement } from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'

import {
  perimetresDesLecteurs,
  SELECTION_LECTEURS,
  type LecteursDossier,
} from './droits.ts'
import { ouvrirEspace } from './index.ts'
import {
  annoncerPropositions,
  elaguerPermissions,
  mettreAJourPropositions,
} from './propositions.ts'
import {
  AccesRetire,
  type AnnuaireFournisseur,
  type CompteAnnuaire,
  type DroitElement,
  type Fournisseur,
} from './types.ts'

// Vérification des accès chez le fournisseur (ADR 0044). Relaytour compare les
// personnes qu'un dossier lié attend aux droits de ce dossier chez le fournisseur.
// Il cherche dans l'annuaire les seules adresses des membres de l'organisation,
// et ne garde des autres comptes qu'un nom. Rien ne change chez le fournisseur.

/** Les accès en trop gardés pour un dossier, au plus. */
const EN_TROP_MAX = 200

/** Une personne qu'un dossier lié attend chez le fournisseur. */
export interface PersonneAttendue {
  userId: string
  email: string
}

/**
 * Les personnes qu'un dossier lié attend : celles des périmètres de ses lecteurs
 * pour la période en préparation ou en cours la plus récente, comme l'organigramme
 * (ADR 0036). Avec `CONTACTS_PRINCIPAUX`, les contacts principaux seulement. Un
 * dossier de toute l'activité attend aussi les admins de l'activité.
 */
export async function personnesAttendues(
  organisationId: string,
  dossier: LecteursDossier & { activiteId: string; attendus: AttendusDossier }
): Promise<PersonneAttendue[]> {
  const actif = membreActif(organisationId)
  const designes = await perimetresDesLecteurs(dossier)
  const edition = await prisma.edition.findFirst({
    where: { activiteId: dossier.activiteId, statut: { not: 'ARCHIVEE' } },
    orderBy: { annee: 'desc' },
    select: { id: true },
  })
  const [affectations, admins] = await Promise.all([
    edition === null
      ? []
      : prisma.affectation.findMany({
          where: {
            editionId: edition.id,
            perimetre:
              designes === null
                ? { activiteId: dossier.activiteId, archivedAt: null }
                : { id: { in: designes } },
            user: actif,
            ...(dossier.attendus === 'CONTACTS_PRINCIPAUX'
              ? { contactPrincipal: true }
              : {}),
          },
          select: { user: { select: { id: true, email: true } } },
        }),
    designes === null
      ? prisma.adminActivite.findMany({
          where: { activiteId: dossier.activiteId, user: actif },
          select: { user: { select: { id: true, email: true } } },
        })
      : [],
  ])
  const personnes = new Map<string, PersonneAttendue>()
  for (const { user } of [...affectations, ...admins]) {
    personnes.set(user.id, { userId: user.id, email: user.email })
  }
  return [...personnes.values()]
}

/** Comment une personne a accès : « direct », « domaine », ou « groupe:<nom> ». */
type Voie = string

interface DroitsLus {
  /** Les droits tels que le fournisseur les rend. */
  droits: DroitElement[]
  /** Les voies par identifiant de compte (`id:`) ou par adresse (`adr:`). */
  voies: Map<string, Voie>
  /** Les noms des comptes qui ont un droit, par la même clé. */
  noms: Map<string, string>
  /** Vrai pour un droit de toute l'organisation du fournisseur. */
  domaine: boolean
  /** Les domaines nommés (`exemple.org`) qui ont un droit. */
  domaines: Set<string>
  /** Vrai quand un groupe ne se lit pas : il couvre peut-être d'autres personnes. */
  inconnu: boolean
}

const cleId = (identifiant: string) => `id:${identifiant}`
const cleAdresse = (adresse: string) => `adr:${adresse.toLowerCase()}`

/** Un nom d'accès en trop, sans adresse : un compte sans nom affiché reste anonyme. */
const nomSansAdresse = (nom: string) =>
  nom.includes('@') ? i18n._('Compte sans nom affiché') : nom.slice(0, 255)

/** Les droits d'un dossier, ou null quand le fournisseur ne les rend pas en entier. */
async function lireDroits(
  annuaire: AnnuaireFournisseur,
  dossier: { emplacement: string; element: string },
  groupes: Map<string, Promise<CompteAnnuaire[] | null>>
): Promise<DroitsLus | null> {
  const lus: DroitsLus = {
    droits: [],
    voies: new Map(),
    noms: new Map(),
    domaine: false,
    domaines: new Set(),
    inconnu: false,
  }
  const ajouter = (cles: string[], nom: string, voie: Voie) => {
    for (const cle of cles) {
      // Un droit direct l'emporte sur un groupe.
      if (!lus.voies.has(cle) || voie === 'direct') lus.voies.set(cle, voie)
    }
    if (cles[0] !== undefined && !lus.noms.has(cles[0])) {
      lus.noms.set(cles[0], nom)
    }
  }
  const droits = await annuaire.droits({
    emplacement: dossier.emplacement,
    base: dossier.element,
    chemin: [],
  })
  if (droits === null) return null
  lus.droits = droits
  for (const { beneficiaire: b } of droits) {
    if (b.type === 'domaine') {
      if (b.domaine === undefined) lus.domaine = true
      else lus.domaines.add(b.domaine.toLowerCase())
    }
    if (b.type === 'personne') {
      const cles = [
        ...(b.identifiant === null ? [] : [cleId(b.identifiant)]),
        ...(b.adresse === null ? [] : [cleAdresse(b.adresse)]),
      ]
      ajouter(cles, b.nom, 'direct')
    }
    if (b.type === 'groupe') {
      let membres = groupes.get(b.identifiant)
      if (membres === undefined) {
        membres = annuaire.capacites.membresDeGroupe
          ? annuaire.membresDuGroupe(b.identifiant)
          : Promise.resolve(null)
        groupes.set(b.identifiant, membres)
      }
      const lusDuGroupe = await membres
      if (lusDuGroupe === null) {
        lus.inconnu = true
        continue
      }
      for (const m of lusDuGroupe) {
        ajouter(
          [cleId(m.identifiant), cleAdresse(m.adresse)],
          m.nom,
          `groupe:${b.nom}`
        )
      }
    }
  }
  return lus
}

/**
 * Rapproche les personnes de leur compte chez le fournisseur et garde le résultat.
 * Une adresse saisie par un admin remplace celle de la personne.
 */
async function rapprocherComptes(
  organisationId: string,
  fournisseur: Fournisseur,
  annuaire: AnnuaireFournisseur,
  personnes: PersonneAttendue[]
): Promise<{
  comptes: Map<string, CompteAnnuaire | null>
  adresses: Map<string, string>
}> {
  const existants = await prisma.compteFournisseur.findMany({
    where: {
      organisationId,
      fournisseur,
      userId: { in: personnes.map(p => p.userId) },
    },
    select: { userId: true, adresseSaisie: true },
  })
  const saisies = new Map(existants.map(c => [c.userId, c.adresseSaisie]))
  const adresseDe = (p: PersonneAttendue) =>
    (saisies.get(p.userId) ?? p.email).toLowerCase()
  // Sans annuaire, chaque personne vaut par son adresse : un droit à cette
  // adresse la couvre, et aucun compte ne se garde.
  if (!annuaire.capacites.comptes) {
    return {
      comptes: new Map(
        personnes.map(p => [
          p.userId,
          {
            identifiant: adresseDe(p),
            adresse: adresseDe(p),
            nom: adresseDe(p),
            invite: false,
          },
        ])
      ),
      adresses: new Map(personnes.map(p => [p.userId, adresseDe(p)])),
    }
  }
  const trouves = await annuaire.chercherComptes([
    ...new Set(personnes.map(adresseDe)),
  ])
  const parPersonne = new Map<string, CompteAnnuaire | null>()
  const adresses = new Map<string, string>()
  const maintenant = new Date()
  for (const p of personnes) {
    const compte = trouves.get(adresseDe(p)) ?? null
    parPersonne.set(p.userId, compte)
    adresses.set(p.userId, adresseDe(p))
    const etat: EtatCompteFournisseur =
      compte === null ? 'ABSENT' : compte.invite ? 'INVITE' : 'TROUVE'
    await prisma.compteFournisseur.upsert({
      where: {
        organisationId_fournisseur_userId: {
          organisationId,
          fournisseur,
          userId: p.userId,
        },
      },
      create: {
        organisationId,
        fournisseur,
        userId: p.userId,
        etat,
        identifiant: compte?.identifiant ?? null,
        verifieLe: maintenant,
      },
      update: {
        etat,
        identifiant: compte?.identifiant ?? null,
        verifieLe: maintenant,
      },
    })
  }
  return { comptes: parPersonne, adresses }
}

/** Remplace l'état des accès d'un dossier par celui de la vérification. */
async function remplacerEtats(
  organisationId: string,
  dossierLieId: string,
  lignes: {
    userId: string | null
    nom: string | null
    etat: EtatAccesFournisseur
    via: string | null
  }[]
): Promise<void> {
  const verifieLe = new Date()
  await prisma.$transaction([
    prisma.etatAccesDossier.deleteMany({ where: { dossierLieId } }),
    prisma.etatAccesDossier.createMany({
      data: lignes.map(l => ({
        organisationId,
        dossierLieId,
        verifieLe,
        ...l,
      })),
    }),
  ])
}

/**
 * Vérifie les accès de chaque dossier lié d'une organisation chez son fournisseur.
 * Ne fait rien sans connexion active qui lit l'annuaire. Une erreur reste dans la
 * connexion, pour l'écran « Fournisseur cloud », puis remonte.
 */
export async function verifierAcces(organisationId: string): Promise<void> {
  const connexion = await prisma.connexionFichiers.findUnique({
    where: { organisationId },
    select: { etat: true, portee: true },
  })
  if (connexion?.etat !== 'ACTIVE' || connexion.portee === 'FICHIERS') return
  try {
    const { espace } = await ouvrirEspace(organisationId)
    const annuaire = espace.annuaire
    if (annuaire === undefined) return
    // Un ancien membre ne garde ni compte ni adresse saisie.
    await prisma.compteFournisseur.deleteMany({
      where: { organisationId, user: { NOT: membreActif(organisationId) } },
    })
    const dossiers = await prisma.dossierLie.findMany({
      where: { organisationId, fournisseur: espace.fournisseur },
      select: {
        id: true,
        activiteId: true,
        emplacement: true,
        element: true,
        attendus: true,
        accesFournisseur: true,
        groupeFournisseurId: true,
        ajoutsAutomatiques: true,
        ...SELECTION_LECTEURS,
      },
    })
    const attendus = new Map<string, PersonneAttendue[]>()
    for (const d of dossiers) {
      attendus.set(d.id, await personnesAttendues(organisationId, d))
    }
    const personnes = [
      ...new Map(
        [...attendus.values()].flat().map(p => [p.userId, p])
      ).values(),
    ]
    const { comptes, adresses } = await rapprocherComptes(
      organisationId,
      espace.fournisseur,
      annuaire,
      personnes
    )
    const groupes = new Map<string, Promise<CompteAnnuaire[] | null>>()
    const membres = (groupe: string) => {
      let lus = groupes.get(groupe)
      if (lus === undefined) {
        lus = annuaire.membresDuGroupe(groupe)
        groupes.set(groupe, lus)
      }
      return lus
    }
    // Première passe : les droits de chaque dossier. Un dossier dont les droits
    // ne se lisent pas, ou dont la lecture échoue, reste « Inconnu » sans arrêter
    // les autres.
    const droitsDe = new Map<string, DroitsLus | null>()
    let illisibles = 0
    for (const d of dossiers) {
      let lus: DroitsLus | null
      try {
        lus = await lireDroits(annuaire, d, groupes)
      } catch (erreur) {
        if (erreur instanceof AccesRetire) throw erreur
        journal.warn(
          {
            evenement: 'acces-fournisseur-dossier-illisible',
            organisationId,
            dossierLieId: d.id,
            message: (erreur as Error).message,
          },
          'Les droits d’un dossier lié ne se lisent pas chez le fournisseur.'
        )
        lus = null
      }
      if (lus === null) illisibles += 1
      droitsDe.set(d.id, lus)
    }
    // Les groupes par lesquels chaque dossier ouvre ses droits : sortir une
    // personne d'un groupe lui couperait aussi les autres dossiers du groupe.
    const groupesDe = new Map(
      dossiers.map(d => [
        d.id,
        new Set([
          ...(droitsDe.get(d.id)?.droits ?? []).flatMap(x =>
            x.beneficiaire.type === 'groupe' ? [x.beneficiaire.identifiant] : []
          ),
          ...(d.groupeFournisseurId === null ? [] : [d.groupeFournisseurId]),
        ]),
      ])
    )
    let aValider = 0
    for (const d of dossiers) {
      const lus = droitsDe.get(d.id) ?? null
      if (lus === null) {
        await remplacerEtats(
          organisationId,
          d.id,
          (attendus.get(d.id) ?? []).map(p => ({
            userId: p.userId,
            nom: null,
            etat: 'INCONNU' as const,
            via: null,
          }))
        )
        continue
      }
      const vus = new Set<string>()
      const lignes: {
        userId: string | null
        nom: string | null
        etat: EtatAccesFournisseur
        via: string | null
      }[] = []
      for (const p of attendus.get(d.id) ?? []) {
        const compte = comptes.get(p.userId) ?? null
        if (compte === null) {
          // Un partage par adresse couvre aussi une personne que l'annuaire ne
          // connaît pas encore : le fournisseur l'invitera à sa connexion.
          const cle = cleAdresse(adresses.get(p.userId) ?? p.email)
          vus.add(cle)
          const voie = lus.voies.get(cle)
          lignes.push({
            userId: p.userId,
            nom: null,
            etat: voie === undefined ? 'SANS_COMPTE' : 'A_ACCES',
            via: voie ?? null,
          })
          continue
        }
        const cles = [cleId(compte.identifiant), cleAdresse(compte.adresse)]
        for (const cle of cles) vus.add(cle)
        const voie =
          cles.map(c => lus.voies.get(c)).find(v => v !== undefined) ??
          ((lus.domaine && !compte.invite) ||
          lus.domaines.has(compte.adresse.split('@').pop() ?? '')
            ? 'domaine'
            : undefined)
        lignes.push({
          userId: p.userId,
          nom: null,
          etat:
            voie !== undefined
              ? 'A_ACCES'
              : lus.inconnu
                ? 'INCONNU'
                : 'SANS_ACCES',
          via: voie ?? null,
        })
      }
      // Les accès en trop : un droit, direct ou par un groupe, que personne
      // n'attend. Ils gardent un nom, sans adresse.
      const enTrop = new Map<string, { nom: string; via: string }>()
      for (const [cle, nom] of lus.noms) {
        if (vus.has(cle)) continue
        enTrop.set(cle, { nom, via: lus.voies.get(cle) ?? 'direct' })
      }
      for (const { nom, via } of [...enTrop.values()].slice(0, EN_TROP_MAX)) {
        lignes.push({
          userId: null,
          nom: nomSansAdresse(nom),
          etat: 'EN_TROP',
          via: nomSansAdresse(via),
        })
      }
      await remplacerEtats(organisationId, d.id, lignes)
      // Les propositions d'accès, quand le dossier en demande (ADR 0044).
      await elaguerPermissions(d.id, lus.droits, membres)
      aValider += await mettreAJourPropositions(
        organisationId,
        d,
        lignes,
        annuaire,
        (groupe, userId) =>
          dossiers.some(
            o =>
              o.id !== d.id &&
              groupesDe.get(o.id)?.has(groupe) === true &&
              (attendus.get(o.id) ?? []).some(p => p.userId === userId)
          )
      )
    }
    if (aValider > 0) await annoncerPropositions(organisationId)
    await prisma.connexionFichiers.update({
      where: { organisationId },
      data: {
        accesVerifieLe: new Date(),
        accesErreur:
          illisibles === 0
            ? null
            : i18n._(
                '{nombre, plural, one {Relaytour ne lit pas les droits de un dossier lié chez le fournisseur. Leurs personnes restent « Inconnu ».} other {Relaytour ne lit pas les droits de # dossiers liés chez le fournisseur. Leurs personnes restent « Inconnu ».}}',
                { nombre: illisibles }
              ),
      },
    })
    journal.info(
      {
        evenement: 'acces-fournisseur-verifies',
        organisationId,
        dossiers: dossiers.length,
      },
      'Les accès chez le fournisseur sont vérifiés.'
    )
  } catch (erreur) {
    await prisma.connexionFichiers.updateMany({
      where: { organisationId },
      data: {
        accesErreur: i18n._(
          'Le fournisseur n’a pas permis la vérification. Réessayez, ou reconnectez le fournisseur avec la vérification des accès.'
        ),
      },
    })
    journal.warn(
      {
        evenement: 'acces-fournisseur-en-echec',
        organisationId,
        message: (erreur as Error).message,
      },
      'La vérification des accès chez le fournisseur a échoué.'
    )
    throw erreur
  } finally {
    void publierChangement({ entite: 'FICHIERS', organisationId })
  }
}

/** Ce que `planifierUnique` lit d'une file BullMQ. */
export interface FileUnique {
  getJob(
    id: string
  ): Promise<
    | { getState(): Promise<string>; remove(): Promise<unknown> }
    | undefined
    | null
  >
  add(
    nom: 'acces-fournisseur',
    donnees: { organisationId: string },
    options: { jobId: string; delay: number }
  ): Promise<unknown>
}

/** Le délai qui regroupe les demandes rapprochées d'une organisation. */
const REGROUPEMENT_MS = 5_000

/**
 * Met en file une vérification par organisation. Un job en attente regroupe les
 * demandes rapprochées. Un job terminé laisse sa place, et un job en cours
 * reçoit une suite : aucune demande ne se perd jusqu'à la nuit.
 */
export async function planifierUnique(
  file: FileUnique,
  id: string,
  organisationId: string
): Promise<void> {
  for (const candidat of [id, `${id}-suite`]) {
    const existant = await file.getJob(candidat)
    if (existant) {
      const etat = await existant.getState()
      if (etat === 'waiting' || etat === 'delayed' || etat === 'prioritized') {
        return
      }
      // Un job en cours ne se remplace pas : la suite prend le relais.
      if (etat === 'active') continue
      await existant.remove()
    }
    await file.add(
      'acces-fournisseur',
      { organisationId },
      { jobId: candidat, delay: REGROUPEMENT_MS }
    )
    return
  }
}

/**
 * Planifie la vérification des accès d'une organisation, regroupée sur quelques
 * secondes. Ne lève jamais et ne retient pas la requête au-delà d'une seconde.
 */
export function planifierVerificationAcces(organisationId: string): void {
  void (async () => {
    const connexion = await prisma.connexionFichiers.findUnique({
      where: { organisationId },
      select: { etat: true, portee: true },
    })
    if (connexion?.etat !== 'ACTIVE' || connexion.portee === 'FICHIERS') return
    const { planificationQueue } = await import('../jobs/queues.ts')
    await avecDelai(
      planifierUnique(
        planificationQueue,
        // BullMQ refuse « : » dans un identifiant de job.
        `acces-fournisseur-${organisationId}`,
        organisationId
      ),
      1_000,
      'Vérification des accès'
    )
  })().catch((erreur: unknown) => {
    journal.warn(
      {
        evenement: 'acces-fournisseur-non-planifie',
        organisationId,
        message: (erreur as Error).message,
      },
      'La vérification des accès n’a pas pu être planifiée : celle de la nuit la rattrapera.'
    )
  })
}
