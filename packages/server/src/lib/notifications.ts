import type {
  PrismaClient,
  StatutTache,
  TypeNotification,
} from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { publierNotification } from './flux.ts'
import { pousser } from './push-file.ts'

import { journal } from './journal.ts'

export const PREFERENCES_PAR_DEFAUT = {
  frequenceResume: 'HEBDOMADAIRE',
  mailModification: true,
  mailEcheance: true,
  mailDemandes: true,
  applicationPerimetre: true,
  pushTaches: true,
  pushEcheances: true,
  pushDemandes: true,
  dernierResumeLe: null,
} as const

export async function preferencesDe(prisma: PrismaClient, userId: string) {
  return (
    (await prisma.preferenceNotification.findUnique({ where: { userId } })) ?? {
      userId,
      ...PREFERENCES_PAR_DEFAUT,
    }
  )
}

/**
 * Les référentes et référents à prévenir de l'activité d'un périmètre : les personnes
 * affectées, sauf l'acteur et celles qui ont coupé ces notifications dans leurs
 * préférences. Avec une édition, ses personnes affectées ; sans édition (une fiche
 * vaut pour toutes les périodes), celles des éditions non archivées.
 */
export async function referentsAPrevenir(
  prisma: PrismaClient,
  perimetreId: string,
  editionId: string | null,
  acteurId: string
): Promise<string[]> {
  const affectations = await prisma.affectation.findMany({
    where: {
      perimetreId,
      ...(editionId === null
        ? { edition: { statut: { not: 'ARCHIVEE' } } }
        : { editionId }),
      userId: { not: acteurId },
      user: { archivedAt: null },
    },
    select: { userId: true },
    distinct: ['userId'],
  })
  const ids = affectations.map(a => a.userId)
  if (ids.length === 0) return []
  const coupees = await prisma.preferenceNotification.findMany({
    where: { userId: { in: ids }, applicationPerimetre: false },
    select: { userId: true },
  })
  const sans = new Set(coupees.map(c => c.userId))
  return ids.filter(id => !sans.has(id))
}

/** Une même action répétée dans cette durée ne prévient qu'une fois. */
export const TRANCHE_PERIMETRE_MS = 10 * 60 * 1000

/**
 * Prévient les autres référentes et référents d'un périmètre qu'une personne a agi
 * sur une de ses tâches ou de ses fiches. La notification reste dans l'application :
 * aucun mail immédiat ne part, le résumé la reprend. Une clé par action, auteur,
 * destinataire et tranche de dix minutes évite le bruit d'une série de corrections.
 * Ne lève jamais.
 *
 * Un passage à « faite » ne garde pas son auteur : qui a coché une tâche reste
 * réservé à la personne qui a coché et aux admins.
 */
export async function notifierLePerimetre(
  prisma: PrismaClient,
  notification: {
    type:
      | 'TACHE_MODIFIEE'
      | 'TACHE_STATUT'
      | 'TACHE_COMMENTEE'
      | 'FICHE_CREEE'
      | 'FICHE_MODIFIEE'
    perimetreId: string
    /** L'édition de la tâche, ou null pour une fiche. */
    editionId: string | null
    acteurId: string
    tacheId?: string
    ficheId?: string
    statut?: StatutTache
    /** Les personnes déjà prévenues par une autre voie. */
    sauf?: string[]
  },
  maintenant = Date.now()
): Promise<void> {
  const { type, perimetreId, acteurId, statut } = notification
  try {
    const sauf = new Set(notification.sauf ?? [])
    const destinataires = (
      await referentsAPrevenir(
        prisma,
        perimetreId,
        notification.editionId,
        acteurId
      )
    ).filter(id => !sauf.has(id))
    if (destinataires.length === 0) return
    const { organisationId } = await prisma.perimetre.findUniqueOrThrow({
      where: { id: perimetreId },
      select: { organisationId: true },
    })
    const cible = notification.tacheId ?? notification.ficheId ?? perimetreId
    const tranche = Math.floor(maintenant / TRANCHE_PERIMETRE_MS)
    for (const userId of destinataires) {
      try {
        await prisma.notification.create({
          data: {
            organisationId,
            userId,
            type,
            acteurId: statut === 'FAITE' ? null : acteurId,
            tacheId: notification.tacheId ?? null,
            ficheId: notification.ficheId ?? null,
            perimetreId,
            statut: statut ?? null,
            // La clé d'un passage à « faite » ne porte pas son auteur non plus.
            cle: `${type}-${cible}-${statut ?? ''}-${statut === 'FAITE' ? '' : acteurId}-${userId}-${tranche}`,
          },
        })
        publierNotification(organisationId, userId)
      } catch (erreur) {
        // P2002 : cette personne est déjà prévenue de cette action dans la tranche.
        if ((erreur as { code?: string }).code !== 'P2002') throw erreur
      }
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type,
        message: (erreur as Error).message,
      },
      'Une notification n’a pas pu être créée.'
    )
  }
}

