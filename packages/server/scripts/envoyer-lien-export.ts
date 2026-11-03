import { text } from 'node:stream/consumers'

import { prisma } from '@relaytour/database'

import { envoyerLienDExport } from '../src/lib/export-pour-admin.ts'

// Envoie le lien d'un export préparé par la mutation preparerExportPourAdmin
// (ADR 0057). La commande se lance dans le conteneur du worker, le seul qui reçoit le
// SMTP, pendant le réveil d'une installation en sommeil.
//
// Le jeton se lit sur l'entrée standard, jamais dans les arguments : une ligne de
// commande se lit dans la liste des processus de la machine.
//
// Conteneur : printf '%s' "$JETON" | node dist/envoyer-lien-export.js <organisation>
const slug = process.argv[2]
if (slug === undefined || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage : envoyer-lien-export <organisation> < jeton')
  process.exit(1)
}
const jeton = (await text(process.stdin)).trim()
if (!/^[A-Za-z0-9_-]{43}$/.test(jeton)) {
  console.error('Le jeton lu sur l’entrée standard est invalide.')
  process.exit(1)
}

const { connection, courrielQueue } = await import('../src/jobs/queues.ts')
let code = 0
try {
  await envoyerLienDExport(prisma, slug, jeton)
  console.log('✔ Lien d’export envoyé.')
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  code = 1
} finally {
  await courrielQueue.close()
  connection.disconnect()
  await prisma.$disconnect()
}
process.exit(code)
