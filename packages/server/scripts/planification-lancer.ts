import { connection, planificationQueue } from '../src/jobs/queues.ts'

// Lance tout de suite une tâche planifiée, sans attendre l'heure prévue. Le worker doit tourner.
//   yarn workspace @relaytour/server planification:lancer rappels|resumes
const nom = process.argv[2]
if (nom !== 'rappels' && nom !== 'resumes') {
  console.error('Usage : planification:lancer rappels|resumes')
  process.exit(1)
}

await planificationQueue.add(nom, {})
await planificationQueue.close()
connection.disconnect()
console.log(`✔ Tâche « ${nom} » mise en file.`)
