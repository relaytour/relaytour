import { prisma } from '@relaytour/database'

import type { AppContext, EditionDuContexte } from '../context.ts'

import { erreurSaisie } from './erreurs.ts'

// Souhaits : intérêt d'une personne pour un périmètre d'une édition, noté par un admin.
//
// Un souhait ne donne aucun accès. Seule l'affectation ouvre les droits, et
// lib/droits.ts ne lit jamais cette table. Un souhait est satisfait quand l'affectation
// du même triplet (personne, périmètre, édition) existe : cet état se calcule à la
// lecture et ne se stocke pas. Les admins sont les seules personnes à voir les souhaits,
// qui ne sont jamais exportés dans Git et ne contiennent aucun texte libre.

export const SOUHAITS_MAX = 30

/** L'édition de l'organisation active. Refuse une édition d'ailleurs ou archivée. */
export async function exigerEditionOuverte(
  ctx: AppContext,
  editionId: string | number
): Promise<EditionDuContexte> {
  const edition = await ctx.exigerEdition(editionId)
  if (edition.statut === 'ARCHIVEE') {
    throw erreurSaisie(
      'Cette édition est archivée : ses souhaits ne se modifient plus.'
    )
  }
  return edition
}

/** Retire les doublons et vérifie le nombre de périmètres, sans lire la base. */
export function identifiantsSouhaites(
  ids: readonly (string | number)[]
): string[] {
  const uniques = [...new Set(ids.map(String))]
  if (uniques.length > SOUHAITS_MAX) {
    throw erreurSaisie(`Choisissez ${SOUHAITS_MAX} périmètres au plus.`)
  }
  return uniques
}

/**
 * Identifiants de périmètres souhaités, sans doublon. Refuse un périmètre inconnu,
 * archivé ou d'une autre activité que celle de l'édition. Une liste vide ne lit pas
 * la base.
 */
export async function perimetresSouhaitesValides(
  ids: readonly (string | number)[],
  activiteId: string
): Promise<string[]> {
  const uniques = identifiantsSouhaites(ids)
  if (uniques.length === 0) return uniques
  const valides = await prisma.perimetre.count({
    where: { id: { in: uniques }, activiteId, archivedAt: null },
  })
  if (valides !== uniques.length) {
    throw erreurSaisie('Un périmètre choisi est introuvable ou archivé.')
  }
  return uniques
}
