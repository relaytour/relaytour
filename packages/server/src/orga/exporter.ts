import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { PrismaClient } from '@relaytour/database'
import { stringify } from 'yaml'

import { donneesPersonnelles } from '../lib/contenu.ts'

export interface RapportExport {
  ecrites: string[]
  refusees: { fichier: string; raison: string }[]
}

/**
 * Écrit dans content/orga/fiches les fiches dont la version courante vient de
 * l'application, pour les reverser dans Git en fin d'édition.
 *
 * Une fiche qui contient une adresse ou un numéro de téléphone personnel est refusée :
 * aucune donnée personnelle n'entre dans Git (CLAUDE.md, invariant 2).
 */
export async function exporterFiches(
  prisma: PrismaClient,
  racine: string
): Promise<RapportExport> {
  const rapport: RapportExport = { ecrites: [], refusees: [] }
  const fiches = await prisma.fiche.findMany({
    where: { archivedAt: null, versionCourante: { source: 'APP' } },
    include: {
      perimetre: { select: { slug: true } },
      versionCourante: { select: { titre: true, contenu: true } },
    },
    orderBy: { slug: 'asc' },
  })

  for (const fiche of fiches) {
    const version = fiche.versionCourante
    if (version === null) continue
    const dossier = fiche.perimetre?.slug ?? 'communes'
    const fichier = path.join('fiches', dossier, `${fiche.slug}.md`)
    const personnelles = donneesPersonnelles(
      `${version.titre}\n${version.contenu}`
    )
    if (personnelles.length > 0) {
      rapport.refusees.push({
        fichier,
        raison: `données personnelles (${personnelles.join(', ')})`,
      })
      continue
    }
    const entete = stringify({
      slug: fiche.slug,
      titre: version.titre,
    }).trimEnd()
    mkdirSync(path.join(racine, 'fiches', dossier), { recursive: true })
    writeFileSync(
      path.join(racine, fichier),
      `---\n${entete}\n---\n\n${version.contenu}`,
      'utf8'
    )
    rapport.ecrites.push(fichier)
  }
  return rapport
}
