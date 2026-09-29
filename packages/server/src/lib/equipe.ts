import type { PrismaClient } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

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
 */
export async function annoncerChangementEquipe(
  userId: string,
  options: { organisationId: string; activiteId?: string },
  maintenant = Date.now()
): Promise<void> {
  const fenetre = fenetreEquipe(maintenant)
  await mettreEnFile(
    'equipe',
    { userId },
    {
      organisationId: options.organisationId,
      ...(options.activiteId === undefined
        ? {}
        : { activiteId: options.activiteId }),
      // BullMQ refuse « : » dans un identifiant de job.
      jobId: `equipe-${userId}-${Date.parse(fenetre.debut)}`,
      delai: Date.parse(fenetre.fin) - maintenant + MARGE_MS,
      fenetre,
    }
  )
}

/** « Football (Rencontres 2027) : le tournoi à 7 contre 7… », ou le nom seul. */
function lignePerimetre(p: {
  perimetre: { nom: string; description: string | null }
  edition: { nom: string }
}): string {
  const titre = `${p.perimetre.nom} (${p.edition.nom})`
  return p.perimetre.description === null
    ? titre
    : `${titre} : ${p.perimetre.description}`
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
 * Les changements de la place d'une personne pendant une fenêtre : ses nouvelles
 * affectations, ses nominations comme admin d'une activité ou de l'organisation.
 * Une liste vide veut dire que rien n'est à annoncer.
 */
export async function changementsEquipe(
  prisma: PrismaClient,
  userId: string,
  organisationId: string,
  fenetre: FenetreEquipe
): Promise<string[]> {
  const pendant = { gte: new Date(fenetre.debut), lt: new Date(fenetre.fin) }
  const [affectations, admins, appartenance] = await Promise.all([
    prisma.affectation.findMany({
      where: {
        userId,
        createdAt: pendant,
        perimetre: { organisationId, archivedAt: null },
        edition: { statut: { not: 'ARCHIVEE' } },
      },
      select: {
        perimetre: { select: { nom: true, description: true } },
        edition: { select: { nom: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.adminActivite.findMany({
      where: { userId, organisationId, createdAt: pendant },
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
  const changements = affectations.map(
    a => `Vous rejoignez le périmètre ${lignePerimetre(a)}`
  )
  for (const admin of admins) {
    changements.push(
      `Vous devenez admin de l’activité ${admin.activite.nom} : vous gérez ses périodes, ses périmètres et son équipe.`
    )
  }
  // Une appartenance créée pendant la fenêtre est une invitation, déjà annoncée par
  // son propre mail. Une appartenance plus ancienne passée admin est une nomination.
  if (
    appartenance !== null &&
    appartenance.role === 'ADMIN' &&
    appartenance.createdAt < new Date(fenetre.debut) &&
    appartenance.updatedAt >= new Date(fenetre.debut) &&
    appartenance.updatedAt < new Date(fenetre.fin)
  ) {
    changements.push(
      `Vous devenez admin de l’organisation ${appartenance.organisation.nom} : vous gérez toutes ses activités et ses comptes.`
    )
  }
  return changements
}

/**
 * Vrai quand la personne peut ouvrir « Tous les périmètres » : une activité ouverte
 * aux souhaits dans l'organisation, ou une activité où elle a un souhait (ADR 0012).
 */
export async function decouvreDesPerimetres(
  prisma: PrismaClient,
  userId: string,
  organisationId: string
): Promise<boolean> {
  const activites = await prisma.activite.count({
    where: {
      organisationId,
      archivedAt: null,
      OR: [
        { souhaitsOuverts: true },
        { perimetres: { some: { souhaits: { some: { userId } } } } },
      ],
    },
  })
  return activites > 0
}
