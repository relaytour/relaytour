import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import { mettreEnFile } from '../src/courriel/file.ts'
import { connection, courrielQueue } from '../src/jobs/queues.ts'
import {
  nommerAdmin,
  organisationParSlug,
  organisationUnique,
} from '../src/lib/installation.ts'
import { annoncerInvitation } from '../src/lib/invitations.ts'

// Crée le premier compte admin, ou donne les droits d'admin à un membre de
// l'organisation, puis met en file le mail d'invitation. Une adresse qui a déjà un
// compte hors de l'organisation reçoit une invitation au rôle d'admin (ADR 0030). Le worker doit tourner pour l'envoyer.
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

// Sans --organisation, l'unique organisation de l'installation ; plusieurs
// organisations exigent le slug.
const organisationId =
  values.organisation === undefined
    ? await organisationUnique()
    : (await organisationParSlug(values.organisation)).id
// Les règles sont celles de l'application (lib/installation.ts, `nommerAdmin`) : un
// compte connu d'une autre organisation ne reçoit qu'une invitation (ADR 0030).
let admin: Awaited<ReturnType<typeof nommerAdmin>> | null = null
try {
  admin = await nommerAdmin(organisationId, adresse, nom.trim())
  if (admin.issue === 'invite') {
    await annoncerInvitation(admin.userId, { organisationId })
  } else {
    await mettreEnFile(
      'invitation',
      { userId: admin.userId },
      { organisationId }
    )
  }
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exitCode = 1
}
await courrielQueue.close()
connection.disconnect()
await prisma.$disconnect()
if (admin !== null) {
  console.log(
    admin.issue === 'invite'
      ? '✔ Cette adresse a déjà un compte hors de l’organisation : son invitation au rôle d’admin attend son accord.'
      : admin.issue === 'retabli'
        ? '✔ Compte rétabli et admin, invitation mise en file.'
        : '✔ Compte admin prêt, invitation mise en file.'
  )
}
