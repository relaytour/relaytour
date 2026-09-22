import path from 'node:path'
import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import {
  importerModeles,
  type RapportActivite,
  type RapportImport,
} from '../src/orga/importer.ts'
import { ErreurModeles, lireModeles } from '../src/orga/modeles.ts'

// Importe le dossier de contenu (content/exemple par défaut) en base.
//   yarn workspace @relaytour/server orga:importer [--edition 2027] [--simulation] [--dossier chemin]
//     [--organisation slug] [--activite slug]
// Dans le conteneur : node dist/orga-importer.js --dossier /contenu --edition 2027
// --organisation est obligatoire quand l'installation porte plusieurs organisations
// (ADR 0008). --activite restreint l'import à une activité du dépôt.

const { values } = parseArgs({
  options: {
    edition: { type: 'string' },
    simulation: { type: 'boolean', default: false },
    dossier: { type: 'string' },
    organisation: { type: 'string' },
    activite: { type: 'string' },
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
  console.log(`    ${titre} (${liste.length}) : ${liste.join(', ')}`)
}

function imprimerActivite(r: RapportActivite) {
  console.log(
    `Activité ${r.slug} (${r.etat === 'creee' ? 'créée' : 'mise à jour'})`
  )
  console.log('  Périmètres')
  afficher('créés', r.perimetres.crees)
  afficher('modifiés', r.perimetres.modifies)
  afficher(
    'en base mais absents du dépôt (non modifiés)',
    r.perimetres.absentsDuDepot
  )
  console.log('  Fiches')
  afficher('créées', r.fiches.creees)
  afficher('nouvelle version', r.fiches.nouvellesVersions)
  afficher('inchangées', r.fiches.inchangees)
  afficher(
    'CONFLITS : modifiées dans l’application, non remplacées',
    r.fiches.conflits
  )
  if (r.periode === 'absente') {
    console.log(`  Aucune période ${annee} : tâches types non importées.`)
  }
  if (r.periode === 'importee') {
    console.log(`  Effectifs de la période ${annee}`)
    afficher('créés', r.effectifs.crees)
    afficher('déjà présents (non modifiés)', r.effectifs.dejaPresents)
    console.log(`  Tâches de la période ${annee}`)
    afficher('créées', r.taches.creees)
    afficher('déjà présentes (non modifiées)', r.taches.dejaPresentes)
  }
}

function imprimer(rapport: RapportImport) {
  console.log(
    `Organisation : ${rapport.organisation.slug} (${rapport.organisation.etat === 'creee' ? 'créée' : 'mise à jour'})`
  )
  for (const activite of rapport.activites) imprimerActivite(activite)
  if (rapport.amorcageRetire) {
    console.log(
      'Activité d’amorçage « defaut », vide, retirée : le dépôt décrit ses activités.'
    )
  }
  if (rapport.activitesAbsentesDuDepot.length > 0) {
    console.log(
      `Activités en base mais absentes du dépôt (non modifiées) : ${rapport.activitesAbsentesDuDepot.join(', ')}`
    )
  }
}

try {
  const modeles = lireModeles(racine)
  const rapport = await importerModeles(prisma, modeles, {
    annee,
    simulation: values.simulation,
    organisation: values.organisation,
    activite: values.activite,
  })
  console.log(
    values.simulation
      ? '— Simulation : rien n’a été écrit —'
      : '✔ Import terminé'
  )
  imprimer(rapport)
  if (rapport.activites.some(a => a.fiches.conflits.length > 0)) {
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
