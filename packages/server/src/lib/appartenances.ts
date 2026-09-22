import { prisma, type RoleOrganisation } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { accesRefuse } from './erreurs.ts'

// Appartenances (ADR 0008) : un compte est global, il appartient à une ou plusieurs
// organisations avec un rôle dans chacune. Un admin n'agit que sur les membres de
// son organisation ; un compte inconnu et un compte d'une autre organisation donnent
// le même refus.

export interface Membre {
  role: RoleOrganisation
  /** Nombre d'autres organisations auxquelles le compte appartient. */
  autresOrganisations: number
}

/** Le rôle d'un compte dans l'organisation active, ou un refus s'il n'en est pas membre. */
export async function exigerMembre(
  ctx: AppContext,
  userId: string
): Promise<Membre> {
  if (ctx.organisation === null) throw accesRefuse()
  const appartenances = await prisma.appartenance.findMany({
    where: { userId },
    select: { organisationId: true, role: true },
  })
  const ici = appartenances.find(a => a.organisationId === ctx.organisation!.id)
  if (ici === undefined) throw accesRefuse()
  return { role: ici.role, autresOrganisations: appartenances.length - 1 }
}
