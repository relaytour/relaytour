import { prisma, type Prisma, type RoleOrganisation } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { accesRefuse, erreurSaisie } from './erreurs.ts'

// Appartenances (ADR 0008) : un compte est global, il appartient à une ou plusieurs
// organisations avec un rôle dans chacune. Un admin n'agit que sur les membres de
// son organisation ; un compte inconnu et un compte d'une autre organisation donnent
// le même refus.

export interface Membre {
  role: RoleOrganisation
  /** Vrai quand la personne est archivée dans l'organisation active (ADR 0031). */
  archive: boolean
}

/**
 * Le rôle d'un compte dans l'organisation active, ou un refus s'il n'en est pas
 * membre. Une personne archivée dans l'organisation reste membre : un admin la lit
 * et la rétablit. La réponse ne dépend d'aucune autre organisation du compte.
 */
export async function exigerMembre(
  ctx: AppContext,
  userId: string
): Promise<Membre> {
  if (ctx.organisation === null) throw accesRefuse()
  const ici = await prisma.appartenance.findUnique({
    where: {
      userId_organisationId: { userId, organisationId: ctx.organisation.id },
    },
    select: { role: true, archiveLe: true },
  })
  if (ici === null) throw accesRefuse()
  return { role: ici.role, archive: ici.archiveLe !== null }
}

const PERSONNE_ARCHIVEE =
  'Cette personne est archivée dans votre organisation : un admin de l’organisation la rétablit depuis l’annuaire.'

/**
 * Refuse d'affecter, de nommer ou d'accorder un droit à une personne archivée dans
 * l'organisation (ADR 0031). Retirer une affectation, un rôle ou un droit reste
 * permis : un admin range ainsi la place d'une personne partie.
 */
export function refuserArchivee(membre: Membre): void {
  if (membre.archive) throw erreurSaisie(PERSONNE_ARCHIVEE)
}

/**
 * Le filtre Prisma d'un compte membre actif d'une organisation : il y appartient, et
 * n'y est pas archivé (ADR 0031). L'archivage d'une personne dans une autre
 * organisation ne compte pas.
 */
export function membreActif(organisationId: string) {
  return {
    appartenances: { some: { organisationId, archiveLe: null } },
  } as const
}

/**
 * Vrai quand le mail ne doit pas partir : la personne est archivée dans
 * l'organisation qui écrit, ou, sans organisation connue, n'a plus aucune
 * appartenance active. Une personne sans appartenance dans l'organisation qui écrit
 * (une invitation en attente, ADR 0030) reçoit son mail.
 */
export function archiveePourCeMail(
  appartenances: { organisationId: string; archiveLe: Date | null }[],
  organisationId: string | undefined
): boolean {
  if (organisationId === undefined) {
    return (
      appartenances.length > 0 && appartenances.every(a => a.archiveLe !== null)
    )
  }
  const ici = appartenances.find(a => a.organisationId === organisationId)
  return ici !== undefined && ici.archiveLe !== null
}

/**
 * Tient à jour `User.sansAppartenanceActiveLe` (colonne `archivedAt`), valeur
 * dérivée : une date quand le compte n'a aucune appartenance active, rien sinon. Le
 * code ne la lit pas ; une version antérieure, elle, y lit l'archivage du compte
 * (ADR 0031). À appeler dans la transaction qui archive, rétablit ou crée une
 * appartenance. Deux archivages simultanés du même compte se règlent par
 * `verrouillerCompte`, pris en tête de transaction.
 */
/**
 * Verrouille la ligne du compte pour la transaction. À prendre avant toute lecture :
 * sous l'isolation de MariaDB 11.8, une lecture ordinaire fige la vue de la
 * transaction, et un verrou pris ensuite échoue sur une ligne modifiée entre-temps.
 * Deux archivages simultanés dans deux organisations comptent ainsi l'un après
 * l'autre les appartenances actives.
 */
export async function verrouillerCompte(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`
}

export async function synchroniserArchivageDuCompte(
  tx: Prisma.TransactionClient,
  userId: string,
  instant = new Date()
): Promise<void> {
  const [actives, compte] = await Promise.all([
    tx.appartenance.count({ where: { userId, archiveLe: null } }),
    tx.user.findUnique({
      where: { id: userId },
      select: { sansAppartenanceActiveLe: true },
    }),
  ])
  if (compte === null) return
  const attendue = actives === 0
  if (attendue === (compte.sansAppartenanceActiveLe !== null)) return
  await tx.user.update({
    where: { id: userId },
    data: { sansAppartenanceActiveLe: attendue ? instant : null },
  })
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

/**
 * L'équipe d'une activité sans les personnes qui n'y ont qu'un souhait : une
 * affectation ou un rôle d'admin de l'activité. Une personne qui n'a qu'un
 * souhait découvre l'activité sans la voir (ADR 0012) : elle ne lit ni son
 * agenda ni son programme, et une réunion ou une séquence ne la vise donc pas.
 */
export function dansLEquipeQuiVoit(
  activiteIds: string[]
): Prisma.UserWhereInput {
  const ici = { activiteId: { in: activiteIds } }
  return {
    OR: [
      { affectations: { some: { perimetre: ici } } },
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
  membresParRequete.delete(ctx)
}

// Les membres de l'organisation active, avec la date de leur arrivée et celle de
// leur archivage, lus une fois par requête : l'annuaire les demande pour chaque
// personne.
export interface MembreDeLOrganisation {
  arrivee: Date
  archiveLe: Date | null
}
const membresParRequete = new WeakMap<
  AppContext,
  Promise<Map<string, MembreDeLOrganisation>>
>()

/**
 * Chaque membre de l'organisation active, archivé ou non. Un compte absent de cette
 * liste n'est pas membre : rien de lui ne se lit depuis cette organisation, même
 * s'il existe ailleurs sur l'installation (ADR 0030).
 */
export function membresDeLOrganisation(
  ctx: AppContext
): Promise<Map<string, MembreDeLOrganisation>> {
  let membres = membresParRequete.get(ctx)
  if (membres === undefined) {
    membres =
      ctx.organisation === null
        ? Promise.resolve(new Map<string, MembreDeLOrganisation>())
        : prisma.appartenance
            .findMany({
              where: { organisationId: ctx.organisation.id },
              select: { userId: true, createdAt: true, archiveLe: true },
            })
            .then(
              lignes =>
                new Map(
                  lignes.map(l => [
                    l.userId,
                    { arrivee: l.createdAt, archiveLe: l.archiveLe },
                  ])
                )
            )
    membresParRequete.set(ctx, membres)
  }
  return membres
}
