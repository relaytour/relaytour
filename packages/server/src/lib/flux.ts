import { prisma } from '@relaytour/database'
import type { Redis } from 'ioredis'

import type { AppContext } from '../context.ts'

import { avecDelai } from './delai.ts'
import { peutLireFiche } from './fiches.ts'
import { journal } from './journal.ts'

// Flux des changements (ADR 0017).
//
// Une écriture publie un signal : « cette tâche, cette fiche, ce périmètre a changé ».
// Le signal ne porte aucune donnée, seulement des identifiants. Les navigateurs
// abonnés le reçoivent par un flux SSE, puis relisent leurs écrans par GraphQL, avec
// leurs droits. Le flux n'est donc qu'un accélérateur : sans lui, les écrans se
// relisent chaque minute (lib/rafraichissement.ts de l'espace organisateur).
//
// Le transport entre processus est le pub/sub de Valkey. Il n'est pas durable : un
// signal publié pendant qu'un navigateur se reconnecte est perdu, et la relecture
// périodique le rattrape.
//
// L'import de la connexion est paresseux : queues.ts valide l'environnement au
// chargement, et le schéma doit pouvoir s'imprimer sans .env (invariant 12).

export type EntiteChangee =
  'TACHE' | 'FICHE' | 'PERIMETRE' | 'EQUIPE' | 'DEMANDE' | 'NOTIFICATION'

export interface Changement {
  entite: EntiteChangee
  organisationId: string
  /** L'objet changé, quand il en existe un seul. */
  id?: string | null
  activiteId?: string | null
  perimetreId?: string | null
  editionId?: string | null
  /** Pour une notification : son seul destinataire. */
  destinataireId?: string | null
}

const PREFIXE = 'relaytour:changements:'
const canal = (organisationId: string) => `${PREFIXE}${organisationId}`

// La publication a sa propre connexion, sans file hors ligne ni reprise. La
// connexion de BullMQ garde les commandes en attente tant que Valkey est injoignable :
// chaque écriture y laisserait un signal en mémoire, publié trop tard au retour de
// Valkey. Ici, une publication échoue aussitôt quand Valkey ne répond pas.
let editeur: Promise<Redis> | null = null

async function ouvrirLEditeur(): Promise<Redis> {
  const { connection } = await import('../jobs/queues.ts')
  const connexion = connection.duplicate({
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    autoResendUnfulfilledCommands: false,
    commandTimeout: 1_000,
  })
  // Une panne se lit à chaque publication : l'événement lui-même ne dit rien de plus.
  connexion.on('error', () => undefined)
  // La connexion ne retient pas le processus : un script se termine sans la fermer.
  connexion.on('connect', () => {
    connexion.stream.unref()
  })
  if (connexion.status !== 'ready') {
    await avecDelai(
      new Promise<void>(ok => connexion.once('ready', ok)),
      1_000,
      'Connexion du flux'
    ).catch(() => undefined)
  }
  return connexion
}

/**
 * Publie un changement. Ne lève jamais et ne bloque pas la requête au-delà d'une
 * seconde : une panne de Valkey laisse l'écriture aboutir, et les écrans se relisent
 * à leur rythme (invariant 17). Le signal d'une écriture faite pendant la panne est
 * perdu : il n'attend pas le retour de Valkey.
 */
export async function publierChangement(changement: Changement): Promise<void> {
  try {
    editeur ??= ouvrirLEditeur()
    const connexion = await editeur
    if (connexion.status !== 'ready') throw new Error('Valkey ne répond pas')
    await avecDelai(
      connexion.publish(
        canal(changement.organisationId),
        JSON.stringify(changement)
      ),
      1_000,
      'Flux des changements'
    )
  } catch (erreur) {
    journal.warn(
      { evenement: 'flux-indisponible', message: (erreur as Error).message },
      'Un changement n’a pas pu être publié : les écrans se reliront à leur rythme.'
    )
  }
}

/**
 * Publie le changement d'un objet rangé dans un périmètre. L'organisation et
 * l'activité se lisent ici, après l'écriture : la mutation n'attend pas ce signal.
 */
export function publierPourPerimetre(
  entite: EntiteChangee,
  perimetreId: string,
  details: { id?: string; editionId?: string | null } = {}
): void {
  void (async () => {
    try {
      const perimetre = await prisma.perimetre.findUnique({
        where: { id: perimetreId },
        select: { organisationId: true, activiteId: true },
      })
      if (perimetre === null) return
      await publierChangement({
        entite,
        organisationId: perimetre.organisationId,
        activiteId: perimetre.activiteId,
        perimetreId,
        id: details.id ?? null,
        editionId: details.editionId ?? null,
      })
    } catch (erreur) {
      journal.warn(
        { evenement: 'flux-indisponible', message: (erreur as Error).message },
        'Un changement n’a pas pu être publié : les écrans se reliront à leur rythme.'
      )
    }
  })()
}

