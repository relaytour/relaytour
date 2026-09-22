import { prisma, type Prisma } from '@relaytour/database'

// Source de vérité du contenu (ADR 0009). Une modification du contenu faite dans
// l'application (identité, activités, périmètres) se date : un import du dossier
// de contenu refuse ensuite de l'écraser tant qu'un export ne l'a pas reprise.
// Les fiches ont leur propre protection : l'import signale un conflit sur une
// fiche modifiée dans l'application et ne la remplace pas.

export async function marquerContenuModifie(
  organisationId: string,
  // Sous le verrou de l'organisation, la transaction qui le détient.
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await db.organisation.update({
    where: { id: organisationId },
    data: { contenuModifieLe: new Date() },
  })
}