/**
 * Crée une notification par destinataire. Ne lève jamais : une notification manquée
 * ne doit pas faire échouer l'action qui l'a produite.
 *
 * Avec `mailImmediat`, la notification part aussi par mail (règle de collaboration
 * n° 2). Le worker vérifie la préférence du destinataire au moment de l'envoi.
 *
 * Un passage à « faite » (`statut: 'FAITE'`) ne garde son auteur ni dans la
 * notification ni dans le mail : qui a coché une tâche reste réservé à la personne
 * qui a coché et aux admins.
 */
export async function notifier(
  prisma: PrismaClient,
  notification: {
    type: TypeNotification
    destinataires: string[]
    acteurId: string
    tacheId: string
    perimetreId: string
    personneId?: string
    changement?: 'contenu' | 'statut'
    /** Pour TACHE_STATUT : le nouveau statut. */
    statut?: StatutTache
  },
  options: { mailImmediat?: boolean } = {}
): Promise<void> {
  const anonyme = notification.statut === 'FAITE'
  const destinataires = [...new Set(notification.destinataires)].filter(
    id => id !== notification.acteurId
  )
  if (destinataires.length === 0) return
  try {
    // La notification appartient à l'organisation du périmètre (ADR 0008).
    const { organisationId } = await prisma.perimetre.findUniqueOrThrow({
      where: { id: notification.perimetreId },
      select: { organisationId: true },
    })
    for (const userId of destinataires) {
      const creee = await prisma.notification.create({
        data: {
          organisationId,
          userId,
          type: notification.type,
          acteurId: anonyme ? null : notification.acteurId,
          tacheId: notification.tacheId,
          perimetreId: notification.perimetreId,
          personneId: notification.personneId ?? null,
          statut: notification.statut ?? null,
        },
        select: { id: true },
      })
      publierNotification(organisationId, userId)
      // Push (ADR 0024) : la modification d'une tâche assignée, et l'assignation
      // ou le retrait qui concerne le destinataire lui-même. Ce que la personne
      // apprend comme simple référente du périmètre reste dans la cloche.
      if (
        options.mailImmediat ||
        // Un commentaire prévient en push les personnes assignées (ADR 0029).
        notification.type === 'TACHE_COMMENTEE' ||
        ((notification.type === 'TACHE_ASSIGNEE' ||
          notification.type === 'TACHE_DESASSIGNEE') &&
          notification.personneId === userId)
      )
        await pousser(creee.id)
      if (options.mailImmediat) {
        await mettreEnFile(
          'tache-modifiee',
          { userId },
          {
            tache: {
              tacheId: notification.tacheId,
              ...(anonyme ? {} : { acteurId: notification.acteurId }),
              changement: notification.changement ?? 'contenu',
            },
            notificationId: creee.id,
            organisationId,
          }
        )
      }
    }
  } catch (erreur) {
    journal.error(
      {
        evenement: 'notification-echouee',
        type: notification.type,
        message: (erreur as Error).message,
      },
      'Une notification n’a pas pu être créée.'
    )
  }
}