/** Publie le changement d'un objet rangé dans une activité, sans attendre. */
export function publierPourActivite(
  entite: EntiteChangee,
  organisationId: string,
  activiteId: string,
  details: {
    id?: string
    perimetreId?: string | null
    editionId?: string | null
  } = {}
): void {
  void publierChangement({
    entite,
    organisationId,
    activiteId,
    id: details.id ?? null,
    perimetreId: details.perimetreId ?? null,
    editionId: details.editionId ?? null,
  })
}

/** Publie une notification nouvelle pour son seul destinataire. */
export function publierNotification(
  organisationId: string,
  destinataireId: string
): void {
  void publierChangement({
    entite: 'NOTIFICATION',
    organisationId,
    destinataireId,
  })
}

/**
 * Vrai quand la personne du contexte peut recevoir ce signal. Le signal ne porte
 * aucune donnée, mais il dit qu'une chose existe et vient de changer : il suit donc
 * les droits de lecture.
 *
 * - Une notification va à son seul destinataire.
 * - Une demande va aux admins de son activité, qui seuls lisent les demandes.
 * - Une fiche va aux personnes qui peuvent la lire : une fiche de périmètre ne se
 *   lit pas en consultation, à la différence des tâches (ADR 0014).
 * - Tout autre changement va aux personnes qui voient l'activité.
 */
export async function peutRecevoir(
  ctx: AppContext,
  changement: Changement
): Promise<boolean> {
  if (ctx.personne === null || ctx.organisation === null) return false
  if (changement.organisationId !== ctx.organisation.id) return false
  if (changement.entite === 'NOTIFICATION') {
    return changement.destinataireId === ctx.personne.id
  }
  const activiteId = changement.activiteId
  if (activiteId === null || activiteId === undefined) return false
  if (changement.entite === 'DEMANDE') return ctx.estAdminDe(activiteId)
  if (changement.entite === 'FICHE') {
    return peutLireFiche(ctx, {
      organisationId: changement.organisationId,
      activiteId,
      perimetreId: changement.perimetreId ?? null,
    })
  }
  return (await ctx.activitesVisibles()).has(activiteId)
}

// ── Écoute ───────────────────────────────────────────────────────────────────
//
// Un seul abonné par processus : une connexion dédiée, car une connexion Redis
// abonnée ne sert plus à rien d'autre. Elle s'ouvre au premier flux et se referme à
// l'arrêt du serveur.

type Ecouteur = (changement: Changement) => void

const ecouteurs = new Set<Ecouteur>()
let abonne: Promise<Redis> | null = null

function lireChangement(message: string): Changement | null {
  try {
    const lu = JSON.parse(message) as Partial<Changement> | null
    return lu !== null &&
      typeof lu.entite === 'string' &&
      typeof lu.organisationId === 'string'
      ? (lu as Changement)
      : null
  } catch {
    return null
  }
}

async function ouvrirLAbonne(): Promise<Redis> {
  const { connection } = await import('../jobs/queues.ts')
  const connexion = connection.duplicate()
  connexion.on(
    'pmessage',
    (_motif: string, _canal: string, message: string) => {
      const changement = lireChangement(message)
      if (changement === null) return
      for (const ecouteur of ecouteurs) ecouteur(changement)
    }
  )
  connexion.on('error', (erreur: Error) => {
    journal.warn(
      { evenement: 'flux-abonne-en-panne', message: erreur.message },
      'L’abonné du flux a perdu Valkey : il se reconnecte.'
    )
  })
  try {
    await avecDelai(
      connexion.psubscribe(`${PREFIXE}*`),
      2_000,
      'Abonnement au flux'
    )
  } catch (erreur) {
    // Sans cette fermeture, chaque essai laisserait une connexion qui finirait par
    // s'abonner au retour de Valkey, et livrerait les mêmes signaux plusieurs fois.
    connexion.disconnect()
    throw erreur
  }
  return connexion
}

/**
 * Écoute les changements publiés, tous canaux confondus : l'appelant filtre. Renvoie
 * de quoi cesser l'écoute. Lève si Valkey ne répond pas : le flux ne s'ouvre pas, et
 * le navigateur garde sa relecture périodique.
 */
export async function ecouterLesChangements(
  ecouteur: Ecouteur
): Promise<() => void> {
  if (abonne === null) {
    abonne = ouvrirLAbonne()
    // Un échec ne se garde pas : le flux suivant réessaie.
    abonne.catch(() => {
      abonne = null
    })
  }
  await abonne
  ecouteurs.add(ecouteur)
  return () => {
    ecouteurs.delete(ecouteur)
  }
}

// ── Flux ouverts ─────────────────────────────────────────────────────────────

/** Flux qu'une même personne peut garder ouverts : quelques onglets. */
export const FLUX_PAR_PERSONNE = 4
/** Durée d'un flux. Le serveur le ferme ensuite, et le navigateur en rouvre un. */
export const DUREE_FLUX_MS = 15 * 60 * 1000
/** Rythme auquel un flux relit les droits de sa personne. */
export const RELECTURE_DROITS_MS = 60 * 1000

const ouverts = new Map<string, Set<AbortController>>()

