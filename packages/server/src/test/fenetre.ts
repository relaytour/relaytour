import { prisma } from '@relaytour/database'

import { consoliderTache } from '../lib/fenetre-notifications.ts'

/**
 * Termine tout de suite les fenêtres de regroupement en attente (ADR 0065), comme
 * le ferait le worker à leur fin. Les tests qui lisent la cloche juste après une
 * action l'appellent ; les tests de la fenêtre appellent `consoliderTache` eux-mêmes.
 */
export async function consoliderLesFenetres(): Promise<void> {
  const enAttente = await prisma.notification.findMany({
    where: { disponibleLe: { not: null }, tacheId: { not: null } },
    distinct: ['tacheId', 'disponibleLe'],
    select: { tacheId: true, disponibleLe: true },
  })
  for (const { tacheId, disponibleLe } of enAttente) {
    await consoliderTache(prisma, tacheId!, disponibleLe!)
  }
}
