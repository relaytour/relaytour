import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { PrismaClient } from '@relaytour/database'
import { stringify } from 'yaml'

import { donneesPersonnelles } from '../lib/contenu.ts'
import { configurationOrganisation } from '../lib/organisation.ts'

export interface RapportExport {
  ecrites: string[]
  refusees: { fichier: string; raison: string }[]
}

/**
 * Écrit dans le dossier de contenu les fiches d'une organisation dont la version
 * courante vient de l'application, pour les reverser dans Git en fin de période.
 *
 * Le dossier garde sa disposition (ADR 0008) : `fiches/<périmètre>/` en disposition
 * plate, `activites/<activité>/fiches/<périmètre>/` sinon. Un dossier plat refuse les
 * fiches de plusieurs activités.
 *
 * Sans slug, l'organisation est la seule de l'installation ; plusieurs organisations
 * exigent le slug.
 *
 * Une fiche qui contient une adresse ou un numéro de téléphone personnel est refusée :
 * aucune donnée personnelle n'entre dans Git (CONTRIBUTING.md, invariant 2).
 */
export async function exporterFiches(
  prisma: PrismaClient,
  racine: string,
  slugOrganisation?: string
): Promise<RapportExport> {
  const rapport: RapportExport = { ecrites: [], refusees: [] }
  const organisations = await prisma.organisation.findMany({
    where: slugOrganisation === undefined ? {} : { slug: slugOrganisation },
    select: { id: true, slug: true },
    take: 2,
  })
  const organisation = organisations[0]
  if (organisation === undefined) {
    throw new Error(
      slugOrganisation === undefined
        ? 'Aucune organisation en base.'
        : `Aucune organisation ne porte le slug « ${slugOrganisation} ».`
    )
  }
  if (organisations.length > 1) {
    throw new Error(
      'Plusieurs organisations existent en base : précisez --organisation <slug>.'
    )
  }
  const { domainesCourrielAutorises } = await configurationOrganisation(
    organisation.id
  )
  const fiches = await prisma.fiche.findMany({
    where: {
      organisationId: organisation.id,
      archivedAt: null,
      versionCourante: { source: 'APP' },
    },
    include: {
      activite: { select: { slug: true } },
      perimetre: { select: { slug: true } },
      versionCourante: { select: { titre: true, contenu: true } },
    },
    orderBy: { slug: 'asc' },
  })

  const enActivites = existsSync(path.join(racine, 'activites'))
  const activites = new Set(fiches.map(f => f.activite.slug))
  if (!enActivites && activites.size > 1) {
    throw new Error(
      `Les fiches à reverser viennent de ${activites.size} activités (${[...activites].sort().join(', ')}), mais le dossier est en disposition plate. Passez-le en disposition activites/ (ADR 0008).`
    )
  }

  for (const fiche of fiches) {
    const version = fiche.versionCourante
    if (version === null) continue
    const dossier = path.join(
      ...(enActivites ? ['activites', fiche.activite.slug] : []),
      'fiches',
      fiche.perimetre?.slug ?? 'communes'
    )
    const fichier = path.join(dossier, `${fiche.slug}.md`)
    const personnelles = donneesPersonnelles(
      `${version.titre}\n${version.contenu}`,
      domainesCourrielAutorises
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
    mkdirSync(path.join(racine, dossier), { recursive: true })
    writeFileSync(
      path.join(racine, fichier),
      `---\n${entete}\n---\n\n${version.contenu}`,
      'utf8'
    )
    rapport.ecrites.push(fichier)
  }
  return rapport
}
