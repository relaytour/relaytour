import { prisma, type Prisma, type RoleOrganisation } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { accesRefuse, erreurSaisie } from './erreurs.ts'

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

const ADMIN_DE_L_ORGANISATION =
  'Seul un admin de l’organisation agit sur le compte d’un admin de l’organisation.'

/**
 * Refuse à un admin d'activité d'agir sur un admin de l'organisation (ADR 0019) :
 * ni affectation, ni souhait, ni rôle. Le refus est explicite : un admin d'activité
 * lit déjà qui administre l'organisation. `db` est le client Prisma ou la
 * transaction de l'appelant.
 */
export async function refuserAdminDeLOrganisation(
  ctx: AppContext,
  userId: string,
  db: Prisma.TransactionClient = prisma
): Promise<void> {
  if (ctx.personne?.estAdmin === true || ctx.organisation === null) return
  const appartenance = await db.appartenance.findUnique({
    where: {
      userId_organisationId: { userId, organisationId: ctx.organisation.id },
    },
    select: { role: true },
  })
  if (appartenance?.role === 'ADMIN')
    throw erreurSaisie(ADMIN_DE_L_ORGANISATION)
}

/**
 * Le rôle d'un compte que la personne connectée peut gérer (ADR 0018) : tout membre
 * pour un admin de l'organisation, une personne de ses équipes pour un admin
 * d'activité. Un membre hors de ses équipes, un compte inconnu et un compte d'une
 * autre organisation donnent le même refus. Un admin d'activité ne gère jamais un
 * admin de l'organisation (ADR 0019).
 */
export async function exigerMembreGere(
  ctx: AppContext,
  userId: string
): Promise<Membre> {
  const membre = await exigerMembre(ctx, userId)
  if (ctx.personne?.estAdmin === true) return membre
  if (membre.role === 'ADMIN') throw erreurSaisie(ADMIN_DE_L_ORGANISATION)
  if (!(await ctx.equipeAdministree()).has(userId)) throw accesRefuse()
  return membre
}

/**
 * Le filtre des comptes qui font partie de l'équipe d'au moins une de ces activités
 * (ADR 0018) : une affectation, un souhait ou un rôle d'admin, toutes périodes
 * confondues. Aucune table ne porte ce lien : il se déduit.
 */
export function dansLEquipe(activiteIds: string[]): Prisma.UserWhereInput {
  const ici = { activiteId: { in: activiteIds } }
  return {
    OR: [
      { affectations: { some: { perimetre: ici } } },
      { souhaits: { some: { perimetre: ici } } },
      { adminsActivite: { some: ici } },
    ],
  }
}

/** Le lien d'une personne avec une activité, toutes périodes confondues (ADR 0018). */
export interface AttributionActivite {
  activiteId: string
  affectee: boolean
  interessee: boolean
  admin: boolean
}

// Les attributions de tous les membres d'une organisation, lues une fois par requête :
// l'annuaire les demande pour chaque personne.
const attributionsParRequete = new WeakMap<
  AppContext,
  Promise<Map<string, AttributionActivite[]>>
>()

export function attributionsDeLOrganisation(
  ctx: AppContext
): Promise<Map<string, AttributionActivite[]>> {
  let attributions = attributionsParRequete.get(ctx)
  if (attributions === undefined) {
    const organisationId = ctx.organisation?.id ?? ''
    const parPerimetre = {
      where: { perimetre: { organisationId } },
      select: { userId: true, perimetre: { select: { activiteId: true } } },
    }
    attributions = Promise.all([
      prisma.affectation.findMany(parPerimetre),
      prisma.souhait.findMany(parPerimetre),
      prisma.adminActivite.findMany({
        where: { organisationId },
        select: { userId: true, activiteId: true },
      }),
    ]).then(([affectations, souhaits, admins]) => {
      const parPersonne = new Map<string, Map<string, AttributionActivite>>()
      const noter = (
        userId: string,
        activiteId: string,
        lien: 'affectee' | 'interessee' | 'admin'
      ) => {
        const activites =
          parPersonne.get(userId) ?? new Map<string, AttributionActivite>()
        parPersonne.set(userId, activites)
        const attribution = activites.get(activiteId) ?? {
          activiteId,
          affectee: false,
          interessee: false,
          admin: false,
        }
        attribution[lien] = true
        activites.set(activiteId, attribution)
      }
      for (const a of affectations)
        noter(a.userId, a.perimetre.activiteId, 'affectee')
      for (const s of souhaits)
        noter(s.userId, s.perimetre.activiteId, 'interessee')
      for (const a of admins) noter(a.userId, a.activiteId, 'admin')
      return new Map(
        [...parPersonne].map(([userId, activites]) => [
          userId,
          [...activites.values()],
        ])
      )
    })
    attributionsParRequete.set(ctx, attributions)
  }
  return attributions
}

/**
 * À appeler après une écriture qui crée ou retire un lien d'équipe (affectation,
 * souhait, rôle d'admin d'activité). Les champs racine d'une mutation s'exécutent
 * l'un après l'autre avec le même contexte : sans cet oubli, le second lirait
 * l'équipe et les attributions d'avant la première écriture.
 */
export function equipesModifiees(ctx: AppContext): void {
  ctx.oublierLesEquipes()
  attributionsParRequete.delete(ctx)
}
