import path from 'node:path'
import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import { ecrireExport } from '../src/lib/export.ts'

// Écrit l'export complet d'une organisation (ADR 0008) : activités, périodes,
// périmètres, fiches et leur historique, tâches, membres et affectations. Le fichier
// contient des noms et des adresses : il se remet à l'organisation et ne se commite
// jamais.
//
// Poste local : yarn workspace @relaytour/server organisation:exporter <slug> [--dossier chemin]
// Conteneur :   node dist/exporter-organisation.js <slug>   (dossier EXPORTS_DIR, /exports)

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { dossier: { type: 'string' } },
})
const [slug] = positionals
if (slug === undefined) {
  console.error('Usage : exporter-organisation <slug> [--dossier chemin]')
  process.exit(1)
}

try {
  const dossier =
    values.dossier === undefined
      ? process.env.EXPORTS_DIR
      : path.resolve(values.dossier)
  const { chemin, octets } = await ecrireExport(slug, dossier)
  console.log(`✔ Export écrit : ${chemin} (${octets} octets).`)
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