// ── Texte ────────────────────────────────────────────────────────────────────

/** Ce qu'une notification lit de sa tâche, de sa fiche et de son activité. */
export const SELECTION_TACHE_NOTIFIEE = {
  select: {
    id: true,
    editionId: true,
    titre: true,
    echeance: true,
    perimetre: {
      select: { nom: true, slug: true, activite: { select: { slug: true } } },
    },
    // Pour une déclinaison : sa tâche partagée et son périmètre (ADR 0026).
    origine: {
      select: { id: true, perimetre: { select: { nom: true, slug: true } } },
    },
  },
} as const
export const SELECTION_FICHE_NOTIFIEE = {
  select: {
    slug: true,
    activite: { select: { slug: true } },
    perimetre: { select: { nom: true } },
    versionCourante: { select: { titre: true } },
  },
} as const
export const SELECTION_ACTIVITE_NOTIFIEE = {
  select: { slug: true, nom: true },
} as const

export interface NotificationAComposer {
  type: TypeNotification
  jours: number | null
  acteurId: string | null
  personneId: string | null
  /** Pour TACHE_STATUT : le nouveau statut. */
  statut: StatutTache | null
  tache: {
    id: string
    editionId: string
    titre: string
    echeance: Date | null
    perimetre: { nom: string; slug: string; activite: { slug: string } }
    /** Pour une déclinaison : sa tâche partagée et son périmètre. */
    origine?: { id: string; perimetre: { nom: string; slug: string } } | null
  } | null
  /** Pour FICHE_CREEE et FICHE_MODIFIEE. */
  fiche: {
    slug: string
    activite: { slug: string }
    perimetre: { nom: string } | null
    versionCourante: { titre: string } | null
  } | null
  /** Pour DEMANDE_RECUE : l'activité dont la file de demandes attend une revue. */
  activite: { slug: string; nom: string } | null
}

