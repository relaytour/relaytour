import { prisma, type PrismaClient } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { publierNotification } from './flux.ts'
import { journal } from './journal.ts'
import { i18n } from './langue.ts'

// Mails d'équipe (ADR 0012) : l'invitation liste les périmètres de la personne, et un
// mail « Votre place dans l'équipe a changé » annonce une nouvelle affectation ou un
// nouveau rôle d'admin. Aucun mail ne part pour un souhait, pour la désignation d'un
// contact principal, ni pour un retrait.
//
// Les changements d'une personne se regroupent par fenêtre fixe de dix minutes : le
// premier changement d'une fenêtre place un mail différé jusqu'à sa fin, les suivants
// retrouvent le même identifiant de job et BullMQ les ignore. À l'envoi, le mail relit
// les affectations et les rôles créés pendant la fenêtre : un changement annulé entre-
// temps ne s'annonce pas.

export const FENETRE_EQUIPE_MS = 10 * 60 * 1000
/** Marge après la fin de la fenêtre, pour qu'une écriture de la dernière seconde soit lue. */
const MARGE_MS = 5_000

export interface FenetreEquipe {
  debut: string
  fin: string
}

/** La fenêtre de regroupement qui contient l'instant donné. */
export function fenetreEquipe(maintenant = Date.now()): FenetreEquipe {
  const debut = Math.floor(maintenant / FENETRE_EQUIPE_MS) * FENETRE_EQUIPE_MS
  return {
    debut: new Date(debut).toISOString(),
    fin: new Date(debut + FENETRE_EQUIPE_MS).toISOString(),
  }
}

/**
 * Annonce un changement de la place d'une personne dans l'équipe. Ne lève jamais :
 * comme toute mise en file, un échec est journalisé et l'action métier aboutit.
 *
 * `instant` est la date écrite en base avec le changement : la fenêtre se déduit
 * d'elle, jamais de l'heure de l'annonce, sinon un changement écrit juste avant la
 * fin d'une fenêtre serait cherché dans la suivante. Un changement d'une activité
 * porte son identité ; un rôle d'organisation, celle de l'organisation. Chaque
 * activité et l'organisation ont donc leur propre mail, et leur propre job.
 */
export async function annoncerChangementEquipe(
  userId: string,
  options: { organisationId: string; activiteId?: string; instant: Date },
  maintenant = Date.now()
): Promise<void> {
  const fenetre = fenetreEquipe(options.instant.getTime())
  const portee = options.activiteId ?? 'organisation'
  // Le mail a sa notification dans l'application (ADR 0033).
  await notifierPlace(userId, options)
  await mettreEnFile(
    'equipe',
    { userId },
    {
      organisationId: options.organisationId,
      ...(options.activiteId === undefined
        ? {}
        : { activiteId: options.activiteId }),
      // BullMQ refuse « : » dans un identifiant de job. Une personne peut appartenir
      // à plusieurs organisations : l'organisation entre dans l'identifiant.
      jobId: `equipe-${options.organisationId}-${portee}-${userId}-${Date.parse(fenetre.debut)}`,
      delai: Date.parse(fenetre.fin) - maintenant + MARGE_MS,
      fenetre,
    }
  )
}

/**
 * Prévient une personne, dans l'application, que sa place dans l'équipe a changé
 * (ADR 0033). Une notification par activité et par fenêtre de dix minutes, comme le
 * mail. Ne lève jamais.
 */
export async function notifierPlace(
  userId: string,
  options: { organisationId: string; activiteId?: string; instant: Date }
): Promise<void> {
  const { organisationId } = options
  const debut = Date.parse(fenetreEquipe(options.instant.getTime()).debut)
  try {
    await prisma.notification.create({
      data: {
        organisationId,
        userId,
        type: 'PLACE_MODIFIEE',
        activiteId: options.activiteId ?? null,
        cle: `PLACE_MODIFIEE-${organisationId}-${options.activiteId ?? 'organisation'}-${userId}-${debut}`,
      },
      select: { id: true },
    })
    publierNotification(organisationId, userId)
  } catch (erreur) {
    // P2002 : la personne est déjà prévenue pour cette fenêtre.
    if ((erreur as { code?: string }).code === 'P2002') return
    journal.error(
      {
        evenement: 'notification-echouee',
        type: 'PLACE_MODIFIEE',
        message: (erreur as Error).message,
      },
      'Une notification n’a pas pu être créée.'
    )
  }
}

