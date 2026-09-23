import type { PrismaClient } from '@relaytour/database'

// Modes d'emploi publics de l'espace organisateur, un par rôle. Le mail
// d'invitation lie celui du rôle de la personne ; le menu du compte lie la liste.

export type RoleModeDEmploi =
  'admin-organisation' | 'admin-activite' | 'referent'

export const LIBELLES_ROLE: Record<RoleModeDEmploi, string> = {
  'admin-organisation': 'de l’admin de l’organisation',
  'admin-activite': 'de l’admin d’activité',
  referent: 'des référentes et référents',
}

/** Adresse de la page d'un rôle, sous la liste des modes d'emploi. */
export function lienModeDEmploi(base: string, role: RoleModeDEmploi): string {
  return `${base.endsWith('/') ? base : `${base}/`}${role}.html`
}

/**
 * Le rôle le plus large d'une personne dans une organisation : admin de
 * l'organisation, sinon admin d'au moins une activité (ADR 0010), sinon
 * référent·e. Sans organisation connue, toutes ses appartenances comptent.
 */
export async function roleDuModeDEmploi(
  prisma: PrismaClient,
  userId: string,
  organisationId: string | null | undefined
): Promise<RoleModeDEmploi> {
  const dansLOrganisation = organisationId == null ? {} : { organisationId }
  const [admin, adminActivite] = await Promise.all([
    prisma.appartenance.count({
      where: { userId, role: 'ADMIN', ...dansLOrganisation },
    }),
    prisma.adminActivite.count({ where: { userId, ...dansLOrganisation } }),
  ])
  if (admin > 0) return 'admin-organisation'
  if (adminActivite > 0) return 'admin-activite'
  return 'referent'
}
