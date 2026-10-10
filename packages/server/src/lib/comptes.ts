import { randomUUID } from 'node:crypto'

import type { Prisma, RoleOrganisation } from '@relaytour/database'

// Entrée d'une personne dans une organisation.
//
// Un compte est global (ADR 0008), mais les organisations sont cloisonnées (ADR 0030) :
// une adresse déjà connue hors de l'organisation n'y reçoit aucune appartenance.
// L'appelant enregistre une invitation, que la personne accepte ou refuse
// (lib/invitations.ts). L'invitation par un admin, l'acceptation d'une demande,
// l'import d'une équipe (ADR 0013) et l'invitation du premier admin passent tous par
// cette règle. Chaque appelant garde ses contrôles d'accès et ses messages d'erreur.

/**
 * Ce que l'appel a fait du compte :
 * - `cree` : aucun compte ne portait l'adresse, un compte et son appartenance naissent ;
 * - `externe` : le compte existe hors de l'organisation, rien n'est écrit : l'appelant
 *   enregistre une invitation, et n'en lit ni le nom ni aucune autre donnée ;
 * - `membre` : le compte appartient déjà à l'organisation, rien n'est écrit ;
 * - `archive` : le compte est archivé, rien n'est écrit. Le rétablir lui rendrait
 *   l'accès à ses autres organisations.
 */
export type IssueCompte = 'cree' | 'externe' | 'membre' | 'archive'

export interface CompteRattache {
  userId: string
  issue: IssueCompte
  /** Vrai quand le compte appartenait déjà à l'organisation, archivé ou non. */
  dejaMembre: boolean
  /**
   * Le nom porté par un compte déjà membre de l'organisation. Le nom appartient au
   * compte : il ne change pas. Null pour un compte créé et pour un compte externe,
   * dont l'organisation ne lit pas le nom avant l'acceptation.
   */
  nomDuCompte: string | null
}

/**
 * Crée le compte d'une adresse, ou dit ce qu'il en est de son compte existant.
 * `db` est le client Prisma ou la transaction de l'appelant. En `simulation`, la
 * fonction lit et décide sans rien écrire : un compte à créer reçoit un identifiant
 * qui n'existe pas en base.
 */
export async function creerOuRattacherCompte(
  db: Prisma.TransactionClient,
  demande: {
    email: string
    nom: string
    organisationId: string
    role: RoleOrganisation
    simulation?: boolean
  }
): Promise<CompteRattache> {
  const { email, nom, organisationId, role } = demande
  const ecrire = demande.simulation !== true
  const existant = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      appartenances: { where: { organisationId }, select: { id: true } },
    },
  })
  if (existant === null) {
    const userId = randomUUID()
    if (ecrire) {
      await db.user.create({
        data: {
          id: userId,
          email,
          name: nom,
          appartenances: { create: { organisationId, role } },
        },
      })
    }
    return { userId, issue: 'cree', dejaMembre: false, nomDuCompte: null }
  }
  const compte = {
    userId: existant.id,
    dejaMembre: existant.appartenances.length > 0,
    nomDuCompte: existant.name,
  }
  if (existant.archivedAt !== null) return { ...compte, issue: 'archive' }
  if (compte.dejaMembre) return { ...compte, issue: 'membre' }
  return { ...compte, nomDuCompte: null, issue: 'externe' }
}
