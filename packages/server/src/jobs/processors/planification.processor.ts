import type { Job } from 'bullmq'

import { prisma } from '@relaytour/database'

import { mettreEnFile } from '../../courriel/file.ts'
import { aujourdhuiParis } from '../../lib/droits.ts'
import { journal } from '../../lib/journal.ts'
import { genererRappels, personnesAResumer } from '../planification.ts'
import type { TachePlanifiee } from '../queues.ts'

export async function planificationProcessor(
  job: Job<Record<string, never>, unknown, TachePlanifiee>
): Promise<void> {
  const jour = aujourdhuiParis()

  if (job.name === 'rappels') {
    for (const { userId, notificationIds } of await genererRappels(prisma)) {
      await mettreEnFile('rappels-echeance', { userId }, { notificationIds })
    }
    return
  }

  if (job.name === 'resumes') {
    const personnes = await personnesAResumer(prisma)
    for (const userId of personnes) {
      // Un seul résumé par personne et par jour, même si la tâche est relancée.
      await mettreEnFile(
        'resume',
        { userId },
        { jobId: `resume-${userId}-${jour}` }
      )
    }
    journal.info(
      { evenement: 'resumes-planifies', personnes: personnes.length },
      'Résumés mis en file.'
    )
  }
}
