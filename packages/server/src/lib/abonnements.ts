import type { PrismaClient } from '@relaytour/database'

import { erreurSaisie } from './erreurs.ts'
import { i18n } from './langue.ts'

/**
 * Enregistre l'abonnement push d'un appareil pour un compte (ADR 0024), et retire
 * celui qu'un autre compte y avait laissé (session expirée, compte archivé) : un
 * appareil ne sert qu'un compte. Sans cela, il continuerait de recevoir les
 * notifications du compte précédent, avec le nom de son organisation.
 *
 * Le retrait et l'écriture se font dans une même transaction, sous un verrou nommé
 * par appareil : deux comptes qui s'abonnent au même instant se suivent. La base
 * n'impose l'unicité que par compte et par appareil ; une unicité par appareil
 * demanderait une migration qui supprime des lignes.
 */
export async function abonnerAppareil(
  prisma: PrismaClient,
  userId: string,
  empreinte: string,
  donnees: { adresse: string; p256dh: string; auth: string; appareil: string }
): Promise<void> {
  const verrou = `push:${empreinte}`
  await prisma.$transaction(async tx => {
    const [{ pris }] = await tx.$queryRaw<
      [{ pris: bigint | number | null }]
    >`SELECT GET_LOCK(${verrou}, 5) AS pris`
    if (Number(pris) !== 1) {
      throw erreurSaisie(
        i18n._(
          'Cet appareil est en cours d’abonnement. Réessayez dans un instant.'
        )
      )
    }
    try {
      await tx.abonnementPush.deleteMany({
        where: { empreinte, userId: { not: userId } },
      })
      await tx.abonnementPush.upsert({
        where: { userId_empreinte: { userId, empreinte } },
        update: donnees,
        create: { userId, empreinte, ...donnees },
      })
    } finally {
      await tx.$queryRaw`SELECT RELEASE_LOCK(${verrou})`
    }
  })
}