/**
 * Réserve un flux pour la personne, ou renvoie null quand elle en a déjà trop. Le
 * contrôleur ferme le flux ; `liberer` rend la place.
 */
export function reserverUnFlux(
  personneId: string
): { controleur: AbortController; liberer: () => void } | null {
  const siens = ouverts.get(personneId) ?? new Set<AbortController>()
  if (siens.size >= FLUX_PAR_PERSONNE) return null
  const controleur = new AbortController()
  siens.add(controleur)
  ouverts.set(personneId, siens)
  return {
    controleur,
    liberer: () => {
      siens.delete(controleur)
      if (siens.size === 0) ouverts.delete(personneId)
    },
  }
}

/** Signaux qu'un flux garde en attente. Au-delà, il les laisse à la relecture périodique. */
const FILE_MAX = 200

/**
 * Ouvre le flux d'une personne : un itérateur des changements qu'elle peut recevoir.
 * Renvoie null quand elle a déjà trop de flux ouverts. Lève si Valkey ne répond pas.
 *
 * Le flux se ferme à la demande du client (`return`), à l'arrêt du serveur, après
 * `dureeMs`, ou quand la personne n'a plus de contexte : compte archivé,
 * organisation suspendue, appartenance retirée. `relireLeContexte` reconstruit le
 * contexte, dont les droits se mémorisent par requête : le flux l'appelle au plus
 * une fois par `relectureMs`.
 */
export async function ouvrirLeFlux(
  contexte: AppContext,
  options: {
    relireLeContexte: () => Promise<AppContext>
    dureeMs?: number
    relectureMs?: number
  }
): Promise<AsyncIterableIterator<Changement> | null> {
  const { personne, organisation } = contexte
  if (personne === null || organisation === null) return null
  const place = reserverUnFlux(personne.id)
  if (place === null) return null
  const relectureMs = options.relectureMs ?? RELECTURE_DROITS_MS

  const file: Changement[] = []
  let reveiller: (() => void) | null = null
  let ferme = false
  let cesser: (() => void) | null = null
  let ctx = contexte
  let droitsLusLe = Date.now()

  const fermer = () => {
    if (ferme) return
    ferme = true
    cesser?.()
    place.liberer()
    clearTimeout(echeance)
    place.controleur.signal.removeEventListener('abort', fermer)
    reveiller?.()
  }
  const echeance = setTimeout(fermer, options.dureeMs ?? DUREE_FLUX_MS)
  echeance.unref()
  place.controleur.signal.addEventListener('abort', fermer)

  try {
    cesser = await ecouterLesChangements(changement => {
      // Le premier tri se fait ici, sans requête : l'organisation.
      if (changement.organisationId !== organisation.id) return
      if (file.length < FILE_MAX) file.push(changement)
      reveiller?.()
    })
  } catch (erreur) {
    fermer()
    throw erreur
  }
  // Le flux a pu se fermer pendant l'abonnement.
  if (ferme) cesser()

  const fin = { done: true as const, value: undefined }
  const flux: AsyncIterableIterator<Changement> = {
    [Symbol.asyncIterator]: () => flux,
    async next() {
      for (;;) {
        if (ferme) return fin
        const changement = file.shift()
        if (changement === undefined) {
          await new Promise<void>(ok => {
            reveiller = ok
          })
          reveiller = null
          continue
        }
        if (Date.now() - droitsLusLe >= relectureMs) {
          ctx = await options.relireLeContexte()
          droitsLusLe = Date.now()
          if (ctx.personne === null || ctx.organisation === null) {
            fermer()
            return fin
          }
        }
        if (await peutRecevoir(ctx, changement)) {
          return { done: false, value: changement }
        }
      }
    },
    // Le client s'en va : la place se libère aussitôt, sans attendre un signal.
    return() {
      fermer()
      return Promise.resolve(fin)
    },
    throw(erreur: unknown) {
      fermer()
      return Promise.reject(
        erreur instanceof Error ? erreur : new Error(String(erreur))
      )
    },
  }
  return flux
}

/** Le nombre de flux ouverts dans ce processus. */
export function nombreDeFlux(): number {
  let total = 0
  for (const siens of ouverts.values()) total += siens.size
  return total
}

/**
 * Ferme tous les flux et l'abonné. À appeler avant l'arrêt du serveur HTTP : une
 * connexion SSE ouverte retiendrait l'arrêt jusqu'à son délai.
 */
export async function fermerLesFlux(): Promise<void> {
  for (const siens of ouverts.values()) {
    for (const controleur of siens) controleur.abort()
  }
  ecouteurs.clear()
  const publication = editeur
  editeur = null
  if (publication !== null) {
    await publication.then(
      connexion => {
        connexion.disconnect()
      },
      () => undefined
    )
  }
  const enCours = abonne
  abonne = null
  if (enCours !== null) {
    await enCours
      .then(
        connexion => avecDelai(connexion.quit(), 1_000, 'Fermeture du flux'),
        () => undefined
      )
      .catch(() => undefined)
  }
}
