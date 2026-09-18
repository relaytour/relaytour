import { mettreEnFile } from '../src/courriel/file.ts'
import { connection, courrielQueue } from '../src/jobs/queues.ts'

// Met en file un mail d'essai vers l'adresse donnée. Le worker doit tourner pour l'envoyer.
// Usage : yarn workspace @relaytour/server courriel:essai adresse@exemple.fr
const destinataire = process.argv[2]
if (destinataire === undefined || !destinataire.includes('@')) {
  console.error('Usage : courriel:essai <adresse>')
  process.exit(1)
}

await mettreEnFile('essai', { destinataire })
await courrielQueue.close()
connection.disconnect()
console.log('✔ Mail d’essai mis en file.')
