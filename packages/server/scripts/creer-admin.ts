import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import { mettreEnFile } from '../src/courriel/file.ts'
import { connection, courrielQueue } from '../src/jobs/queues.ts'
import { organisationParSlug } from '../src/lib/installation.ts'
import { assurerOrganisationParDefaut } from '../src/lib/organisation.ts'

// Crée le premier compte admin, ou donne les droits d'admin à un compte existant,
// puis met en file le mail d'invitation. Le worker doit tourner pour l'envoyer.
//
// Le rôle vaut dans une organisation (ADR 0008) : celle de l'installation, ou celle
// que désigne --organisation quand l'installation en porte plusieurs.
//
// Poste local : yarn workspace @relaytour/server admin:creer adresse@exemple.fr "Prénom Nom" [--organisation slug]
// Conteneur :   node dist/creer-admin.js adresse@exemple.fr "Prénom Nom" [--organisation slug]
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { organisation: { type: 'string' } },
})
const [adresseBrute, nom] = positionals
const adresse = adresseBrute?.trim().toLowerCase()

if (
  adresse === undefined ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse) ||
  !nom?.trim()
) {
  console.error(
    'Usage : creer-admin <adresse> "<Prénom Nom>" [--organisation <slug>]'
  )
  process.exit(1)
}

const organisationId =
  values.organisation === undefined
    ? await assurerOrganisationParDefaut()
    : (await organisationParSlug(values.organisation)).id
const personne = await prisma.user.upsert({
  where: { email: adresse },
  update: { isAdmin: true, archivedAt: null },
  create: { id: randomUUID(), email: adresse, name: nom.trim(), isAdmin: true },
  select: { id: true },
})
await prisma.appartenance.upsert({
  where: {
    userId_organisationId: { userId: personne.id, organisationId },
  },
  update: { role: 'ADMIN' },
  create: { userId: personne.id, organisationId, role: 'ADMIN' },
})

await mettreEnFile('invitation', { userId: personne.id }, { organisationId })
await courrielQueue.close()
connection.disconnect()
await prisma.$disconnect()
console.log('✔ Compte admin prêt, invitation mise en file.')
