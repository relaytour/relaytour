import type { PrismaClient } from '@relaytour/database'
import type { Langue } from '@relaytour/commun'

import { langueDe } from './langue.ts'
import { configurationOrganisation } from './organisation.ts'

/**
 * La langue d'un travail planifié pour une organisation : export des fiches,
 * vérification des accès. Les textes qu'il écrit en base se lisent par ses admins.
 */
export async function langueDeLOrganisation(
  organisationId: string
): Promise<Langue> {
  return langueDe(
    null,
    (await configurationOrganisation(organisationId)).langue
  )
}

/**
 * La langue d'un mail ou d'une notification push (ADR 0047) : le choix du compte
 * destinataire, sinon la langue de l'organisation qui écrit. Une fiche bénévole n'a
 * pas de compte : elle reçoit la langue de l'organisation.
 */
export async function langueDuDestinataire(
  prisma: PrismaClient,
  userId: string | undefined,
  organisationId: string | undefined
): Promise<Langue> {
  const user =
    userId === undefined
      ? null
      : await prisma.user.findUnique({
          where: { id: userId },
          select: { langue: true },
        })
  if (user?.langue) return langueDe(user.langue, null)
  return langueDe(
    null,
    (await configurationOrganisation(organisationId)).langue
  )
}
