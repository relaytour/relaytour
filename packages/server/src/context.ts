import {
  prisma,
  type RoleOrganisation,
  type StatutEdition,
  type StatutOrganisation,
} from '@relaytour/database'

import { accesRefuse, erreurSaisie } from './lib/erreurs.ts'

// Contexte de chaque requête GraphQL.
//
// Ce fichier n'importe pas auth.ts : le schéma en dépend (types), et l'impression du
// schéma doit fonctionner sans .env. Le serveur résout la session puis la passe ici.
//
// ADR 0008 : un compte est global, ses appartenances sont multiples. Le contexte
// porte l'organisation active et le rôle de la personne dans cette organisation.
// Une requête sans organisation active ne lit rien.

/** En-tête HTTP qui désigne l'organisation active, par son slug. */
export const ENTETE_ORGANISATION = 'x-relaytour-organisation'

/**
 * En-tête HTTP qui désigne l'activité affichée, par son slug. Une requête qui ne
 * précise pas d'activité porte sur celle-ci, sinon sur la première activité ouverte.
 */
export const ENTETE_ACTIVITE = 'x-relaytour-activite'

export interface PersonneConnectee {
  id: string
  nom: string
  email: string
  /**
   * Rôle ADMIN dans l'organisation active : admin de toutes ses activités. Faux sans
   * organisation active. L'admin d'une seule activité se lit par `estAdminDe`.
   */
  estAdmin: boolean
}

export interface OrganisationActive {
  id: string
  slug: string
  role: RoleOrganisation
  statut: StatutOrganisation
  fuseauHoraire: string
}

/** Une édition de l'organisation active, avec son activité. */
export interface EditionDuContexte {
  id: string
  activiteId: string
  annee: number
  statut: StatutEdition
}

export interface AppContext {
  ip: string | undefined
  /**
   * Requête porteuse du jeton d'administration de l'installation (ADR 0008). Elle n'a
   * ni personne ni organisation : seuls les champs réservés à l'administration répondent.
   */
  administration: boolean
  personne: PersonneConnectee | null
  /** Null sans session, sans appartenance, ou pour une organisation suspendue ou archivée. */
  organisation: OrganisationActive | null
  /** Identifiants des périmètres où la personne est affectée pour une édition donnée. */
  perimetresAffectes: (editionId: string) => Promise<Set<string>>
  /** Identifiants des périmètres de l'organisation où la personne a été affectée, toutes éditions confondues. */
  perimetresConnus: () => Promise<Set<string>>
  /**
   * Activités que la personne administre (ADR 0010) : toutes celles de
   * l'organisation pour un admin de l'organisation, celles où elle est nommée admin
   * sinon.
   */
  activitesAdministrees: () => Promise<Set<string>>
  /**
   * Activités que la personne voit : celles qu'elle administre, et celles où elle a
   * été affectée à un périmètre, toutes périodes confondues. Une activité hors de
   * cette liste n'existe pas pour elle : le serveur la refuse comme une activité
   * d'une autre organisation.
   */
  activitesVisibles: () => Promise<Set<string>>
  /** Vrai pour un admin de l'organisation, ou un admin de cette activité. */
  estAdminDe: (activiteId: string) => Promise<boolean>
  /** Refuse la requête si la personne n'administre pas cette activité. */
  exigerAdminDe: (activiteId: string) => Promise<void>
  /**
   * L'activité demandée si la personne la voit, sinon un refus. Sans identifiant,
   * l'activité de l'en-tête si elle est visible, sinon la première activité visible
   * et ouverte.
   */
  exigerActivite: (activiteId?: string | number | null) => Promise<string>
  /** L'édition si elle appartient à une activité visible, sinon un refus. */
  exigerEdition: (editionId: string | number) => Promise<EditionDuContexte>
}

interface Appartenance {
  role: RoleOrganisation
  organisation: {
    id: string
    slug: string
    statut: StatutOrganisation
    fuseauHoraire: string
  }
}

/**
 * Choisit l'organisation active parmi les appartenances : celle que l'en-tête
 * désigne, sinon l'unique appartenance. Plusieurs appartenances sans en-tête ne
 * donnent aucune organisation active. Une organisation suspendue ou archivée non plus.
 */
export function choisirOrganisation(
  appartenances: Appartenance[],
  demandee: string | null
): OrganisationActive | null {
  const choisie =
    demandee === null
      ? appartenances.length === 1
        ? appartenances[0]
        : undefined
      : appartenances.find(a => a.organisation.slug === demandee)
  if (choisie === undefined) return null
  const { statut } = choisie.organisation
  if (statut === 'SUSPENDUE' || statut === 'ARCHIVEE') return null
  return { ...choisie.organisation, role: choisie.role }
}

