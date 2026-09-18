import { prisma } from '@relaytour/database'

import { validerEdition } from '../src/lib/editions.ts'

// Crée une édition sans passer par l'espace organisateur, pour amorcer une
// installation avant le premier import. Ne modifie jamais une édition existante.
//
// Poste local : yarn workspace @relaytour/server edition:creer 2027 "Rencontres 2027" 2027-06-05 2027-06-06
// Conteneur :   node dist/creer-edition.js 2027 "Rencontres 2027" 2027-06-05 2027-06-06
const [anneeBrute, nom, debutBrut, finBrute] = process.argv.slice(2)
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
  console.error('Usage : creer-edition <annee> "<nom>" <debut AAAA-MM-JJ> <fin AAAA-MM-JJ>')
  process.exit(1)
}

try {
  const edition = validerEdition({
    annee: Number(anneeBrute),
    nom,
    debut: new Date(debutBrut),
    fin: new Date(finBrute),
  })
  const existante = await prisma.edition.findUnique({
    where: { annee: edition.annee },
    select: { nom: true },
  })
  if (existante !== null) {
    console.log(`= Édition ${edition.annee} déjà présente (« ${existante.nom} »), rien à faire.`)
  } else {
    await prisma.edition.create({ data: edition })
    console.log(`✔ Édition ${edition.annee} créée : « ${edition.nom} », du ${debutBrut} au ${finBrute}.`)
  }
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
