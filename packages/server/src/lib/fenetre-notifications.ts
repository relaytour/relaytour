import type {
  Notification,
  PrismaClient,
  StatutTache,
  TypeNotification,
} from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { avecDelai } from './delai.ts'
import { publierNotification } from './flux.ts'
import { journal } from './journal.ts'
import { pousser } from './push-file.ts'

// Fenêtre de regroupement des notifications de tâche (ADR 0065). Une notification
// de création, de modification, de statut, d'assignation ou de retrait attend la
// fin d'une fenêtre fixe de dix minutes. À la fin de la fenêtre, la consolidation
// compare l'état de la tâche avant et après : un retrait suivi d'un ajout de la
// même personne, ou un statut revenu à sa valeur de départ, ne laisse rien. Le
// push et le mail immédiat partent à ce moment, une fois par personne.

export const FENETRE_NOTIFICATIONS_MS = 10 * 60 * 1000
/** Marge après la fin de la fenêtre, pour qu'une écriture de la dernière seconde soit lue. */
const MARGE_MS = 5_000

/** Les types de notification qu'une fenêtre regroupe. Un commentaire reste immédiat. */
export const TYPES_REGROUPES: ReadonlySet<TypeNotification> = new Set([
  'TACHE_CREEE',
  'TACHE_MODIFIEE',
  'TACHE_STATUT',
  'TACHE_ASSIGNEE',
  'TACHE_DESASSIGNEE',
])

/** La fin de la fenêtre qui contient l'instant donné. */
export function finDeFenetre(instant = Date.now()): Date {
  return new Date(
    (Math.floor(instant / FENETRE_NOTIFICATIONS_MS) + 1) *
      FENETRE_NOTIFICATIONS_MS
  )
}

/**
 * Met en file la consolidation d'une tâche à la fin de sa fenêtre. Le premier
 * événement de la fenêtre place le job ; les suivants retrouvent son identifiant et
 * BullMQ les ignore. Ne lève jamais : sans file, les notifications deviennent
 * visibles tout de suite, sans regroupement, pour que rien ne se perde.
 */
export async function planifierConsolidation(
  prisma: PrismaClient,
  tacheId: string,
  fin: Date,
  maintenant = Date.now()
): Promise<void> {
  try {
    // Import paresseux : `queues.ts` valide l'environnement au chargement, et le
    // schéma doit pouvoir s'imprimer sans `.env` (invariant 12).
    const { planificationQueue } = await import('../jobs/queues.ts')
    await avecDelai(
      planificationQueue.add(
        'consolider-tache',
        { tacheId, fin: fin.toISOString() },
        {
          // BullMQ refuse « : » dans un identifiant de job.
          jobId: `consolider-${tacheId}-${fin.getTime()}`,
          delay: Math.max(0, fin.getTime() - maintenant) + MARGE_MS,
        }
      ),
      2_000,
      'File de planification'
    )
  } catch (erreur) {
    journal.error(
      {
        evenement: 'consolidation-indisponible',
        tacheId,
        message: (erreur as Error).message,
      },
      'La file de planification ne répond pas : les notifications de cette tâche partent sans regroupement.'
    )
    await consoliderTache(prisma, tacheId, fin, { sansRegroupement: true })
  }
}

type Ligne = Pick<
  Notification,
  | 'id'
  | 'userId'
  | 'organisationId'
  | 'type'
  | 'personneId'
  | 'acteurId'
  | 'statut'
  | 'mailEnAttente'
  | 'createdAt'
> & {
  /** Pour le mail immédiat : ce qui a changé dans la fenêtre. */
  changement?: 'contenu' | 'statut'
}

const MODIFICATIONS: ReadonlySet<TypeNotification> = new Set([
  'TACHE_MODIFIEE',
  'TACHE_STATUT',
])

/**
 * Ce qui reste des notifications d'une personne pour une tâche, une fois la fenêtre
 * finie. Fonction pure : elle reçoit l'état de la tâche avant et après la fenêtre.
 */
export function lignesNettes(
  lignes: readonly Ligne[],
  etat: {
    /** Les personnes assignées à la fin de la fenêtre. */
    assignees: ReadonlySet<string>
    /** Le contenu (titre, description, échéance) a changé dans la fenêtre. */
    contenuModifie: boolean
    /** Le statut de la fin de la fenêtre diffère de celui d'avant la fenêtre. */
    statutModifie: boolean
    /** Le statut à la fin de la fenêtre. */
    statutApres: StatutTache
  }
): Ligne[] {
  const triees = [...lignes].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )
  const gardees: Ligne[] = []

  // Une seule création.
  const creation = triees.find(l => l.type === 'TACHE_CREEE')
  if (creation) gardees.push(creation)

  // Assignations : la dernière ligne de chaque personne, si son état a changé.
  const parPersonne = new Map<string, Ligne[]>()
  for (const l of triees) {
    if (l.type !== 'TACHE_ASSIGNEE' && l.type !== 'TACHE_DESASSIGNEE') continue
    const cle = l.personneId ?? ''
    parPersonne.set(cle, [...(parPersonne.get(cle) ?? []), l])
  }
  for (const [personneId, suite] of parPersonne) {
    const avant = suite[0]!.type === 'TACHE_DESASSIGNEE'
    const apres = etat.assignees.has(personneId)
    if (avant !== apres) gardees.push(suite.at(-1)!)
  }

  // Modifications et statuts : une seule ligne, si la tâche a changé.
  const modifications = triees.filter(l => MODIFICATIONS.has(l.type))
  const { statutModifie } = etat
  if (modifications.length > 0 && (etat.contenuModifie || statutModifie)) {
    // Un statut changé garde la ligne de statut qui porte le statut final ; sinon,
    // la dernière modification.
    const ligneStatut = statutModifie
      ? [...modifications]
          .reverse()
          .find(l => l.type === 'TACHE_STATUT' && l.statut === etat.statutApres)
      : undefined
    const gardee = ligneStatut ?? modifications.at(-1)!
    // Le mail immédiat part si une des lignes l'attendait. Il annonce le statut
    // quand aucune ligne ne porte un changement de contenu : une modification née
    // d'un changement de statut porte ce statut.
    gardees.push({
      ...gardee,
      mailEnAttente: modifications.some(l => l.mailEnAttente),
      changement: modifications.some(
        l => l.type === 'TACHE_MODIFIEE' && l.statut === null
      )
        ? 'contenu'
        : 'statut',
    })
  }
  return gardees
}

