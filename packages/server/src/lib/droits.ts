import { prisma } from '@relaytour/database'

import type { AppContext, PersonneConnectee } from '../context.ts'

import { accesRefuse, erreurSaisie } from './erreurs.ts'

// Droits sur un périmètre.
//
// Lecture : les admins, et toute personne affectée au périmètre pour au moins une
// édition. Une affectation passée donne donc accès aux archives du périmètre.
// Écriture : les admins, et les personnes affectées au périmètre pour l'édition
// concernée, tant que cette édition n'est pas archivée.

/**
 * Identifiants des périmètres que la personne peut lire. La fonction renvoie une
 * liste vide sans session, et `null` pour un admin, qui lit tous les périmètres.
 * Toute liste filtrée par périmètre s'appuie sur cette règle.
 */
export async function perimetresLisibles(
  ctx: AppContext
): Promise<string[] | null> {
  if (ctx.personne === null) return []
  if (ctx.personne.estAdmin) return null
  return [...(await ctx.perimetresConnus())]
}

export async function peutLirePerimetre(
  ctx: AppContext,
  perimetreId: string
): Promise<boolean> {
  const lisibles = await perimetresLisibles(ctx)
  return lisibles === null || lisibles.includes(perimetreId)
}

export async function exigerLecture(
  ctx: AppContext,
  perimetreId: string
): Promise<PersonneConnectee> {
  if (ctx.personne === null || !(await peutLirePerimetre(ctx, perimetreId))) {
    throw accesRefuse()
  }
  return ctx.personne
}

export async function peutModifierPerimetre(
  ctx: AppContext,
  perimetreId: string,
  editionId: string
): Promise<boolean> {
  if (ctx.personne === null) return false
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { statut: true },
  })
  if (edition === null || edition.statut === 'ARCHIVEE') return false
  if (ctx.personne.estAdmin) return true
  return (await ctx.perimetresAffectes(editionId)).has(perimetreId)
}

export async function exigerEcriture(
  ctx: AppContext,
  perimetreId: string,
  editionId: string
): Promise<PersonneConnectee> {
  if (ctx.personne === null || !(await peutLirePerimetre(ctx, perimetreId))) {
    throw accesRefuse()
  }
  if (!(await peutModifierPerimetre(ctx, perimetreId, editionId))) {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { statut: true },
    })
    if (edition?.statut === 'ARCHIVEE') {
      throw erreurSaisie(
        'Cette édition est archivée : ses tâches sont en lecture seule.'
      )
    }
    throw accesRefuse()
  }
  return ctx.personne
}

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function aujourdhuiParis(maintenant = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(maintenant)
}

/** Une tâche est en retard si son échéance est passée et qu'elle n'est ni faite ni abandonnée. */
export function estEnRetard(
  tache: { echeance: Date | null; statut: string },
  aujourdhui = aujourdhuiParis()
): boolean {
  if (tache.echeance === null) return false
  if (tache.statut === 'FAITE' || tache.statut === 'ABANDONNEE') return false
  return tache.echeance.toISOString().slice(0, 10) < aujourdhui
}
