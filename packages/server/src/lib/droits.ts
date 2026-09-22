import { prisma } from '@relaytour/database'

import type { AppContext, PersonneConnectee } from '../context.ts'

import { accesRefuse, erreurSaisie } from './erreurs.ts'

// Droits sur un périmètre.
//
// Tout se lit dans l'organisation active (ADR 0008) : un périmètre ou une édition
// d'une autre organisation est refusé comme un périmètre interdit.
// Lecture : les admins, et toute personne affectée au périmètre pour au moins une
// édition. Une affectation passée donne donc accès aux archives du périmètre.
// Écriture : les admins, et les personnes affectées au périmètre pour l'édition
// concernée, tant que cette édition n'est pas archivée. Le périmètre et l'édition
// relèvent de la même activité.

/**
 * Identifiants des périmètres que la personne peut lire dans l'organisation active :
 * tous ceux de l'organisation pour un admin, ceux où elle a été affectée sinon.
 * La liste est vide sans session ou sans organisation active. Toute liste filtrée
 * par périmètre s'appuie sur cette règle.
 */
export async function perimetresLisibles(ctx: AppContext): Promise<string[]> {
  if (ctx.personne === null || ctx.organisation === null) return []
  if (ctx.personne.estAdmin) {
    const perimetres = await prisma.perimetre.findMany({
      where: { organisationId: ctx.organisation.id },
      select: { id: true },
    })
    return perimetres.map(p => p.id)
  }
  return [...(await ctx.perimetresConnus())]
}

export async function peutLirePerimetre(
  ctx: AppContext,
  perimetreId: string
): Promise<boolean> {
  return (await perimetresLisibles(ctx)).includes(perimetreId)
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

/** L'édition et le périmètre, s'ils relèvent de la même activité de l'organisation active. */
async function editionEtPerimetre(
  ctx: AppContext,
  perimetreId: string,
  editionId: string
) {
  if (ctx.organisation === null) return null
  const [edition, perimetre] = await Promise.all([
    prisma.edition.findFirst({
      where: { id: editionId, organisationId: ctx.organisation.id },
      select: { statut: true, activiteId: true },
    }),
    prisma.perimetre.findFirst({
      where: { id: perimetreId, organisationId: ctx.organisation.id },
      select: { activiteId: true },
    }),
  ])
  if (edition === null || perimetre === null) return null
  if (edition.activiteId !== perimetre.activiteId) return null
  return edition
}

export async function peutModifierPerimetre(
  ctx: AppContext,
  perimetreId: string,
  editionId: string
): Promise<boolean> {
  if (ctx.personne === null) return false
  const edition = await editionEtPerimetre(ctx, perimetreId, editionId)
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
    const edition = await editionEtPerimetre(ctx, perimetreId, editionId)
    if (edition?.statut === 'ARCHIVEE') {
      throw erreurSaisie(
        'Cette édition est archivée : ses tâches sont en lecture seule.'
      )
    }
    throw accesRefuse()
  }
  return ctx.personne
}

/** Fuseau d'une organisation qui n'en déclare pas. */
export const FUSEAU_PAR_DEFAUT = 'Europe/Paris'

/** Date du jour dans le fuseau d'une organisation, au format AAAA-MM-JJ. */
export function aujourdhui(
  maintenant = new Date(),
  fuseau = FUSEAU_PAR_DEFAUT
): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(maintenant)
}

/** Une tâche est en retard si son échéance est passée et qu'elle n'est ni faite ni abandonnée. */
export function estEnRetard(
  tache: { echeance: Date | null; statut: string },
  jour = aujourdhui()
): boolean {
  if (tache.echeance === null) return false
  if (tache.statut === 'FAITE' || tache.statut === 'ABANDONNEE') return false
  return tache.echeance.toISOString().slice(0, 10) < jour
}
