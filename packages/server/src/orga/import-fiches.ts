import type { PrismaClient, SourceFiche } from '@relaytour/database'

import { empreinte } from '../lib/contenu.ts'

// Import de fiches dans une activité, commun au dépôt de contenu (`orga:importer`)
// et à l'espace de fichiers (ADR 0009 et 0038). Une version ne se crée que si
// l'empreinte change ; une fiche dont la version courante vient d'une source
// protégée reste entière et se signale en conflit.

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface FicheAImporter {
  slug: string
  titre: string
  contenu: string
  perimetreId: string | null
}

export interface RapportFiches {
  creees: string[]
  nouvellesVersions: string[]
  inchangees: string[]
  conflits: string[]
}

export interface OptionsImportFiches {
  organisationId: string
  activiteId: string
  source: SourceFiche
  resume: string
  /** Sources d'une version courante que l'import ne remplace pas. */
  protegees: readonly SourceFiche[]
  /**
   * Une fiche du même slug dans une autre activité de l'organisation : elle suit
   * l'import (le dépôt décrit où elle vit), ou elle se signale en conflit.
   */
  autreActivite: 'suivre' | 'conflit'
  ecrire: boolean
  auteurId?: string | null
}

/**
 * Importe des fiches et complète le rapport. Renvoie l'identifiant de chaque
 * fiche par slug, et la raison de chaque conflit.
 */
export async function importerFiches(
  tx: Transaction,
  fiches: readonly FicheAImporter[],
  options: OptionsImportFiches,
  rapport: RapportFiches
): Promise<{ ids: Map<string, string>; raisons: Map<string, string> }> {
  const { organisationId, activiteId, ecrire } = options
  const ids = new Map<string, string>()
  const raisons = new Map<string, string>()
  const creerVersion = async (ficheId: string, fiche: FicheAImporter) => {
    const version = await tx.ficheVersion.create({
      data: {
        ficheId,
        titre: fiche.titre,
        contenu: fiche.contenu,
        empreinte: empreinte(fiche.titre, fiche.contenu),
        source: options.source,
        resume: options.resume,
        auteurId: options.auteurId ?? null,
      },
    })
    await tx.fiche.update({
      where: { id: ficheId },
      data: { versionCouranteId: version.id },
    })
  }

  for (const fiche of fiches) {
    const nouvelleEmpreinte = empreinte(fiche.titre, fiche.contenu)
    const existante =
      organisationId === ''
        ? null
        : await tx.fiche.findUnique({
            where: {
              organisationId_slug: { organisationId, slug: fiche.slug },
            },
            include: {
              versionCourante: { select: { empreinte: true, source: true } },
            },
          })
    if (existante === null) {
      rapport.creees.push(fiche.slug)
      if (!ecrire) continue
      const creee = await tx.fiche.create({
        data: {
          slug: fiche.slug,
          perimetreId: fiche.perimetreId,
          organisationId,
          activiteId,
        },
      })
      await creerVersion(creee.id, fiche)
      ids.set(fiche.slug, creee.id)
      continue
    }
    ids.set(fiche.slug, existante.id)
    if (
      options.autreActivite === 'conflit' &&
      existante.activiteId !== activiteId
    ) {
      rapport.conflits.push(fiche.slug)
      raisons.set(fiche.slug, 'une fiche d’une autre activité porte ce slug')
      continue
    }
    const inchangee = existante.versionCourante?.empreinte === nouvelleEmpreinte
    // Une fiche en conflit reste entière où elle est : ni son contenu, ni son
    // activité, ni son périmètre ne changent tant que le conflit dure.
    if (
      !inchangee &&
      existante.versionCourante !== null &&
      options.protegees.includes(existante.versionCourante.source)
    ) {
      rapport.conflits.push(fiche.slug)
      raisons.set(fiche.slug, 'la fiche a été modifiée dans Relaytour')
      continue
    }
    if (
      ecrire &&
      (existante.activiteId !== activiteId ||
        existante.perimetreId !== fiche.perimetreId)
    ) {
      await tx.fiche.update({
        where: { id: existante.id },
        data: { activiteId, perimetreId: fiche.perimetreId },
      })
    }
    if (inchangee) {
      rapport.inchangees.push(fiche.slug)
      continue
    }
    rapport.nouvellesVersions.push(fiche.slug)
    if (!ecrire) continue
    await creerVersion(existante.id, fiche)
  }
  return { ids, raisons }
}
