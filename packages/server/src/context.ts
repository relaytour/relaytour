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

export interface PersonneConnectee {
  id: string
  nom: string
  email: string
  /** Rôle ADMIN dans l'organisation active. Faux sans organisation active. */
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
  personne: PersonneConnectee | null
  /** Null sans session, sans appartenance, ou pour une organisation suspendue ou archivée. */
  organisation: OrganisationActive | null
  /** Identifiants des périmètres où la personne est affectée pour une édition donnée. */
  perimetresAffectes: (editionId: string) => Promise<Set<string>>
  /** Identifiants des périmètres de l'organisation où la personne a été affectée, toutes éditions confondues. */
  perimetresConnus: () => Promise<Set<string>>
  /**
   * L'activité demandée si elle appartient à l'organisation active, sinon un refus.
   * Sans identifiant, la première activité non archivée de l'organisation.
   */
  exigerActivite: (activiteId?: string | number | null) => Promise<string>
  /** L'édition si elle appartient à l'organisation active, sinon un refus. */
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
  organisationDemandee: string | null = null
): Promise<AppContext> {
  const user =
    userId === null
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

  let parDefaut: Promise<string | null> | undefined
  const exigerActivite = async (activiteId?: string | number | null) => {
    if (organisation === null) throw accesRefuse()
    if (activiteId !== undefined && activiteId !== null && activiteId !== '') {
      const activite = await prisma.activite.findFirst({
        where: { id: String(activiteId), organisationId: organisation.id },
        select: { id: true },
      })
      if (activite === null) throw accesRefuse()
      return activite.id
    }
    parDefaut ??= prisma.activite
      .findFirst({
        where: { organisationId: organisation.id, archivedAt: null },
        orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      })
      .then(a => a?.id ?? null)
    const id = await parDefaut
    if (id === null)
      throw erreurSaisie('Cette organisation n’a aucune activité.')
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
    return edition
  }

  return {
    ip,
    personne,
    organisation,
    perimetresAffectes,
    perimetresConnus,
    exigerActivite,
    exigerEdition,
  }
}
