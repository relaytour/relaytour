import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { peutLirePerimetre } from './droits.ts'

// Les fonctions pures sur le contenu vivent dans contenu.ts, sans dépendance à Prisma.
// Elles restent exportées d'ici pour le schéma et l'importeur.
export { donneesPersonnelles, empreinte, normaliserContenu } from './contenu.ts'

// ── Droits ───────────────────────────────────────────────────────────────────

/**
 * Lecture : une fiche de l'organisation active. Une fiche commune est lisible par
 * toute personne connectée à cette organisation ; une fiche de périmètre suit les
 * droits de lecture du périmètre. Une fiche d'une autre organisation est illisible.
 */
export async function peutLireFiche(
  ctx: AppContext,
  fiche: { perimetreId: string | null; organisationId: string }
): Promise<boolean> {
  if (ctx.personne === null || ctx.organisation === null) return false
  if (fiche.organisationId !== ctx.organisation.id) return false
  return fiche.perimetreId === null
    ? true
    : peutLirePerimetre(ctx, fiche.perimetreId)
}

/**
 * Écriture : les admins, et les personnes qui ont reçu un droit de rédaction pour ce
 * périmètre ou pour toutes les fiches de l'organisation. Une fiche commune exige le
 * droit global. Un périmètre d'une autre organisation n'est jamais rédigeable.
 */
export async function peutRedigerFiche(
  ctx: AppContext,
  perimetreId: string | null
): Promise<boolean> {
  if (ctx.personne === null || ctx.organisation === null) return false
  if (perimetreId !== null) {
    const perimetre = await prisma.perimetre.findFirst({
      where: { id: perimetreId, organisationId: ctx.organisation.id },
      select: { id: true },
    })
    if (perimetre === null) return false
  }
  if (ctx.personne.estAdmin) return true
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