/**
 * Consolide les notifications d'une tâche dont la fenêtre se termine à `fin`. Avec
 * `sansRegroupement`, les rend visibles telles quelles. Ne lève jamais.
 */
export async function consoliderTache(
  prisma: PrismaClient,
  tacheId: string,
  fin: Date,
  options: { sansRegroupement?: boolean } = {}
): Promise<void> {
  try {
    const lignes = await prisma.notification.findMany({
      where: { tacheId, disponibleLe: fin },
      select: {
        id: true,
        userId: true,
        organisationId: true,
        type: true,
        personneId: true,
        acteurId: true,
        statut: true,
        mailEnAttente: true,
        createdAt: true,
      },
    })
    if (lignes.length === 0) return
    const tache = await prisma.tache.findUnique({
      where: { id: tacheId },
      select: {
        statut: true,
        assignations: { select: { userId: true } },
      },
    })
    // Une tâche disparue ne laisse aucune notification.
    if (tache === null) {
      await prisma.notification.deleteMany({
        where: { id: { in: lignes.map(l => l.id) } },
      })
      return
    }
    let gardees: Ligne[] = lignes
    if (!options.sansRegroupement) {
      const debut = new Date(fin.getTime() - FENETRE_NOTIFICATIONS_MS)
      const evenements = await prisma.journal.findMany({
        where: {
          tacheId,
          type: { in: ['TACHE_MODIFIEE', 'TACHE_STATUT'] },
          createdAt: { gte: debut, lt: fin },
        },
        orderBy: { createdAt: 'asc' },
        select: { type: true, statutPrecedent: true },
      })
      const premierStatut = evenements.find(e => e.type === 'TACHE_STATUT')
      // Sans trace au journal, rien ne prouve que la tâche est revenue à son état :
      // la modification compte comme faite.
      const etat = {
        assignees: new Set(tache.assignations.map(a => a.userId)),
        contenuModifie:
          evenements.length === 0 ||
          evenements.some(e => e.type === 'TACHE_MODIFIEE'),
        // Un journal écrit avant la colonne ne connaît pas le statut d'avant : le
        // statut compte alors comme changé.
        statutModifie:
          premierStatut !== undefined &&
          premierStatut.statutPrecedent !== tache.statut,
        statutApres: tache.statut,
      }
      const parPersonne = new Map<string, Ligne[]>()
      for (const l of lignes) {
        parPersonne.set(l.userId, [...(parPersonne.get(l.userId) ?? []), l])
      }
      gardees = [...parPersonne.values()].flatMap(suite =>
        lignesNettes(suite, etat)
      )
    }
    const idsGardes = new Set(gardees.map(l => l.id))
    await prisma.notification.deleteMany({
      where: {
        id: { in: lignes.filter(l => !idsGardes.has(l.id)).map(l => l.id) },
      },
    })
    for (const l of gardees) {
      await prisma.notification.update({
        where: { id: l.id },
        data: { disponibleLe: null, mailEnAttente: false },
      })
    }
    const prevenus = new Set<string>()
    for (const l of gardees) {
      if (!prevenus.has(l.userId)) {
        publierNotification(l.organisationId, l.userId)
        prevenus.add(l.userId)
      }
      // Push (ADR 0024) : une modification d'une tâche assignée, et l'assignation
      // ou le retrait qui concerne le destinataire lui-même.
      const assignationPropre =
        (l.type === 'TACHE_ASSIGNEE' || l.type === 'TACHE_DESASSIGNEE') &&
        l.personneId === l.userId
      if (l.mailEnAttente || assignationPropre) await pousser(l.id)
      if (l.mailEnAttente) {
        await mettreEnFile(
          'tache-modifiee',
          { userId: l.userId },
          {
            tache: {
              tacheId,
              // Un passage à « faite » ne nomme personne (ADR 0028).
              ...(l.acteurId === null ? {} : { acteurId: l.acteurId }),
              changement:
                l.changement ??
                (l.type === 'TACHE_STATUT' || l.statut !== null
                  ? 'statut'
                  : 'contenu'),
            },
            notificationId: l.id,
            organisationId: l.organisationId,
          }
        )
      }
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'consolidation-echouee',
        tacheId,
        message: (erreur as Error).message,
      },
      'Les notifications d’une tâche n’ont pas pu être consolidées.'
    )
  }
}
