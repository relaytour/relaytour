import { randomUUID } from 'node:crypto'

import { prisma, type Prisma } from '@relaytour/database'

import { erreurSaisie } from './erreurs.ts'
import { i18n } from './langue.ts'
import { placesMembres } from './limites.ts'
import { rattacher } from './rattachements.ts'

// Robots (ADR 0064).
//
// Un robot est un membre de l'organisation sans connexion. Un admin de
// l'organisation le crée pour une automatisation partagée : une synchronisation
// avec un outil de gestion de projet, un script d'équipe. Le robot reçoit ses
// droits comme une personne (rattachements, affectations, rôle d'admin d'une
// activité) et porte des jetons d'accès. Ses actions ont ainsi un auteur dans le
// journal, le fil d'une tâche et les notifications.
//
// Un robot n'a pas d'adresse joignable : son adresse est dans le domaine réservé
// `.invalid` (RFC 2606). Aucun mail ne lui part, aucun code de connexion ne se
// prépare pour lui, et personne ne l'invite par son adresse. Il n'est jamais
// admin de l'organisation.

/** Robots actifs (non archivés) d'une organisation. */
export const ROBOTS_MAX = 5

/** Le domaine des adresses techniques des robots. */
export const DOMAINE_ROBOT = 'robot.invalid'

/** Vrai pour une adresse que nul serveur ne reçoit (RFC 2606). */
export function adresseInjoignable(adresse: string): boolean {
  return /\.invalid$/i.test(adresse.trim())
}

/**
 * Refuse un robot de plus quand l'organisation compte déjà ROBOTS_MAX robots actifs.
 * L'appelant tient le verrou de l'organisation : deux entrées simultanées ne
 * dépassent pas le plafond.
 */
export async function exigerPlaceRobot(
  tx: Prisma.TransactionClient,
  organisationId: string
): Promise<void> {
  const actifs = await tx.appartenance.count({
    where: { organisationId, archiveLe: null, user: { robot: true } },
  })
  if (actifs >= ROBOTS_MAX) {
    throw erreurSaisie(
      i18n._(
        'Votre organisation a déjà {max} robots actifs : archivez-en un avant d’en créer un autre.',
        { max: ROBOTS_MAX }
      )
    )
  }
}

/**
 * Crée un robot dans l'organisation et le rattache aux activités choisies. Le robot
 * prend une place de membre (ADR 0058). Le plafond se vérifie sous le verrou de
 * l'organisation, que `placesMembres` prend avant tout comptage.
 */
export async function creerRobot(demande: {
  organisationId: string
  nom: string
  activiteIds: string[]
  creeParId: string
}): Promise<{ id: string }> {
  const id = randomUUID()
  return prisma.$transaction(async tx => {
    const places = await placesMembres(tx, demande.organisationId)
    await exigerPlaceRobot(tx, demande.organisationId)
    await places.prendre()
    await tx.user.create({
      data: {
        id,
        name: demande.nom,
        email: `robot-${id}@${DOMAINE_ROBOT}`,
        emailVerified: false,
        robot: true,
        appartenances: {
          create: { organisationId: demande.organisationId, role: 'MEMBRE' },
        },
      },
    })
    await rattacher(tx, {
      userId: id,
      activiteIds: demande.activiteIds,
      organisationId: demande.organisationId,
      creeParId: demande.creeParId,
    })
    return { id }
  })
}
