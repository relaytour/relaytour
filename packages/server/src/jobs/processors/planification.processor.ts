import type { Job } from 'bullmq'

import { prisma } from '@relaytour/database'

import { mettreEnFile } from '../../courriel/file.ts'
import { aujourdhui } from '../../lib/droits.ts'
import { journal } from '../../lib/journal.ts'
import {
  genererRappels,
  personnesAResumer,
  type OrganisationPlanifiee,
} from '../planification.ts'
import type { PlanificationJobData, TachePlanifiee } from '../queues.ts'
import { synchroniserPlanification } from '../synchro.ts'

/**
 * Les organisations visées par un job : celle qu'il désigne, sinon toutes les
 * organisations actives (lancement manuel sans organisation). Une organisation en
 * lecture seule, suspendue ou archivée ne reçoit ni rappel ni résumé.
 */
async function organisationsVisees(
  data: PlanificationJobData
): Promise<OrganisationPlanifiee[]> {
  return prisma.organisation.findMany({
    where: {
      statut: 'ACTIVE',
      ...(data.organisationId === undefined ? {} : { id: data.organisationId }),
    },
    select: { id: true, fuseauHoraire: true },
  })
}

export async function planificationProcessor(
  job: Job<PlanificationJobData, unknown, TachePlanifiee>
): Promise<void> {
  if (job.name === 'synchro') {
    await synchroniserPlanification()
    return
  }

  for (const organisation of await organisationsVisees(job.data)) {
    const jour = aujourdhui(new Date(), organisation.fuseauHoraire)

    if (job.name === 'rappels') {
      for (const { userId, notificationIds } of await genererRappels(
        prisma,
        organisation
      )) {
        await mettreEnFile(
          'rappels-echeance',
          { userId },
          { notificationIds, organisationId: organisation.id }
        )
      }
    }

    if (job.name === 'resumes') {
      const personnes = await personnesAResumer(prisma, organisation)
      for (const userId of personnes) {
        // Un seul résumé par personne, par organisation et par jour, même si la
        // tâche est relancée. BullMQ refuse « : » dans un identifiant de job.
        await mettreEnFile(
          'resume',
          { userId },
          {
            jobId: `resume-${organisation.id}-${userId}-${jour}`,
            organisationId: organisation.id,
          }
        )
      }
      journal.info(
        {
          evenement: 'resumes-planifies',
          organisationId: organisation.id,
          personnes: personnes.length,
        },
        'Résumés mis en file.'
      )
    }
  }
}
