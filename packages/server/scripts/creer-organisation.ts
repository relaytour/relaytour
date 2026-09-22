import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import { connection, courrielQueue } from '../src/jobs/queues.ts'
import {
  creerOrganisation,
  inviterAdmin,
  validerInvitation,
} from '../src/lib/installation.ts'

// Crée une organisation et sa première activité, puis invite son premier admin
// (ADR 0008, administration de l'installation). N'accède à aucune autre donnée.
//
// Poste local :
//   yarn workspace @relaytour/server organisation:creer rencontres "Les Rencontres" \
//     [--sigle Rencontres] [--fuseau Europe/Paris] [--domaines exemple.org,autre.org] \
//     [--limite-activites 1] [--limite-periodes 1] \
//     [--admin adresse@exemple.org --admin-nom "Prénom Nom"]
// Conteneur : node dist/creer-organisation.js rencontres "Les Rencontres" …

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    sigle: { type: 'string' },
    fuseau: { type: 'string' },
    domaines: { type: 'string' },
    'limite-activites': { type: 'string' },
    'limite-periodes': { type: 'string' },
    admin: { type: 'string' },
    'admin-nom': { type: 'string' },
  },
})

const [slug, nom] = positionals
const entier = (brut: string | undefined, option: string) => {
  if (brut === undefined) return undefined
  const n = Number(brut)
  if (!Number.isInteger(n) || n < 0) {
    console.error(`--${option} attend un entier positif.`)
    process.exit(1)
  }
  return n
}

if (slug === undefined || nom === undefined) {
  console.error(
    'Usage : creer-organisation <slug> "<nom>" [--sigle …] [--fuseau …] [--domaines a.org,b.org] [--limite-activites n] [--limite-periodes n] [--admin adresse --admin-nom "Prénom Nom"]'
  )
  process.exit(1)
}
if ((values.admin === undefined) !== (values['admin-nom'] === undefined)) {
  console.error('--admin et --admin-nom vont ensemble.')
  process.exit(1)
}

const activites = entier(values['limite-activites'], 'limite-activites')
const periodesOuvertes = entier(values['limite-periodes'], 'limite-periodes')

try {
  // L'admin se vérifie avant la création : une adresse refusée ne laisse pas
  // derrière elle une organisation à moitié amorcée.
  if (values.admin !== undefined && values['admin-nom'] !== undefined) {
    await validerInvitation(values.admin, values['admin-nom'])
  }
  await creerOrganisation({
    slug,
    nom,
    sigle: values.sigle,
    fuseauHoraire: values.fuseau,
    domainesCourrielAutorises: values.domaines
      ?.split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0),
    limites: {
      ...(activites === undefined ? {} : { activites }),
      ...(periodesOuvertes === undefined ? {} : { periodesOuvertes }),
    },
  })
  console.log(`✔ Organisation « ${slug} » créée, avec sa première activité.`)
  if (values.admin !== undefined && values['admin-nom'] !== undefined) {
    await inviterAdmin(slug, values.admin, values['admin-nom'])
    console.log('✔ Premier admin prêt, invitation mise en file.')
  }
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exitCode = 1
} finally {
  await courrielQueue.close()
  connection.disconnect()
  await prisma.$disconnect()
}
