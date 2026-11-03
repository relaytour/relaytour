import { prisma, type Prisma } from '@relaytour/database'
import { z } from 'zod'

import { limiteAtteinte } from './erreurs.ts'
import { i18n } from './langue.ts'

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

// Les limites vues par l'administration de l'installation (ADR 0058). La limite de
// membres vit dans la colonne `limiteMembres`, hors de `limites` : le schéma strict
// d'une version antérieure refuserait la clé, et l'organisation perdrait toutes ses
// limites après un retour arrière (comme les modules, ADR 0052).
export const LimitesInstallationSchema = LimitesSchema.extend({
  membres: z.number().int().min(0).optional(),
})

export type LimitesInstallation = z.infer<typeof LimitesInstallationSchema>

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
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { timeout?: number } = {}
): Promise<T> {
  return prisma.$transaction(async tx => {
    await verrouillerOrganisation(tx, organisationId)
    return operation(tx)
  }, options)
}

async function verrouillerOrganisation(
  tx: Prisma.TransactionClient,
  organisationId: string
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM Organisation WHERE id = ${organisationId} FOR UPDATE`
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
      i18n._(
        '{activites, plural, one {Votre organisation a atteint sa limite de # activité. Archivez une activité ou demandez une limite plus haute.} other {Votre organisation a atteint sa limite de # activités. Archivez une activité ou demandez une limite plus haute.}}',
        { activites }
      ),
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
      i18n._(
        '{periodes, plural, one {Votre organisation a atteint sa limite de # période ouverte. Archivez une période terminée ou demandez une limite plus haute. Les périodes archivées restent consultables.} other {Votre organisation a atteint sa limite de # périodes ouvertes. Archivez une période terminée ou demandez une limite plus haute. Les périodes archivées restent consultables.}}',
        { periodes: periodesOuvertes }
      ),
      await contactHebergeur()
    )
  }
}

export interface PlacesMembres {
  /** Consomme une place, ou refuse quand la limite est atteinte. */
  prendre(): Promise<void>
}

/**
 * Les places de membres d'une organisation, pour une transaction qui peut y faire
 * entrer des personnes. À appeler avant toute lecture ordinaire de la transaction :
 * le verrou sur la ligne de l'organisation sérialise les entrées, et le comptage lit
 * l'état qui suit le verrou (sous MariaDB 11.8, une lecture faite avant fige la vue
 * de la transaction). Le comptage est lui-même une lecture ordinaire : un verrou de
 * compte que la transaction prend d'emblée (`verrouillerCompte`) le précède.
 *
 * Une place est une appartenance active ou une invitation en attente (ADR 0030) :
 * une invitation acceptée garde la place qu'elle occupait. L'appelant prend une
 * place pour un compte créé, une invitation nouvelle ou une personne rétablie, et
 * jamais pour une personne déjà membre. Le compteur avance dans la transaction : un
 * import et sa simulation refusent la même ligne.
 */
export async function placesMembres(
  tx: Prisma.TransactionClient,
  organisationId: string,
  instant = new Date()
): Promise<PlacesMembres> {
  await verrouillerOrganisation(tx, organisationId)
  const { limiteMembres: membres } = await tx.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { limiteMembres: true },
  })
  if (membres === null) return { prendre: async () => {} }
  const [actives, invitations] = await Promise.all([
    tx.appartenance.count({ where: { organisationId, archiveLe: null } }),
    tx.invitationOrganisation.count({
      where: { organisationId, expireLe: { gt: instant } },
    }),
  ])
  let occupees = actives + invitations
  return {
    prendre: async () => {
      if (occupees >= membres) {
        throw limiteAtteinte(
          i18n._(
            '{membres, plural, one {Votre organisation a atteint sa limite de # membre. Archivez une personne partie ou demandez une limite plus haute.} other {Votre organisation a atteint sa limite de # membres. Archivez une personne partie ou demandez une limite plus haute.}}',
            { membres }
          ),
          await contactHebergeur()
        )
      }
      occupees += 1
    },
  }
}
