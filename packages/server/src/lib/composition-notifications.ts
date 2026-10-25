import type {
  NiveauNotification,
  PrismaClient,
  StatutTache,
  TypeNotification,
} from '@relaytour/database'

import { lecteurDeLaFiche } from './fiches-connexes.ts'
import { i18n, langueCourante } from './langue.ts'

// Texte, lien et contexte des notifications (ADR 0032 et 0033). Une notification ne
// stocke que des identifiants : ce module relit les noms à jour et compose, pour un
// lot de notifications, ce que la cloche, l'écran des admins, le push et les mails
// affichent. Les noms des personnes, des activités et des périmètres se lisent en
// une requête par sorte, quel que soit le nombre de notifications.

/** Ce que la composition lit d'une notification. */
export const SELECTION_NOTIFICATION = {
  id: true,
  organisationId: true,
  type: true,
  niveau: true,
  jours: true,
  acteurId: true,
  personneId: true,
  statut: true,
  activiteId: true,
  perimetreId: true,
  editionId: true,
  tache: {
    select: {
      id: true,
      editionId: true,
      titre: true,
      echeance: true,
      perimetreId: true,
      edition: { select: { nom: true } },
      perimetre: { select: { activiteId: true } },
      // Pour une déclinaison : sa tâche partagée et son périmètre (ADR 0026).
      origine: {
        select: { id: true, perimetre: { select: { nom: true, slug: true } } },
      },
    },
  },
  fiche: {
    select: {
      id: true,
      slug: true,
      activiteId: true,
      perimetreId: true,
      versionCourante: { select: { titre: true } },
    },
  },
  // Une réunion de l'agenda (ADR 0037).
  reunion: { select: { id: true, titre: true, editionId: true } },
  sondage: { select: { id: true, titre: true, editionId: true } },
  // Une séquence du programme et une fiche bénévole (ADR 0041).
  sequence: { select: { id: true, titre: true, editionId: true } },
  benevole: { select: { nom: true } },
} as const

export interface NotificationLue {
  id: string
  organisationId: string
  type: TypeNotification
  niveau: NiveauNotification
  jours: number | null
  acteurId: string | null
  personneId: string | null
  /** Pour TACHE_STATUT : le nouveau statut. */
  statut: StatutTache | null
  activiteId: string | null
  perimetreId: string | null
  /** La période d'une notification d'admin liée à une période (ADR 0033). */
  editionId: string | null
  tache: {
    id: string
    editionId: string
    titre: string
    echeance: Date | null
    perimetreId: string
    edition: { nom: string }
    perimetre: { activiteId: string }
    origine?: { id: string; perimetre: { nom: string; slug: string } } | null
  } | null
  fiche: {
    id: string
    slug: string
    activiteId: string
    perimetreId: string | null
    versionCourante: { titre: string } | null
  } | null
  reunion?: { id: string; titre: string; editionId: string } | null
  sondage?: { id: string; titre: string; editionId: string } | null
  sequence?: { id: string; titre: string; editionId: string } | null
  benevole?: { nom: string } | null
}

export interface ActiviteDeNotification {
  id: string
  slug: string
  nom: string
}

export interface PerimetreDeNotification {
  id: string
  slug: string
  nom: string
  couleur: string | null
}

export interface NotificationComposee {
  id: string
  /** Le texte affiché dans l'espace organisateur, qui montre l'activité à part. */
  message: string
  /** Le texte du push : il nomme l'activité et le périmètre. */
  messageAvecContexte: string
  /**
   * Le texte d'une ligne de mail rangée sous l'intertitre de son activité : il
   * nomme le périmètre, et la période quand l'activité en a plusieurs d'ouvertes.
   */
  messageAvecPerimetre: string
  /** Chemin dans l'espace organisateur, sous le slug d'une activité. */
  lien: string
  activite: ActiviteDeNotification | null
  perimetre: PerimetreDeNotification | null
  /** Le nom de la période, quand l'activité en a plusieurs d'ouvertes. */
  periode: string | null
}