export async function buildContext(
  ip: string | undefined,
  userId: string | null,
  organisationDemandee: string | null = null,
  administration = false,
  activiteDemandee: string | null = null
): Promise<AppContext> {
  // Le jeton d'administration ignore toute session.
  const user =
    userId === null || administration
      ? null
      : await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            archivedAt: true,
            appartenances: {
              select: {
                role: true,
                organisation: {
                  select: {
                    id: true,
                    slug: true,
                    statut: true,
                    fuseauHoraire: true,
                  },
                },
              },
            },
          },
        })

  // Un compte archivé est traité comme une requête anonyme, même avec une session encore valide.
  const actif = user !== null && user.archivedAt === null
  const organisation = actif
    ? choisirOrganisation(user.appartenances, organisationDemandee)
    : null
  const personne = actif
    ? {
        id: user.id,
        nom: user.name,
        email: user.email,
        estAdmin: organisation?.role === 'ADMIN',
      }
    : null

  const cache = new Map<string, Promise<Set<string>>>()
  const perimetresAffectes = (editionId: string) => {
    if (personne === null || organisation === null)
      return Promise.resolve(new Set<string>())
    let resultat = cache.get(editionId)
    if (resultat === undefined) {
      resultat = prisma.affectation
        .findMany({
          where: {
            userId: personne.id,
            editionId,
            perimetre: { organisationId: organisation.id },
          },
          select: { perimetreId: true },
        })
        .then(lignes => new Set(lignes.map(l => l.perimetreId)))
      cache.set(editionId, resultat)
    }
    return resultat
  }

  let connus: Promise<Set<string>> | undefined
  const perimetresConnus = () => {
    if (personne === null || organisation === null)
      return Promise.resolve(new Set<string>())
    connus ??= prisma.affectation
      .findMany({
        where: {
          userId: personne.id,
          perimetre: { organisationId: organisation.id },
        },
        select: { perimetreId: true },
        distinct: ['perimetreId'],
      })
      .then(lignes => new Set(lignes.map(l => l.perimetreId)))
    return connus
  }

  let administrees: Promise<Set<string>> | undefined
  const activitesAdministrees = () => {
    if (personne === null || organisation === null)
      return Promise.resolve(new Set<string>())
    administrees ??= (
      personne.estAdmin
        ? prisma.activite
            .findMany({
              where: { organisationId: organisation.id },
              select: { id: true },
            })
            .then(lignes => lignes.map(l => l.id))
        : prisma.adminActivite
            .findMany({
              where: {
                userId: personne.id,
                organisationId: organisation.id,
                activite: { organisationId: organisation.id },
              },
              select: { activiteId: true },
            })
            .then(lignes => lignes.map(l => l.activiteId))
    ).then(ids => new Set(ids))
    return administrees
  }

  let visibles: Promise<Set<string>> | undefined
  const activitesVisibles = () => {
    if (personne === null || organisation === null)
      return Promise.resolve(new Set<string>())
    visibles ??= Promise.all([
      activitesAdministrees(),
      personne.estAdmin
        ? Promise.resolve([])
        : prisma.perimetre.findMany({
            where: {
              organisationId: organisation.id,
              affectations: { some: { userId: personne.id } },
            },
            select: { activiteId: true },
            distinct: ['activiteId'],
          }),
    ]).then(
      ([admin, affectees]) =>
        new Set([...admin, ...affectees.map(p => p.activiteId)])
    )
    return visibles
  }

  const estAdminDe = async (activiteId: string) =>
    (await activitesAdministrees()).has(activiteId)

  const exigerAdminDe = async (activiteId: string) => {
    if (!(await estAdminDe(activiteId))) throw accesRefuse()
  }

  let parDefaut: Promise<string | null> | undefined
  const exigerActivite = async (activiteId?: string | number | null) => {
    if (organisation === null) throw accesRefuse()
    const visiblesIci = await activitesVisibles()
    if (activiteId !== undefined && activiteId !== null && activiteId !== '') {
      // Une activité invisible vaut une activité d'une autre organisation.
      if (!visiblesIci.has(String(activiteId))) throw accesRefuse()
      return String(activiteId)
    }
    // L'activité affichée par l'espace organisateur si elle est visible, sinon la
    // première activité visible et ouverte.
    parDefaut ??= (
      activiteDemandee === null
        ? Promise.resolve(null)
        : prisma.activite.findFirst({
            where: {
              organisationId: organisation.id,
              slug: activiteDemandee,
              id: { in: [...visiblesIci] },
            },
            select: { id: true },
          })
    )
      .then(
        demandee =>
          demandee ??
          prisma.activite.findFirst({
            where: {
              organisationId: organisation.id,
              archivedAt: null,
              id: { in: [...visiblesIci] },
            },
            orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true },
          })
      )
      .then(a => a?.id ?? null)
    const id = await parDefaut
    // Sans aucune activité visible, la requête est refusée comme une requête
    // interdite : elle ne dit rien des activités qui existent.
    if (visiblesIci.size === 0) throw accesRefuse()
    if (id === null)
      throw erreurSaisie('Aucune activité ouverte ne vous est accessible.')
    return id
  }

  const editions = new Map<string, Promise<EditionDuContexte | null>>()
  const exigerEdition = async (editionId: string | number) => {
    if (organisation === null) throw accesRefuse()
    const id = String(editionId)
    let resultat = editions.get(id)
    if (resultat === undefined) {
      resultat = prisma.edition.findFirst({
        where: { id, organisationId: organisation.id },
        select: { id: true, activiteId: true, annee: true, statut: true },
      })
      editions.set(id, resultat)
    }
    const edition = await resultat
    if (edition === null) throw accesRefuse()
    // Une édition d'une activité invisible vaut une édition inconnue.
    if (!(await activitesVisibles()).has(edition.activiteId))
      throw accesRefuse()
    return edition
  }

  return {
    ip,
    administration,
    personne,
    organisation,
    perimetresAffectes,
    perimetresConnus,
    activitesAdministrees,
    activitesVisibles,
    estAdminDe,
    exigerAdminDe,
    exigerActivite,
    exigerEdition,
  }
}
