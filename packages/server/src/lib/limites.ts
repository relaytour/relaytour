import { prisma, type Prisma } from '@relaytour/database'
import { z } from 'zod'

import { limiteAtteinte } from './erreurs.ts'

// Limites d'une organisation (ADR 0008).
//
// L'administration de l'installation les fixe ; une organisation auto-hébergée n'en
// a aucune. Une limite bloque une création ou une réouverture, jamais la lecture ni
// l'export. Elle ne porte que sur ce qui n'est pas archivé : archiver une activité ou
// une période libère la place.

export const LimitesSchema = z.strictObject({
  activites: z.number().int().min(0).optional(),
  periodesOuvertes: z.number().int().min(0).optional(),
})

export type Limites = z.infer<typeof LimitesSchema>

/** Les limites portées par la colonne JSON. Une valeur illisible vaut aucune limite. */
export function lireLimites(brut: unknown): Limites {
  const r = LimitesSchema.safeParse(brut ?? {})
  return r.success ? r.data : {}
}

async function contactHebergeur(): Promise<string | undefined> {
  // Import paresseux : le schéma se charge sans .env (invariant 12).
  const { env } = await import('../env.ts')
  return env.CONTACT_HEBERGEUR
}

type Client = Prisma.TransactionClient | typeof prisma

/**
 * Exécute une création ou un changement d'état sous le verrou de la ligne de
 * l'organisation. Le comptage d'une limite et l'écriture qui la consomme se font
 * ainsi dans la même transaction : deux requêtes simultanées ne dépassent jamais
 * une limite, et deux archivages simultanés ne ferment pas la dernière activité.
 */
export async function sousVerrouOrganisation<T>(
  organisationId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Organisation WHERE id = ${organisationId} FOR UPDATE`
    return operation(tx)
  })
}

async function limitesDe(organisationId: string, db: Client): Promise<Limites> {
  const organisation = await db.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { limites: true },
  })
  return lireLimites(organisation.limites)
}

/**
 * Refuse une activité de plus quand la limite est atteinte. Appelée sous
 * `sousVerrouOrganisation`, avec sa transaction, pour que le contrôle tienne.
 */
export async function exigerPlaceActivite(
  organisationId: string,
  db: Client = prisma
): Promise<void> {
  const { activites } = await limitesDe(organisationId, db)
  if (activites === undefined) return
  const nombre = await db.activite.count({
    where: { organisationId, archivedAt: null },
  })
  if (nombre >= activites) {
    throw limiteAtteinte(
      `Votre organisation a atteint sa limite de ${activites} activité${activites > 1 ? 's' : ''}. Archivez une activité ou demandez une limite plus haute.`,
      await contactHebergeur()
    )
  }
}

/** Refuse une période ouverte de plus quand la limite est atteinte. */
export async function exigerPlacePeriode(
  organisationId: string,
  db: Client = prisma
): Promise<void> {
  const { periodesOuvertes } = await limitesDe(organisationId, db)
  if (periodesOuvertes === undefined) return
  const nombre = await db.edition.count({
    where: { organisationId, statut: { not: 'ARCHIVEE' } },
  })
  if (nombre >= periodesOuvertes) {
    throw limiteAtteinte(
      `Votre organisation a atteint sa limite de ${periodesOuvertes} période${periodesOuvertes > 1 ? 's' : ''} ouverte${periodesOuvertes > 1 ? 's' : ''}. Archivez une période terminée ou demandez une limite plus haute. Les périodes archivées restent consultables.`,
      await contactHebergeur()
    )
  }
}
