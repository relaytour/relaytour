import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { peutLirePerimetre } from './droits.ts'

// Les fonctions pures sur le contenu vivent dans contenu.ts, sans dépendance à Prisma.
// Elles restent exportées d'ici pour le schéma et l'importeur.
export { donneesPersonnelles, empreinte, normaliserContenu } from './contenu.ts'

// ── Droits ───────────────────────────────────────────────────────────────────

/**
 * Lecture : une fiche d'une activité que la personne voit (ADR 0010). Une fiche
 * commune est lisible par toute personne qui voit son activité ; une fiche de
 * périmètre suit les droits de lecture du périmètre. Une fiche d'une autre
 * organisation ou d'une activité invisible est illisible.
 */
export async function peutLireFiche(
  ctx: AppContext,
  fiche: {
    perimetreId: string | null
    organisationId: string
    activiteId: string
  }
): Promise<boolean> {
  if (ctx.personne === null || ctx.organisation === null) return false
  if (fiche.organisationId !== ctx.organisation.id) return false
  if (!(await ctx.activitesVisibles()).has(fiche.activiteId)) return false
  return fiche.perimetreId === null
    ? true
    : peutLirePerimetre(ctx, fiche.perimetreId)
}

/**
 * Écriture : les admins de l'activité (ADR 0010), et les personnes qui ont reçu un
 * droit de rédaction pour ce périmètre ou pour toutes les fiches de l'organisation.
 * Une fiche commune exige le droit global, et une activité visible. Un périmètre
 * d'une autre organisation n'est jamais rédigeable.
 */
export async function peutRedigerFiche(
  ctx: AppContext,
  perimetreId: string | null,
  activiteId: string
): Promise<boolean> {
  if (ctx.personne === null || ctx.organisation === null) return false
  if (perimetreId !== null) {
    const perimetre = await prisma.perimetre.findFirst({
      where: { id: perimetreId, organisationId: ctx.organisation.id },
      select: { id: true, activiteId: true },
    })
    if (perimetre === null || perimetre.activiteId !== activiteId) return false
  }
  if (!(await ctx.activitesVisibles()).has(activiteId)) return false
  if (await ctx.estAdminDe(activiteId)) return true
  // Un droit de périmètre suppose la lecture du périmètre.
  if (perimetreId !== null && !(await peutLirePerimetre(ctx, perimetreId)))
    return false
  const droit = await prisma.droitRedaction.findFirst({
    where: {
      userId: ctx.personne.id,
      organisationId: ctx.organisation.id,
      OR: [
        { perimetreId: null },
        ...(perimetreId === null ? [] : [{ perimetreId }]),
      ],
    },
    select: { id: true },
  })
  return droit !== null
}
