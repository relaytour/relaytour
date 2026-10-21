import type { Job } from 'bullmq'

import { prisma } from '@relaytour/database'

import { mettreEnFile } from '../../courriel/file.ts'
import { purgerBenevoles } from '../../lib/benevoles.ts'
import { exporterFiches } from '../../espace-fichiers/export.ts'
import { renouvelerAcces } from '../../espace-fichiers/index.ts'
import { purgerDemandes } from '../../lib/demandes.ts'
import { aujourdhui } from '../../lib/droits.ts'
import { journal } from '../../lib/journal.ts'
import { purgerDonneesTechniques, purgerMedias } from '../../lib/purge.ts'
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
  // L'export des fiches d'une organisation, après une modification (ADR 0038).
  // Sans organisation (lancement manuel), toutes les organisations actives.
  if (job.name === 'export-fiches') {
    for (const organisation of await organisationsVisees(job.data)) {
      await exporterFiches(organisation.id, { verifier: false })
    }
    return
  }
  // Chaque nuit, chaque espace de fichiers renouvelle son accès, qui expire sans
  // usage, puis réconcilie l'export de ses fiches. Une organisation en échec
  // n'empêche pas les suivantes.
  if (job.name === 'espace-fichiers') {
    const connexions = await prisma.connexionFichiers.findMany({
      where: {
        etat: 'ACTIVE',
        organisation: { statut: 'ACTIVE' },
        ...(job.data.organisationId === undefined
          ? {}
          : { organisationId: job.data.organisationId }),
      },
      select: { organisationId: true },
    })
    for (const { organisationId } of connexions) {
      try {
        await renouvelerAcces(organisationId)
        await exporterFiches(organisationId, { verifier: true })
      } catch (erreur) {
        journal.warn(
          {
            evenement: 'espace-fichiers-nuit-en-echec',
            organisationId,
            message: (erreur as Error).message,
          },
          'L’espace de fichiers d’une organisation n’a pas répondu cette nuit.'
        )
      }
    }
    return
  }
  // La purge ne dépend pas du statut d'une organisation : elle les parcourt toutes,
  // ou celle que le job désigne.
  if (job.name === 'purge') {
    await purgerDemandes(prisma, job.data)
    await purgerMedias(prisma, job.data)
    await purgerBenevoles(prisma, job.data)
    await purgerDonneesTechniques(prisma)
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
