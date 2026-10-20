import { prisma, type Prisma, type PrismaClient } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { erreurSaisie } from './erreurs.ts'
import { journal } from './journal.ts'

// Fiches bénévoles (ADR 0040) : des personnes qui aident l'activité sans compte.
// Une fiche ne donne aucun accès. Ses coordonnées ne sortent du serveur que pour
// les admins de l'activité, pour la personne qui l'a créée, et pour les personnes
// qui écrivent dans un périmètre où la fiche est placée.

type Base = PrismaClient | Prisma.TransactionClient

export const NOM_BENEVOLE_MAX = 120
export const NOTE_BENEVOLE_MAX = 2000
/** Une activité compte 2 000 fiches bénévoles au plus. */
export const BENEVOLES_MAX = 2000
/** Une fiche inutilisée et inchangée depuis 24 mois est purgée. */
export const MOIS_AVANT_PURGE = 24

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TELEPHONE = /^\+?[0-9 .()-]{6,40}$/

/** L'adresse d'une fiche : une adresse plausible, ou rien. */
export function courrielValide(brut: string | null | undefined): string | null {
  const texte = (brut ?? '').trim()
  if (texte === '') return null
  if (texte.length > 254 || !COURRIEL.test(texte)) {
    throw erreurSaisie('L’adresse de la ou du bénévole n’est pas valide.')
  }
  return texte.toLowerCase()
}

/** Le téléphone d'une fiche : chiffres, espaces et signes usuels, ou rien. */
export function telephoneValide(
  brut: string | null | undefined
): string | null {
  const texte = (brut ?? '').trim()
  if (texte === '') return null
  if (!TELEPHONE.test(texte)) {
    throw erreurSaisie('Le téléphone de la ou du bénévole n’est pas valide.')
  }
  return texte
}

/**
 * Vrai si la personne écrit dans l'activité : elle l'administre, ou elle est
 * affectée à un de ses périmètres pour une période non archivée.
 */
export async function ecritDansLActivite(
  ctx: AppContext,
  activiteId: string
): Promise<boolean> {
  if (await ctx.estAdminDe(activiteId)) return true
  const affectation = await prisma.affectation.findFirst({
    where: {
      userId: ctx.personne!.id,
      perimetre: { activiteId, archivedAt: null },
      edition: { statut: { not: 'ARCHIVEE' } },
    },
    select: { id: true },
  })
  return affectation !== null
}

/**
 * Les fiches dont la personne lit les coordonnées, parmi celles demandées :
 * toutes pour un admin de l'activité ; sinon celles qu'elle a créées, et celles
 * placées dans une séquence d'un périmètre où elle écrit.
 */
export async function coordonneesLisibles(
  ctx: AppContext,
  activiteId: string,
  benevoleIds: string[]
): Promise<Set<string>> {
  if (benevoleIds.length === 0) return new Set()
  if (await ctx.estAdminDe(activiteId)) return new Set(benevoleIds)
  const moi = ctx.personne!.id
  const affectations = await prisma.affectation.findMany({
    where: {
      userId: moi,
      perimetre: { activiteId },
      edition: { statut: { not: 'ARCHIVEE' } },
    },
    select: { perimetreId: true, editionId: true },
  })
  const lisibles = await prisma.benevole.findMany({
    where: {
      id: { in: benevoleIds },
      activiteId,
      OR: [
        { creeParId: moi },
        ...(affectations.length === 0
          ? []
          : [
              {
                places: {
                  some: {
                    sequence: {
                      OR: affectations.map(a => ({
                        perimetreId: a.perimetreId,
                        editionId: a.editionId,
                      })),
                    },
                  },
                },
              },
            ]),
      ],
    },
    select: { id: true },
  })
  return new Set(lisibles.map(b => b.id))
}

/**
 * Supprime les fiches qu'aucune séquence d'une période non archivée n'utilise, et
 * qui n'ont pas changé depuis MOIS_AVANT_PURGE mois (ADR 0040).
 * `organisationId` limite la purge à une organisation.
 */
export async function purgerBenevoles(
  base: Base,
  options: { organisationId?: string } = {},
  maintenant = new Date()
): Promise<number> {
  const seuil = new Date(maintenant)
  seuil.setMonth(seuil.getMonth() - MOIS_AVANT_PURGE)
  const { count } = await base.benevole.deleteMany({
    where: {
      ...(options.organisationId === undefined
        ? {}
        : { organisationId: options.organisationId }),
      updatedAt: { lt: seuil },
      places: {
        none: { sequence: { edition: { statut: { not: 'ARCHIVEE' } } } },
      },
    },
  })
  if (count > 0) {
    journal.info(
      { evenement: 'benevoles-purges', nombre: count },
      'Des fiches bénévoles inutilisées ont été supprimées.'
    )
  }
  return count
}
