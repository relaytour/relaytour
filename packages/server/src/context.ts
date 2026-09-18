import { prisma } from '@relaytour/database'

// Contexte de chaque requête GraphQL.
//
// Ce fichier n'importe pas auth.ts : le schéma en dépend (types), et l'impression du
// schéma doit fonctionner sans .env. Le serveur résout la session puis la passe ici.

export interface PersonneConnectee {
  id: string
  nom: string
  email: string
  estAdmin: boolean
}

export interface AppContext {
  ip: string | undefined
  personne: PersonneConnectee | null
  /** Identifiants des périmètres où la personne est affectée pour une édition donnée. */
  perimetresAffectes: (editionId: string) => Promise<Set<string>>
  /** Identifiants des périmètres où la personne a été affectée, toutes éditions confondues. */
  perimetresConnus: () => Promise<Set<string>>
}

export async function buildContext(
  ip: string | undefined,
  userId: string | null
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
            isAdmin: true,
            archivedAt: true,
          },
        })

  // Un compte archivé est traité comme une requête anonyme, même avec une session encore valide.
  const personne =
    user === null || user.archivedAt !== null
      ? null
      : {
          id: user.id,
          nom: user.name,
          email: user.email,
          estAdmin: user.isAdmin,
        }

  const cache = new Map<string, Promise<Set<string>>>()
  const perimetresAffectes = (editionId: string) => {
    if (personne === null) return Promise.resolve(new Set<string>())
    let resultat = cache.get(editionId)
    if (resultat === undefined) {
      resultat = prisma.affectation
        .findMany({
          where: { userId: personne.id, editionId },
          select: { perimetreId: true },
        })
        .then(lignes => new Set(lignes.map(l => l.perimetreId)))
      cache.set(editionId, resultat)
    }
    return resultat
  }

  let connus: Promise<Set<string>> | undefined
  const perimetresConnus = () => {
    if (personne === null) return Promise.resolve(new Set<string>())
    connus ??= prisma.affectation
      .findMany({
        where: { userId: personne.id },
        select: { perimetreId: true },
        distinct: ['perimetreId'],
      })
      .then(lignes => new Set(lignes.map(l => l.perimetreId)))
    return connus
  }

  return { ip, personne, perimetresAffectes, perimetresConnus }
}
