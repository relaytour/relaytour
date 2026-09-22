import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import { connection, planificationQueue } from '../src/jobs/queues.ts'
import { organisationParSlug } from '../src/lib/installation.ts'

// Lance tout de suite une tâche planifiée, sans attendre l'heure prévue. Le worker doit tourner.
//   yarn workspace @relaytour/server planification:lancer rappels|resumes|synchro [--organisation slug]
// Sans --organisation, rappels et résumés partent pour toutes les organisations actives.
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { organisation: { type: 'string' } },
})
const nom = positionals[0]
if (nom !== 'rappels' && nom !== 'resumes' && nom !== 'synchro') {
  console.error(
    'Usage : planification:lancer rappels|resumes|synchro [--organisation <slug>]'
  )
  process.exit(1)
}

try {
  const organisationId =
    values.organisation === undefined
      ? undefined
      : (await organisationParSlug(values.organisation)).id
  await planificationQueue.add(
    nom,
    organisationId === undefined ? {} : { organisationId }
  )
  console.log(
    `✔ Tâche « ${nom} » mise en file${values.organisation === undefined ? '' : ` pour ${values.organisation}`}.`
  )
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exitCode = 1
} finally {
  await planificationQueue.close()
  connection.disconnect()
  await prisma.$disconnect()
}
