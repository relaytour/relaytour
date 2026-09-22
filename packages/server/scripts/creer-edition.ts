import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import { validerEdition } from '../src/lib/editions.ts'
import { organisationEtActivite } from '../src/lib/installation.ts'

// Crée une édition sans passer par l'espace organisateur, pour amorcer une
// installation avant le premier import. Ne modifie jamais une édition existante.
//
// Une édition est une période d'une activité (ADR 0008). Sans option, la première
// activité de l'organisation de l'installation ; --organisation et --activite la
// désignent quand il y en a plusieurs.
//
// Poste local : yarn workspace @relaytour/server edition:creer 2027 "Rencontres 2027" 2027-06-05 2027-06-06 [--organisation slug] [--activite slug]
// Conteneur :   node dist/creer-edition.js 2027 "Rencontres 2027" 2027-06-05 2027-06-06 [--organisation slug] [--activite slug]
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    organisation: { type: 'string' },
    activite: { type: 'string' },
  },
})
const [anneeBrute, nom, debutBrut, finBrute] = positionals
const DATE = /^\d{4}-\d{2}-\d{2}$/

if (
  anneeBrute === undefined ||
  nom === undefined ||
  debutBrut === undefined ||
  finBrute === undefined ||
  !/^\d{4}$/.test(anneeBrute) ||
  !DATE.test(debutBrut) ||
  !DATE.test(finBrute)
) {
  console.error(
    'Usage : creer-edition <annee> "<nom>" <debut AAAA-MM-JJ> <fin AAAA-MM-JJ> [--organisation <slug>] [--activite <slug>]'
  )
  process.exit(1)
}

try {
  const edition = validerEdition({
    annee: Number(anneeBrute),
    nom,
    debut: new Date(debutBrut),
    fin: new Date(finBrute),
  })
  const { organisationId, activiteId } = await organisationEtActivite(
    values.organisation,
    values.activite
  )
  const existante = await prisma.edition.findUnique({
    where: { activiteId_annee: { activiteId, annee: edition.annee } },
    select: { nom: true },
  })
  if (existante !== null) {
    console.log(
      `= Édition ${edition.annee} déjà présente (« ${existante.nom} »), rien à faire.`
    )
  } else {
    await prisma.edition.create({
      data: {
        ...edition,
        organisationId,
        activiteId,
      },
    })
    console.log(
      `✔ Édition ${edition.annee} créée : « ${edition.nom} », du ${debutBrut} au ${finBrute}.`
    )
  }
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
