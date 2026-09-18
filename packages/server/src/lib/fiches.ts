import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { peutLirePerimetre } from './droits.ts'

// Les fonctions pures sur le contenu vivent dans contenu.ts, sans dépendance à Prisma.
// Elles restent exportées d'ici pour le schéma et l'importeur.
export { donneesPersonnelles, empreinte, normaliserContenu } from './contenu.ts'

// ── Droits ───────────────────────────────────────────────────────────────────

/**
 * Lecture : une fiche commune est lisible par toute personne connectée ; une fiche de
 * périmètre suit les droits de lecture du périmètre.
 */
export async function peutLireFiche(
  ctx: AppContext,
  fiche: { perimetreId: string | null }
): Promise<boolean> {
  if (ctx.personne === null) return false
  return fiche.perimetreId === null
    ? true
    : peutLirePerimetre(ctx, fiche.perimetreId)
}

/**
 * Écriture : les admins, et les personnes qui ont reçu un droit de rédaction pour ce
 * périmètre ou pour toutes les fiches. Une fiche commune exige le droit global.
 */
export async function peutRedigerFiche(
  ctx: AppContext,
  perimetreId: string | null
): Promise<boolean> {
  if (ctx.personne === null) return false
  if (ctx.personne.estAdmin) return true
  const droit = await prisma.droitRedaction.findFirst({
    where: {
      userId: ctx.personne.id,
      OR: [
        { perimetreId: null },
        ...(perimetreId === null ? [] : [{ perimetreId }]),
      ],
    },
    select: { id: true },
  })
  return droit !== null
}