function dateLongue(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/**
 * Phrase affichée pour une notification. `noms` associe un identifiant de personne à
 * son nom ; `moiId` est la personne qui lit.
 */
export function messageNotification(
  n: NotificationAComposer,
  noms: Map<string, string>,
  moiId: string
): string {
  // Une demande porte le nom d'une personne qui n'est pas membre : la notification
  // ne le cite pas, et renvoie vers la file de revue.
  if (n.type === 'DEMANDE_RECUE') {
    const phrase = 'une demande pour rejoindre l’équipe attend votre revue.'
    return n.activite === null
      ? `U${phrase.slice(1)}`
      : `${n.activite.nom} : ${phrase}`
  }
  const acteur = (n.acteurId && noms.get(n.acteurId)) ?? 'Une personne'
  if (n.type === 'FICHE_CREEE' || n.type === 'FICHE_MODIFIEE') {
    if (n.fiche === null) return 'Cette fiche n’existe plus.'
    const perimetre =
      n.fiche.perimetre === null ? '' : ` (${n.fiche.perimetre.nom})`
    const fiche = `« ${n.fiche.versionCourante?.titre ?? n.fiche.slug} »${perimetre}`
    return n.type === 'FICHE_CREEE'
      ? `${acteur} a créé la fiche ${fiche}.`
      : `${acteur} a modifié la fiche ${fiche}.`
  }
  const tache = n.tache
  if (tache === null) return 'Cette tâche n’existe plus.'
  const titre = `« ${tache.titre} » (${tache.perimetre.nom})`
  const personne =
    n.personneId === moiId
      ? 'vous'
      : ((n.personneId && noms.get(n.personneId)) ?? 'une personne')

  // Une déclinaison nomme le périmètre qui la demande (ADR 0026).
  const demandeur = tache.origine?.perimetre.nom
  switch (n.type) {
    case 'TACHE_CREEE':
      return demandeur === undefined
        ? `${acteur} a créé la tâche ${titre}.`
        : `${acteur} a ajouté la tâche ${titre}, demandée par ${demandeur}.`
    case 'DECLINAISON_PROPOSEE':
      return `${acteur} propose la tâche ${titre}${demandeur === undefined ? '' : `, demandée par ${demandeur}`}. Elle attend l’accord du périmètre.`
    case 'DECLINAISON_ACCEPTEE':
      return `${acteur} a accepté la tâche ${titre}.`
    case 'DECLINAISON_REFUSEE':
      return `${acteur} a refusé la tâche ${titre}.`
    case 'TACHE_MODIFIEE':
      return `${acteur} a modifié la tâche ${titre}.`
    // Le texte du commentaire ne figure jamais dans une notification (ADR 0029).
    case 'TACHE_COMMENTEE':
      return `${acteur} a commenté la tâche ${titre}.`
    case 'TACHE_ASSIGNEE':
      return n.personneId === n.acteurId
        ? `${acteur} s’occupe de la tâche ${titre}.`
        : n.personneId === moiId
          ? `${acteur} vous a assigné la tâche ${titre}.`
          : `${acteur} a assigné la tâche ${titre} à ${personne}.`
    case 'TACHE_DESASSIGNEE':
      return n.personneId === n.acteurId
        ? `${acteur} ne s’occupe plus de la tâche ${titre}.`
        : n.personneId === moiId
          ? `${acteur} vous a retiré·e de la tâche ${titre}.`
          : `${acteur} a retiré ${personne} de la tâche ${titre}.`
    case 'ECHEANCE_PROCHE':
      return n.jours === 0
        ? `La tâche ${titre} arrive à échéance aujourd’hui.`
        : n.jours === 1
          ? `La tâche ${titre} arrive à échéance demain.`
          : `La tâche ${titre} arrive à échéance dans ${n.jours ?? 7} jours.`
    case 'TACHE_EN_RETARD':
      return tache.echeance
        ? `La tâche ${titre} est en retard depuis le ${dateLongue(tache.echeance)}.`
        : `La tâche ${titre} est en retard.`
    case 'TACHE_STATUT':
      switch (n.statut) {
        // Qui a coché reste réservé : la phrase ne nomme personne.
        case 'FAITE':
          return `La tâche ${titre} est faite.`
        case 'EN_COURS':
          return `${acteur} a commencé la tâche ${titre}.`
        case 'ABANDONNEE':
          return `${acteur} a abandonné la tâche ${titre}.`
        default:
          return `${acteur} a remis la tâche ${titre} à faire.`
      }
  }
}

/**
 * Chemin de l'espace organisateur vers lequel renvoie une notification, sous le slug
 * de son activité (ADR 0008) : la tâche dans la page de son périmètre et de son
 * édition, la fiche, ou la file des demandes.
 */
export function lienNotification(n: NotificationAComposer): string {
  if (n.type === 'DEMANDE_RECUE') {
    return n.activite
      ? `/${n.activite.slug}/admin/personnes?onglet=demandes`
      : '/'
  }
  if (n.type === 'FICHE_CREEE' || n.type === 'FICHE_MODIFIEE') {
    return n.fiche ? `/${n.fiche.activite.slug}/fiches/${n.fiche.slug}` : '/'
  }
  if (n.tache === null) return '/'
  const { perimetre, editionId, id, origine } = n.tache
  // La réponse à une déclinaison se lit sur sa tâche partagée, dans le périmètre qui
  // l'a proposée (ADR 0026).
  if (
    origine &&
    (n.type === 'DECLINAISON_ACCEPTEE' || n.type === 'DECLINAISON_REFUSEE')
  ) {
    return `/${perimetre.activite.slug}/perimetres/${origine.perimetre.slug}?edition=${editionId}&tache=${origine.id}`
  }
  // Un commentaire ouvre le fil de sa tâche (ADR 0029).
  const fil = n.type === 'TACHE_COMMENTEE' ? '&fil=1' : ''
  return `/${perimetre.activite.slug}/perimetres/${perimetre.slug}?edition=${editionId}&tache=${id}${fil}`
}
