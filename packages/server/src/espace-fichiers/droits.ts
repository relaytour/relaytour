import { prisma, type DossierLie } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { peutLireFiche } from '../lib/fiches.ts'

// Droits de l'espace de fichiers (ADR 0038). Un dossier lié se lit comme les
// fiches du même périmètre, ou comme les fiches communes de son activité.

/** Le dossier lié s'il appartient à l'organisation active et si la personne le lit, sinon null. */
export async function dossierLisible(
  ctx: AppContext,
  id: string
): Promise<DossierLie | null> {
  if (ctx.personne === null || ctx.organisation === null) return null
  const dossier = await prisma.dossierLie.findFirst({
    where: { id, organisationId: ctx.organisation.id },
  })
  if (dossier === null) return null
  return (await peutLireFiche(ctx, dossier)) ? dossier : null
}