function dateLongue(date: Date): string {
  return date.toLocaleDateString(langueCourante(), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/** L'activité d'une notification : la sienne, sinon celle de sa tâche ou de sa fiche. */
export function activiteIdDe(n: NotificationLue): string | null {
  return (
    n.activiteId ?? n.tache?.perimetre.activiteId ?? n.fiche?.activiteId ?? null
  )
}

/** Le périmètre d'une notification : le sien, sinon celui de sa tâche ou de sa fiche. */
export function perimetreIdDe(n: NotificationLue): string | null {
  return n.perimetreId ?? n.tache?.perimetreId ?? n.fiche?.perimetreId ?? null
}

/** Ajoute l'organisation à un chemin, pour qu'un lien hors de l'application la choisisse. */
export function avecOrganisation(chemin: string, slug: string): string {
  const separateur = chemin.includes('?') ? '&' : '?'
  return `${chemin}${separateur}organisation=${encodeURIComponent(slug)}`
}

interface Contexte {
  noms: Map<string, string>
  activites: Map<string, ActiviteDeNotification>
  perimetres: Map<string, PerimetreDeNotification>
  /** Les activités qui ont plus d'une période non archivée. */
  plusieursPeriodes: Set<string>
  /** Pour chaque organisation, le slug de sa première activité ouverte. */
  premiereActivite: Map<string, string>
  /** Le nom des périodes que portent les notifications d'admin. */
  periodes: Map<string, string>
  /**
   * Les notifications de fiche connexe dont la personne ne lit plus la fiche
   * (ADR 0039) : elles ne nomment pas la fiche et ne mènent pas à elle.
   */
  illisibles: Set<string>
}

async function lireContexte(
  prisma: PrismaClient,
  notifications: NotificationLue[]
): Promise<Omit<Contexte, 'illisibles'>> {
  const uniques = (valeurs: (string | null)[]) => [
    ...new Set(valeurs.filter((v): v is string => v !== null)),
  ]
  const personnes = uniques(
    notifications.flatMap(n => [n.acteurId, n.personneId])
  )
  const activites = uniques(notifications.map(activiteIdDe))
  // Le périmètre de la notification, et celui de sa tâche pour le lien : une
  // déclinaison prévient le périmètre d'origine d'une tâche d'un autre périmètre.
  const perimetres = uniques(
    notifications.flatMap(n => [
      perimetreIdDe(n),
      n.tache?.perimetreId ?? null,
      // Une fiche connexe nomme le périmètre de la fiche (ADR 0039).
      n.fiche?.perimetreId ?? null,
    ])
  )
  const organisations = uniques(notifications.map(n => n.organisationId))
  const editions = uniques(notifications.map(n => n.editionId))
  const [
    lignesPersonnes,
    lignesActivites,
    lignesPerimetres,
    periodes,
    premieres,
    lignesEditions,
  ] = await Promise.all([
    personnes.length === 0
      ? []
      : prisma.user.findMany({
          where: { id: { in: personnes } },
          select: { id: true, name: true },
        }),
    activites.length === 0
      ? []
      : prisma.activite.findMany({
          where: { id: { in: activites } },
          select: { id: true, slug: true, nom: true },
        }),
    perimetres.length === 0
      ? []
      : prisma.perimetre.findMany({
          where: { id: { in: perimetres } },
          select: { id: true, slug: true, nom: true, couleur: true },
        }),
    activites.length === 0
      ? []
      : prisma.edition.groupBy({
          by: ['activiteId'],
          where: { activiteId: { in: activites }, statut: { not: 'ARCHIVEE' } },
          _count: { _all: true },
        }),
    organisations.length === 0
      ? []
      : prisma.activite.findMany({
          where: { organisationId: { in: organisations }, archivedAt: null },
          select: { organisationId: true, slug: true },
          orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
        }),
    editions.length === 0
      ? []
      : prisma.edition.findMany({
          where: { id: { in: editions } },
          select: { id: true, nom: true },
        }),
  ])
  const premiereActivite = new Map<string, string>()
  for (const a of premieres) {
    if (!premiereActivite.has(a.organisationId)) {
      premiereActivite.set(a.organisationId, a.slug)
    }
  }
  return {
    noms: new Map(lignesPersonnes.map(p => [p.id, p.name])),
    activites: new Map(lignesActivites.map(a => [a.id, a])),
    perimetres: new Map(lignesPerimetres.map(p => [p.id, p])),
    plusieursPeriodes: new Set(
      periodes.filter(p => p._count._all > 1).map(p => p.activiteId)
    ),
    premiereActivite,
    periodes: new Map(lignesEditions.map(e => [e.id, e.nom])),
  }
}

/**
 * La phrase d'une notification, sans point final. `lieu` nomme l'activité et le
 * périmètre d'une tâche ou d'une fiche ; `activite` nomme l'activité seule. Les deux
 * sont vides dans l'espace organisateur, qui affiche le contexte à part.
 */
function phrase(
  n: NotificationLue,
  c: Contexte,
  moiId: string,
  lieu: string,
  activite: string
): string {
  const acteur =
    (n.acteurId && c.noms.get(n.acteurId)) ?? i18n._('Une personne')
  const personne =
    n.personneId === moiId
      ? i18n._(
          'vous',
          {},
          {
            comment:
              'Complément d’une phrase de notification, à la place du nom de la personne qui lit',
          }
        )
      : ((n.personneId && c.noms.get(n.personneId)) ?? i18n._('une personne'))
  const perimetre =
    (perimetreIdDe(n) && c.perimetres.get(perimetreIdDe(n)!)?.nom) ??
    i18n._('un périmètre')

  switch (n.type) {
    // Une demande porte le nom d'une personne qui n'est pas membre : la notification
    // ne le cite pas (ADR 0015).
    case 'DEMANDE_RECUE':
      return i18n._(
        'Une demande pour rejoindre l’équipe attend votre revue{activite}',
        { activite }
      )
    // Une candidature porte le nom d'une personne sans compte : la notification ne
    // le cite pas (ADR 0041).
    case 'CANDIDATURE_RECUE':
      return i18n._(
        'Une candidature de bénévole attend votre revue{activite}',
        { activite }
      )
    // Les propositions ne nomment personne ici : l'écran les détaille (ADR 0044).
    case 'ACCES_FOURNISSEUR_A_VALIDER':
      return i18n._(
        'Des accès chez le fournisseur cloud attendent votre validation'
      )
    case 'DEMANDE_ACCEPTEE':
      return i18n._(
        '{acteur} a accepté une demande pour rejoindre l’équipe{activite}',
        { acteur, activite }
      )
    case 'DEMANDE_REFUSEE':
      return i18n._(
        '{acteur} a refusé une demande pour rejoindre l’équipe{activite}',
        { acteur, activite }
      )
    // La personne a accepté : elle est membre, et son nom se lit désormais (ADR 0030).
    case 'INVITATION_ACCEPTEE':
      return i18n._(
        '{acteur} a accepté l’invitation et rejoint l’organisation{activite}',
        { acteur, activite }
      )
    case 'AFFECTATION_AJOUTEE':
      return i18n._(
        '{acteur} a affecté {personne} au périmètre {perimetre}{activite}',
        { acteur, personne, perimetre, activite }
      )
    case 'AFFECTATION_RETIREE':
      return i18n._(
        '{acteur} a retiré {personne} du périmètre {perimetre}{activite}',
        { acteur, personne, perimetre, activite }
      )
    case 'SOUHAIT_FORMULE':
      return i18n._(
        '{acteur} souhaite rejoindre le périmètre {perimetre}{activite}',
        { acteur, perimetre, activite }
      )
    case 'ADMIN_ACTIVITE_NOMME':
      return i18n._(
        '{acteur} a nommé {personne} admin de l’activité{activite}',
        { acteur, personne, activite }
      )
    case 'ADMIN_ACTIVITE_RETIRE':
      return i18n._(
        '{acteur} a retiré à {personne} le rôle d’admin de l’activité{activite}',
        { acteur, personne, activite }
      )
    case 'ADMIN_ORGANISATION_NOMME':
      return i18n._('{acteur} a nommé {personne} admin de l’organisation', {
        acteur,
        personne,
      })
    case 'ADMIN_ORGANISATION_RETIRE':
      return i18n._(
        '{acteur} a retiré à {personne} le rôle d’admin de l’organisation',
        { acteur, personne }
      )
    case 'PERSONNE_ARCHIVEE':
      return i18n._('{acteur} a archivé {personne} dans l’organisation', {
        acteur,
        personne,
      })
    case 'PERSONNE_RETABLIE':
      return i18n._('{acteur} a rétabli {personne} dans l’organisation', {
        acteur,
        personne,
      })
    case 'PLACE_MODIFIEE':
      return i18n._('Votre place dans l’équipe a changé{activite}', {
        activite,
      })
    case 'REUNION_CONVOQUEE':
    case 'REUNION_MODIFIEE':
    case 'REUNION_ANNULEE': {
      if (!n.reunion) return i18n._('Cette réunion n’existe plus')
      const titre = n.reunion.titre
      if (n.type === 'REUNION_CONVOQUEE') {
        return i18n._('{acteur} vous convoque à la réunion « {titre} »{lieu}', {
          acteur,
          titre,
          lieu,
        })
      }
      return n.type === 'REUNION_MODIFIEE'
        ? i18n._('{acteur} a modifié la réunion « {titre} »{lieu}', {
            acteur,
            titre,
            lieu,
          })
        : i18n._('{acteur} a annulé la réunion « {titre} »{lieu}', {
            acteur,
            titre,
            lieu,
          })
    }
    case 'SONDAGE_OUVERT':
      return n.sondage
        ? i18n._(
            '{acteur} vous demande vos disponibilités : « {titre} »{lieu}',
            { acteur, titre: n.sondage.titre, lieu }
          )
        : i18n._('Ce sondage n’existe plus')
    // Les personnes qui écrivent dans le périmètre lisent déjà son nom dans le
    // programme (ADR 0040).
    case 'BENEVOLE_RETIRE': {
      const qui = n.benevole?.nom ?? i18n._('Une personne bénévole')
      return n.sequence
        ? i18n._('{qui} a quitté la séquence « {titre} »{lieu}', {
            qui,
            titre: n.sequence.titre,
            lieu,
          })
        : i18n._('{qui} a quitté une séquence du programme{lieu}', {
            qui,
            lieu,
          })
    }
    case 'FICHE_CONNEXE': {
      if (n.fiche === null) return i18n._('Cette fiche n’existe plus')
      if (c.illisibles.has(n.id))
        return i18n._(
          'Une fiche d’un autre périmètre ne concerne plus votre périmètre{lieu}',
          { lieu }
        )
      const origine =
        (n.fiche.perimetreId && c.perimetres.get(n.fiche.perimetreId)?.nom) ??
        i18n._('un autre périmètre')
      return i18n._(
        'La fiche « {titre} » de {origine} concerne aussi votre périmètre{lieu}',
        {
          titre: n.fiche.versionCourante?.titre ?? n.fiche.slug,
          origine,
          lieu,
        }
      )
    }
    case 'FICHE_CREEE':
    case 'FICHE_MODIFIEE': {
      if (n.fiche === null) return i18n._('Cette fiche n’existe plus')
      const titre = n.fiche.versionCourante?.titre ?? n.fiche.slug
      return n.type === 'FICHE_CREEE'
        ? i18n._('{acteur} a créé la fiche « {titre} »{lieu}', {
            acteur,
            titre,
            lieu,
          })
        : i18n._('{acteur} a modifié la fiche « {titre} »{lieu}', {
            acteur,
            titre,
            lieu,
          })
    }
    default:
      break
  }

  const tache = n.tache
  if (tache === null) return i18n._('Cette tâche n’existe plus')
  const titre = tache.titre
  // Une déclinaison nomme le périmètre qui la demande (ADR 0026).
  const demandeur = tache.origine?.perimetre.nom
  switch (n.type) {
    case 'TACHE_CREEE':
      return demandeur === undefined
        ? i18n._('{acteur} a créé la tâche « {titre} »{lieu}', {
            acteur,
            titre,
            lieu,
          })
        : i18n._(
            '{acteur} a ajouté la tâche « {titre} »{lieu}, demandée par {demandeur}',
            { acteur, titre, lieu, demandeur }
          )
    case 'DECLINAISON_PROPOSEE':
      return demandeur === undefined
        ? i18n._(
            '{acteur} propose la tâche « {titre} »{lieu}. Elle attend l’accord du périmètre',
            { acteur, titre, lieu }
          )
        : i18n._(
            '{acteur} propose la tâche « {titre} »{lieu}, demandée par {demandeur}. Elle attend l’accord du périmètre',
            { acteur, titre, lieu, demandeur }
          )
    case 'DECLINAISON_ACCEPTEE':
      return i18n._('{acteur} a accepté la tâche « {titre} »{lieu}', {
        acteur,
        titre,
        lieu,
      })
    case 'DECLINAISON_REFUSEE':
      return i18n._('{acteur} a refusé la tâche « {titre} »{lieu}', {
        acteur,
        titre,
        lieu,
      })
    case 'TACHE_MODIFIEE':
      return i18n._('{acteur} a modifié la tâche « {titre} »{lieu}', {
        acteur,
        titre,
        lieu,
      })
    // Le texte du commentaire ne figure jamais dans une notification (ADR 0029).
    case 'TACHE_COMMENTEE':
      return i18n._('{acteur} a commenté la tâche « {titre} »{lieu}', {
        acteur,
        titre,
        lieu,
      })
    case 'TACHE_ASSIGNEE':
      return n.personneId === n.acteurId
        ? i18n._('{acteur} s’occupe de la tâche « {titre} »{lieu}', {
            acteur,
            titre,
            lieu,
          })
        : n.personneId === moiId
          ? i18n._('{acteur} vous a assigné la tâche « {titre} »{lieu}', {
              acteur,
              titre,
              lieu,
            })
          : i18n._(
              '{acteur} a assigné la tâche « {titre} »{lieu} à {personne}',
              { acteur, titre, lieu, personne }
            )
    case 'TACHE_DESASSIGNEE':
      return n.personneId === n.acteurId
        ? i18n._('{acteur} ne s’occupe plus de la tâche « {titre} »{lieu}', {
            acteur,
            titre,
            lieu,
          })
        : n.personneId === moiId
          ? i18n._('{acteur} vous a retiré·e de la tâche « {titre} »{lieu}', {
              acteur,
              titre,
              lieu,
            })
          : i18n._(
              '{acteur} a retiré {personne} de la tâche « {titre} »{lieu}',
              { acteur, titre, lieu, personne }
            )
    case 'ECHEANCE_PROCHE':
      return i18n._(
        '{jours, plural, =0 {La tâche « {titre} »{lieu} arrive à échéance aujourd’hui} =1 {La tâche « {titre} »{lieu} arrive à échéance demain} other {La tâche « {titre} »{lieu} arrive à échéance dans # jours}}',
        { jours: n.jours ?? 7, titre, lieu }
      )
    case 'TACHE_EN_RETARD':
      return tache.echeance
        ? i18n._('La tâche « {titre} »{lieu} est en retard depuis le {date}', {
            titre,
            lieu,
            date: dateLongue(tache.echeance),
          })
        : i18n._('La tâche « {titre} »{lieu} est en retard', { titre, lieu })
    case 'TACHE_STATUT':
      switch (n.statut) {
        // Qui a coché reste réservé : la phrase ne nomme personne.
        case 'FAITE':
          return i18n._('La tâche « {titre} »{lieu} est faite', { titre, lieu })
        case 'EN_COURS':
          return i18n._('{acteur} a commencé la tâche « {titre} »{lieu}', {
            acteur,
            titre,
            lieu,
          })
        case 'ABANDONNEE':
          return i18n._('{acteur} a abandonné la tâche « {titre} »{lieu}', {
            acteur,
            titre,
            lieu,
          })
        default:
          return i18n._('{acteur} a remis la tâche « {titre} »{lieu} à faire', {
            acteur,
            titre,
            lieu,
          })
      }
    default:
      return i18n._('{acteur} a agi sur la tâche « {titre} »{lieu}', {
        acteur,
        titre,
        lieu,
      })
  }
}

/**
 * Chemin de l'espace organisateur vers lequel renvoie une notification, sous le slug
 * de son activité (ADR 0008). Une notification de l'organisation, sans activité,
 * s'ouvre sous la première activité de l'organisation.
 */
function lien(n: NotificationLue, c: Contexte): string {
  const activiteId = activiteIdDe(n)
  const slug =
    (activiteId && c.activites.get(activiteId)?.slug) ??
    c.premiereActivite.get(n.organisationId)
  if (slug === undefined) return '/'
  switch (n.type) {
    case 'DEMANDE_RECUE':
    case 'DEMANDE_ACCEPTEE':
    case 'DEMANDE_REFUSEE':
      return `/${slug}/admin/personnes?onglet=demandes`
    case 'CANDIDATURE_RECUE':
      return n.editionId
        ? `/${slug}/benevoles?onglet=candidatures&edition=${n.editionId}`
        : `/${slug}/benevoles?onglet=candidatures`
    case 'INVITATION_ACCEPTEE':
    case 'AFFECTATION_AJOUTEE':
    case 'AFFECTATION_RETIREE':
    case 'SOUHAIT_FORMULE':
      return activiteId === null
        ? `/${slug}/admin/annuaire`
        : `/${slug}/admin/personnes`
    case 'ADMIN_ACTIVITE_NOMME':
    case 'ADMIN_ACTIVITE_RETIRE':
    case 'ADMIN_ORGANISATION_NOMME':
    case 'ADMIN_ORGANISATION_RETIRE':
      return `/${slug}/admin/admins`
    case 'PERSONNE_ARCHIVEE':
    case 'PERSONNE_RETABLIE':
      return `/${slug}/admin/annuaire`
    case 'ACCES_FOURNISSEUR_A_VALIDER':
      return `/${slug}/admin/espace-fichiers?onglet=acces`
    case 'PLACE_MODIFIEE':
      return `/${slug}`
    case 'FICHE_CREEE':
    case 'FICHE_MODIFIEE':
      return n.fiche ? `/${slug}/fiches/${n.fiche.slug}` : `/${slug}`
    case 'REUNION_CONVOQUEE':
    case 'REUNION_MODIFIEE':
    case 'REUNION_ANNULEE':
      return n.reunion
        ? `/${slug}/agenda?edition=${n.reunion.editionId}&reunion=${n.reunion.id}`
        : `/${slug}/agenda`
    case 'SONDAGE_OUVERT':
      return n.sondage
        ? `/${slug}/agenda?edition=${n.sondage.editionId}&sondage=${n.sondage.id}`
        : `/${slug}/agenda`
    case 'BENEVOLE_RETIRE':
      return n.sequence
        ? `/${slug}/programme?edition=${n.sequence.editionId}&sequence=${n.sequence.id}`
        : `/${slug}/programme`
    case 'FICHE_CONNEXE': {
      if (n.fiche !== null && !c.illisibles.has(n.id))
        return `/${slug}/fiches/${n.fiche.slug}`
      const cible = n.perimetreId ? c.perimetres.get(n.perimetreId) : undefined
      return cible ? `/${slug}/perimetres/${cible.slug}` : `/${slug}`
    }
    default:
      break
  }
  if (n.tache === null) return `/${slug}`
  const { editionId, id, origine } = n.tache
  const perimetre = c.perimetres.get(n.tache.perimetreId)
  // La réponse à une déclinaison se lit sur sa tâche partagée, dans le périmètre qui
  // l'a proposée (ADR 0026).
  if (
    origine &&
    (n.type === 'DECLINAISON_ACCEPTEE' || n.type === 'DECLINAISON_REFUSEE')
  ) {
    return `/${slug}/perimetres/${origine.perimetre.slug}?edition=${editionId}&tache=${origine.id}`
  }
  if (perimetre === undefined) return `/${slug}`
  // Un commentaire ouvre le fil de sa tâche (ADR 0029).
  const fil = n.type === 'TACHE_COMMENTEE' ? '&fil=1' : ''
  return `/${slug}/perimetres/${perimetre.slug}?edition=${editionId}&tache=${id}${fil}`
}

/**
 * Compose un lot de notifications pour la personne `moiId`. Le texte avec contexte
 * nomme l'activité, ou la période quand l'activité en a plusieurs d'ouvertes, puis
 * le périmètre (ADR 0032).
 */
export async function composerNotifications(
  prisma: PrismaClient,
  notifications: NotificationLue[],
  moiId: string
): Promise<NotificationComposee[]> {
  if (notifications.length === 0) return []
  const c = {
    ...(await lireContexte(prisma, notifications)),
    illisibles: await fichesConnexesIllisibles(prisma, notifications, moiId),
  }
  return notifications.map(n => {
    const activiteId = activiteIdDe(n)
    const perimetreId = perimetreIdDe(n)
    const activite = (activiteId && c.activites.get(activiteId)) || null
    const perimetre = (perimetreId && c.perimetres.get(perimetreId)) || null
    // La période se nomme quand l'activité en a plusieurs d'ouvertes : celle de la
    // tâche, sinon celle de l'action d'admin (affectation, souhait).
    const nomPeriode =
      n.tache?.edition.nom ??
      (n.editionId === null ? null : (c.periodes.get(n.editionId) ?? null))
    const periode =
      activite !== null && c.plusieursPeriodes.has(activite.id)
        ? nomPeriode
        : null
    const nomActivite = periode ?? activite?.nom ?? null
    const objet =
      n.tache !== null ||
      n.fiche !== null ||
      Boolean(n.reunion) ||
      Boolean(n.sondage)
    const lieu = !objet
      ? ''
      : [nomActivite, perimetre?.nom].filter(Boolean).length > 0
        ? ` (${[nomActivite, perimetre?.nom].filter(Boolean).join(', ')})`
        : ''
    const sansActivite =
      !objet && nomActivite !== null ? ` (${nomActivite})` : ''
    // Une action d'admin liée à une période nomme celle-ci dans les mails rangés
    // par activité.
    const periodeSeule = !objet && periode !== null ? ` (${periode})` : ''
    const parties = [periode, perimetre?.nom].filter(Boolean)
    const lieuPerimetre =
      objet && parties.length > 0 ? ` (${parties.join(', ')})` : ''
    return {
      id: n.id,
      message: `${phrase(n, c, moiId, '', '')}.`,
      messageAvecContexte: `${phrase(n, c, moiId, lieu, sansActivite)}.`,
      messageAvecPerimetre: `${phrase(n, c, moiId, lieuPerimetre, periodeSeule)}.`,
      lien: lien(n, c),
      activite,
      perimetre,
      periode,
    }
  })
}

/**
 * Range des notifications composées par activité, dans l'ordre de leur première
 * apparition. Les notifications sans activité forment le groupe `sansActivite`,
 * placé en tête.
 */
export function grouperParActivite(
  composees: NotificationComposee[],
  sansActivite: string,
  prefixe = ''
): { titre: string; elements: string[] }[] {
  const groupes = new Map<string, { titre: string; elements: string[] }>()
  const tete = { titre: `${prefixe}${sansActivite}`, elements: [] as string[] }
  for (const n of composees) {
    if (n.activite === null) {
      tete.elements.push(n.messageAvecPerimetre)
      continue
    }
    const groupe = groupes.get(n.activite.id) ?? {
      titre: `${prefixe}${n.activite.nom}`,
      elements: [],
    }
    groupe.elements.push(n.messageAvecPerimetre)
    groupes.set(n.activite.id, groupe)
  }
  return [...(tete.elements.length > 0 ? [tete] : []), ...groupes.values()]
}

/** Compose une seule notification. */
export async function composerNotification(
  prisma: PrismaClient,
  notification: NotificationLue,
  moiId: string
): Promise<NotificationComposee> {
  const [composee] = await composerNotifications(prisma, [notification], moiId)
  return composee!
}

/**
 * Les notifications de fiche connexe dont la personne ne lit plus la fiche : un
 * partage retiré ne laisse pas paraître les titres suivants de la fiche, ni dans
 * la cloche ni dans le résumé (ADR 0039).
 */
async function fichesConnexesIllisibles(
  prisma: PrismaClient,
  notifications: NotificationLue[],
  moiId: string
): Promise<Set<string>> {
  const illisibles = new Set<string>()
  const lues = new Map<string, Promise<boolean>>()
  for (const n of notifications) {
    if (n.type !== 'FICHE_CONNEXE' || n.fiche === null) continue
    const fiche = n.fiche
    let lisible = lues.get(fiche.id)
    if (lisible === undefined) {
      lisible = lecteurDeLaFiche(prisma, moiId, n.organisationId, fiche)
      lues.set(fiche.id, lisible)
    }
    if (!(await lisible)) illisibles.add(n.id)
  }
  return illisibles
}
