import http from 'node:http'

import { Worker } from 'bullmq'

import { verifierTransport } from './courriel/transport.ts'
import { env } from './env.ts'
import {
  connection,
  COURRIEL_QUEUE,
  PLANIFICATION_QUEUE,
  planificationQueue,
  type CourrielJobData,
  type TachePlanifiee,
} from './jobs/queues.ts'
import { courrielProcessor } from './jobs/processors/courriel.processor.ts'
import { planificationProcessor } from './jobs/processors/planification.processor.ts'
import { journal } from './lib/journal.ts'
import { assurerOrganisationParDefaut } from './lib/organisation.ts'

// Deux envois simultanés au plus, comme le pool SMTP.
const postier = new Worker<CourrielJobData>(COURRIEL_QUEUE, courrielProcessor, {
  connection,
  concurrency: 2,
})
const planificateur = new Worker<
  Record<string, never>,
  unknown,
  TachePlanifiee
>(PLANIFICATION_QUEUE, planificationProcessor, { connection })
const workers = [postier, planificateur]

void verifierTransport()
await assurerOrganisationParDefaut()

// La planification vit ici et nulle part ailleurs. `upsertJobScheduler` est idempotent :
// redémarrer le worker ne crée pas de doublon. Les heures sont celles de Paris.
void planificationQueue.upsertJobScheduler(
  'rappels',
  { pattern: '30 6 * * *', tz: 'Europe/Paris' },
  { name: 'rappels' }
)
void planificationQueue.upsertJobScheduler(
  'resumes',
  { pattern: '0 7 * * *', tz: 'Europe/Paris' },
  { name: 'resumes' }
)

// Sonde de vie du worker, jamais publiée sur l'hôte. Elle détecte une connexion Redis bloquée.
const sonde = http.createServer((_req, res) => {
  const vivant = workers.every(w => w.isRunning())
  res.writeHead(vivant ? 200 : 503, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      status: vivant ? 'ok' : 'down',
      queues: [COURRIEL_QUEUE, PLANIFICATION_QUEUE],
    })
  )
})
sonde.listen(env.WORKER_HEALTH_PORT, '127.0.0.1')

for (const w of workers) {
  w.on('ready', () => {
    journal.info(
      { evenement: 'worker-pret', queue: w.name },
      `Worker prêt pour la file « ${w.name} ».`
    )
  })
  w.on('failed', (job, err) => {
    const epuise =
      job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1)
    journal[epuise ? 'error' : 'warn'](
      {
        evenement: epuise ? 'job-abandonne' : 'job-echoue',
        queue: job?.queueName,
        jobId: job?.id,
        essais: job?.attemptsMade ?? 0,
        message: err.message,
      },
      epuise ? 'Job abandonné après épuisement des essais.' : 'Job en échec.'
    )
  })
}

let enCoursDArret = false
const arreter = () => {
  if (enCoursDArret) return
  enCoursDArret = true
  sonde.close()
  const couperCourt = setTimeout(() => process.exit(1), env.SHUTDOWN_TIMEOUT_MS)
  couperCourt.unref()
  void Promise.all(workers.map(w => w.close())).then(() => {
    connection.disconnect()
    process.exit(0)
  })
}
process.on('SIGINT', arreter)
process.on('SIGTERM', arreter)
