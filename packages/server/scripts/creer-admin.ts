import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'

import { mettreEnFile } from '../src/courriel/file.ts'
import { connection, courrielQueue } from '../src/jobs/queues.ts'

// Crée le premier compte admin, ou donne les droits d'admin à un compte existant,
// puis met en file le mail d'invitation. Le worker doit tourner pour l'envoyer.
//
// Poste local : yarn workspace @relaytour/server admin:creer adresse@exemple.fr "Prénom Nom"
// Conteneur :   node dist/creer-admin.js adresse@exemple.fr "Prénom Nom"
const [adresseBrute, nom] = process.argv.slice(2)
const adresse = adresseBrute?.trim().toLowerCase()

if (
  adresse === undefined ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse) ||
  !nom?.trim()
) {
  console.error('Usage : creer-admin <adresse> "<Prénom Nom>"')
  process.exit(1)
}

const personne = await prisma.user.upsert({
  where: { email: adresse },
  update: { isAdmin: true, archivedAt: null },
  create: { id: randomUUID(), email: adresse, name: nom.trim(), isAdmin: true },
  select: { id: true },
})

await mettreEnFile('invitation', { userId: personne.id })
await courrielQueue.close()
connection.disconnect()
await prisma.$disconnect()
console.log('✔ Compte admin prêt, invitation mise en file.')
