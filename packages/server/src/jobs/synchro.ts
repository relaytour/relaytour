import { prisma } from '@relaytour/database'

import { journal } from '../lib/journal.ts'

import { planificationQueue, type TachePlanifiee } from './queues.ts'

// Planifications par organisation (ADR 0008).
//
// Chaque organisation active reçoit ses rappels à 6 h 30 et ses résumés à 7 h, à
// l'heure de son fuseau. Le worker ajuste les planifications à son démarrage, puis
// chaque heure : une organisation créée, suspendue ou qui change de fuseau est prise
// en compte dans l'heure. `upsertJobScheduler` est idempotent.

export const HEURES = {
  rappels: '30 6 * * *',
  resumes: '0 7 * * *',
} as const

/** Identifiant d'un scheduler. BullMQ refuse « : » dans un identifiant. */
export const nomPlanification = (
  tache: keyof typeof HEURES,
  organisationId: string
) => `${tache}-${organisationId}`

export async function synchroniserPlanification(
  // La file se remplace dans les tests, pour ne pas toucher aux planifications en place.
  file: Pick<
    typeof planificationQueue,
    'upsertJobScheduler' | 'getJobSchedulers' | 'removeJobScheduler'
  > = planificationQueue
): Promise<{
  actives: number
  retirees: number
}> {
  const organisations = await prisma.organisation.findMany({
    where: { statut: 'ACTIVE' },
    select: { id: true, fuseauHoraire: true },
  })
  const attendues = new Set<string>()
  for (const organisation of organisations) {
    for (const tache of ['rappels', 'resumes'] as const) {
      const nom = nomPlanification(tache, organisation.id)
      attendues.add(nom)
      await file.upsertJobScheduler(
        // Les types de BullMQ confondent l'identifiant du scheduler et le nom du job.
        nom as TachePlanifiee,
        { pattern: HEURES[tache], tz: organisation.fuseauHoraire },
        { name: tache, data: { organisationId: organisation.id } }
      )
    }
  }
  // Les planifications d'une organisation qui n'est plus active disparaissent, comme
  // les planifications globales d'avant l'ADR 0008 (« rappels », « resumes »).
  let retirees = 0
  for (const scheduler of await file.getJobSchedulers()) {
    const cle = scheduler.key
    if (cle === 'synchro' || attendues.has(cle)) continue
    await file.removeJobScheduler(cle)
    retirees += 1
  }
  journal.info(
    {
      evenement: 'planification-synchronisee',
      organisations: organisations.length,
      retirees,
    },
    'Planifications ajustées aux organisations actives.'
  )
  return { actives: organisations.length, retirees }
}
