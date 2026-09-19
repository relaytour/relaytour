import path from 'node:path'
import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import { importerModeles, type RapportImport } from '../src/orga/importer.ts'
import { ErreurModeles, lireModeles } from '../src/orga/modeles.ts'

// Importe le dossier de contenu (content/exemple par défaut) en base.
//   yarn workspace @relaytour/server orga:importer [--edition 2027] [--simulation] [--dossier chemin]
// Dans le conteneur : node dist/orga-importer.js --dossier /contenu --edition 2027

const { values } = parseArgs({
  options: {
    edition: { type: 'string' },
    simulation: { type: 'boolean', default: false },
    dossier: { type: 'string' },
  },
})

const racine = path.resolve(
  values.dossier ??
    process.env.CONTENU_ORGA ??
    path.join(import.meta.dirname, '../../../content/exemple')
)
const annee = values.edition === undefined ? undefined : Number(values.edition)
if (annee !== undefined && !Number.isInteger(annee)) {
  console.error('--edition attend une année, par exemple --edition 2027')
  process.exit(1)
}

function afficher(titre: string, liste: string[]) {
  if (liste.length === 0) return
  console.log(`  ${titre} (${liste.length}) : ${liste.join(', ')}`)
}

function imprimer(rapport: RapportImport) {
  console.log(
    `Organisation : ${rapport.organisation.slug} (${rapport.organisation.etat === 'creee' ? 'créée' : 'mise à jour'})`
  )
  console.log('Périmètres')
  afficher('créés', rapport.perimetres.crees)
  afficher('modifiés', rapport.perimetres.modifies)
  afficher(
    'en base mais absents du dépôt (non modifiés)',
    rapport.perimetres.absentsDuDepot
  )
  console.log('Fiches')
  afficher('créées', rapport.fiches.creees)
  afficher('nouvelle version', rapport.fiches.nouvellesVersions)
  afficher('inchangées', rapport.fiches.inchangees)
  afficher(
    'CONFLITS : modifiées dans l’application, non remplacées',
    rapport.fiches.conflits
  )
  if (annee !== undefined) {
    console.log(`Effectifs de l'édition ${annee}`)
    afficher('créés', rapport.effectifs.crees)
    afficher('déjà présents (non modifiés)', rapport.effectifs.dejaPresents)
    console.log(`Tâches de l'édition ${annee}`)
    afficher('créées', rapport.taches.creees)
    afficher('déjà présentes (non modifiées)', rapport.taches.dejaPresentes)
  }
}

try {
  const modeles = lireModeles(racine)
  const rapport = await importerModeles(prisma, modeles, {
    annee,
    simulation: values.simulation,
  })
  console.log(
    values.simulation
      ? '— Simulation : rien n’a été écrit —'
      : '✔ Import terminé'
  )
  imprimer(rapport)
  if (rapport.fiches.conflits.length > 0) {
    console.log(
      '\nPour résoudre un conflit : exporter les fiches (orga:exporter), reporter les changements dans Git, puis relancer l’import.'
    )
  }
} catch (erreur) {
  console.error(erreur instanceof ErreurModeles ? erreur.message : erreur)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