/** « Football (Rencontres 2027) : le tournoi à 7 contre 7… », ou le nom seul. */
function lignePerimetre(p: {
  perimetre: { nom: string; description: string | null }
  edition: { nom: string }
}): string {
  const perimetre = p.perimetre.nom
  const edition = p.edition.nom
  return p.perimetre.description === null
    ? i18n._('{perimetre} ({edition})', { perimetre, edition })
    : i18n._('{perimetre} ({edition}) : {description}', {
        perimetre,
        edition,
        description: p.perimetre.description,
      })
}

/**
 * Les périmètres de la personne dans l'organisation, pour ses périodes non archivées,
 * avec leur description : la liste du mail d'invitation.
 */
export async function perimetresDeLaPersonne(
  prisma: PrismaClient,
  userId: string,
  organisationId: string
): Promise<string[]> {
  const affectations = await prisma.affectation.findMany({
    where: {
      userId,
      perimetre: { organisationId, archivedAt: null },
      edition: { statut: { not: 'ARCHIVEE' } },
    },
    select: {
      perimetre: { select: { nom: true, description: true, ordre: true } },
      edition: { select: { nom: true } },
    },
    orderBy: [{ edition: { annee: 'desc' } }, { perimetre: { ordre: 'asc' } }],
  })
  return affectations.map(lignePerimetre)
}

/**
 * Les changements de la place d'une personne pendant une fenêtre. Avec une activité :
 * ses nouvelles affectations et sa nomination comme admin de cette activité. Sans
 * activité : son passage admin de l'organisation. Une liste vide veut dire que rien
 * n'est à annoncer.
 */
export async function changementsEquipe(
  prisma: PrismaClient,
  userId: string,
  organisationId: string,
  fenetre: FenetreEquipe,
  activiteId?: string
): Promise<string[]> {
  const pendant = { gte: new Date(fenetre.debut), lt: new Date(fenetre.fin) }
  const [affectations, admins, appartenance] = await Promise.all([
    prisma.affectation.findMany({
      where: {
        userId,
        createdAt: pendant,
        // Sans activité, le mail ne porte que le rôle d'organisation.
        perimetre: {
          organisationId,
          archivedAt: null,
          activiteId: activiteId ?? '',
        },
        edition: { statut: { not: 'ARCHIVEE' } },
      },
      select: {
        perimetre: { select: { nom: true, description: true } },
        edition: { select: { nom: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.adminActivite.findMany({
      where: {
        userId,
        organisationId,
        activiteId: activiteId ?? '',
        createdAt: pendant,
      },
      select: { activite: { select: { nom: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.appartenance.findUnique({
      where: { userId_organisationId: { userId, organisationId } },
      select: {
        role: true,
        createdAt: true,
        updatedAt: true,
        organisation: { select: { nom: true } },
      },
    }),
  ])
  const changements = affectations.map(a =>
    i18n._('Vous rejoignez le périmètre {perimetre}', {
      perimetre: lignePerimetre(a),
    })
  )
  for (const admin of admins) {
    changements.push(
      i18n._(
        'Vous devenez admin de l’activité {activite} : vous gérez ses périodes, ses périmètres et son équipe.',
        { activite: admin.activite.nom }
      )
    )
  }
  // Une appartenance créée pendant la fenêtre est une invitation, déjà annoncée par
  // son propre mail. Une appartenance plus ancienne passée admin est une nomination.
  if (
    activiteId === undefined &&
    appartenance !== null &&
    appartenance.role === 'ADMIN' &&
    appartenance.createdAt < new Date(fenetre.debut) &&
    appartenance.updatedAt >= new Date(fenetre.debut) &&
    appartenance.updatedAt < new Date(fenetre.fin)
  ) {
    changements.push(
      i18n._(
        'Vous devenez admin de l’organisation {organisation} : vous gérez toutes ses activités et ses comptes.',
        { organisation: appartenance.organisation.nom }
      )
    )
  }
  return changements
}

/**
 * Les activités non archivées dont la personne ouvre « Tous les périmètres » sans y
 * avoir de périmètre : elle y est rattachée ou y a un souhait (ADR 0012, 0045). Le
 * réglage « ouverte aux souhaits » dit si elle y formule elle-même ses souhaits.
 */
export async function activitesADecouvrir(
  prisma: PrismaClient,
  userId: string,
  organisationId: string
): Promise<{ nom: string; souhaitsOuverts: boolean }[]> {
  return prisma.activite.findMany({
    where: {
      organisationId,
      archivedAt: null,
      OR: [
        { rattachements: { some: { userId } } },
        { perimetres: { some: { souhaits: { some: { userId } } } } },
      ],
    },
    orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { nom: true, souhaitsOuverts: true },
  })
}
