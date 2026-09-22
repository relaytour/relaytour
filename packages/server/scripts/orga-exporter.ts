import path from 'node:path'
import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import { exporterContenu } from '../src/orga/exporter.ts'

// Écrit tout le contenu de l'organisation vers le dossier de contenu (content/exemple
// par défaut), dans sa disposition : plate ou activites/ (ADR 0009). Un fichier
// dont le sens ne change pas reste intact, avec ses commentaires.
//   yarn workspace @relaytour/server orga:exporter [--dossier chemin] [--organisation slug]

const { values } = parseArgs({
  options: {
    dossier: { type: 'string' },
    organisation: { type: 'string' },
  },
})
const racine = path.resolve(
  values.dossier ??
    process.env.CONTENU_ORGA ??
    path.join(import.meta.dirname, '../../../content/exemple')
)

try {
  const rapport = await exporterContenu(prisma, racine, values.organisation)
  console.log(
    `✔ ${rapport.ecrites.length} fichier(s) écrit(s) et ${rapport.inchangees.length} inchangé(s) dans ${racine}`
  )
  for (const fichier of rapport.ecrites) console.log(`  ${fichier}`)
  if (rapport.refusees.length > 0) {
    console.log(`\n✖ ${rapport.refusees.length} fichier(s) refusé(s) :`)
    for (const { fichier, raison } of rapport.refusees)
      console.log(`  ${fichier} : ${raison}`)
    process.exitCode = 1
  }
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
