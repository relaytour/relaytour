import type {
  NiveauNotification,
  PrismaClient,
  StatutTache,
  TypeNotification,
} from '@relaytour/database'

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
      slug: true,
      activiteId: true,
      perimetreId: true,
      versionCourante: { select: { titre: true } },
    },
  },
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
    slug: string
    activiteId: string
    perimetreId: string | null
    versionCourante: { titre: string } | null
  } | null
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
  return date.toLocaleDateString('fr-FR', {
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
}

async function lireContexte(
  prisma: PrismaClient,
  notifications: NotificationLue[]
): Promise<Contexte> {
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
    notifications.flatMap(n => [perimetreIdDe(n), n.tache?.perimetreId ?? null])
  )
  const organisations = uniques(notifications.map(n => n.organisationId))
  const [
    lignesPersonnes,
    lignesActivites,
    lignesPerimetres,
    periodes,
    premieres,
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
  const acteur = (n.acteurId && c.noms.get(n.acteurId)) ?? 'Une personne'
  const personne =
    n.personneId === moiId
      ? 'vous'
      : ((n.personneId && c.noms.get(n.personneId)) ?? 'une personne')
  const perimetre =
    (perimetreIdDe(n) && c.perimetres.get(perimetreIdDe(n)!)?.nom) ??
    'un périmètre'

  switch (n.type) {
    // Une demande porte le nom d'une personne qui n'est pas membre : la notification
    // ne le cite pas (ADR 0015).
    case 'DEMANDE_RECUE':
      return `Une demande pour rejoindre l’équipe attend votre revue${activite}`
    case 'DEMANDE_ACCEPTEE':
      return `${acteur} a accepté une demande pour rejoindre l’équipe${activite}`
    case 'DEMANDE_REFUSEE':
      return `${acteur} a refusé une demande pour rejoindre l’équipe${activite}`
    // La personne a accepté : elle est membre, et son nom se lit désormais (ADR 0030).
    case 'INVITATION_ACCEPTEE':
      return `${acteur} a accepté l’invitation et rejoint l’organisation${activite}`
    case 'AFFECTATION_AJOUTEE':
      return `${acteur} a affecté ${personne} au périmètre ${perimetre}${activite}`
    case 'AFFECTATION_RETIREE':
      return `${acteur} a retiré ${personne} du périmètre ${perimetre}${activite}`
    case 'SOUHAIT_FORMULE':
      return `${acteur} souhaite rejoindre le périmètre ${perimetre}${activite}`
    case 'ADMIN_ACTIVITE_NOMME':
      return `${acteur} a nommé ${personne} admin de l’activité${activite}`
    case 'ADMIN_ACTIVITE_RETIRE':
      return `${acteur} a retiré à ${personne} le rôle d’admin de l’activité${activite}`
    case 'ADMIN_ORGANISATION_NOMME':
      return `${acteur} a nommé ${personne} admin de l’organisation`
    case 'ADMIN_ORGANISATION_RETIRE':
      return `${acteur} a retiré à ${personne} le rôle d’admin de l’organisation`
    case 'PERSONNE_ARCHIVEE':
      return `${acteur} a archivé ${personne} dans l’organisation`
    case 'PERSONNE_RETABLIE':
      return `${acteur} a rétabli ${personne} dans l’organisation`
    case 'PLACE_MODIFIEE':
      return `Votre place dans l’équipe a changé${activite}`
    case 'FICHE_CREEE':
    case 'FICHE_MODIFIEE': {
      if (n.fiche === null) return 'Cette fiche n’existe plus'
      const fiche = `« ${n.fiche.versionCourante?.titre ?? n.fiche.slug} »${lieu}`
      return n.type === 'FICHE_CREEE'
        ? `${acteur} a créé la fiche ${fiche}`
        : `${acteur} a modifié la fiche ${fiche}`
    }
    default:
      break
  }

  const tache = n.tache
  if (tache === null) return 'Cette tâche n’existe plus'
  const titre = `« ${tache.titre} »${lieu}`
  // Une déclinaison nomme le périmètre qui la demande (ADR 0026).
  const demandeur = tache.origine?.perimetre.nom
  switch (n.type) {
    case 'TACHE_CREEE':
      return demandeur === undefined
        ? `${acteur} a créé la tâche ${titre}`
        : `${acteur} a ajouté la tâche ${titre}, demandée par ${demandeur}`
    case 'DECLINAISON_PROPOSEE':
      return `${acteur} propose la tâche ${titre}${demandeur === undefined ? '' : `, demandée par ${demandeur}`}. Elle attend l’accord du périmètre`
    case 'DECLINAISON_ACCEPTEE':
      return `${acteur} a accepté la tâche ${titre}`
    case 'DECLINAISON_REFUSEE':
      return `${acteur} a refusé la tâche ${titre}`
    case 'TACHE_MODIFIEE':
      return `${acteur} a modifié la tâche ${titre}`
    // Le texte du commentaire ne figure jamais dans une notification (ADR 0029).
    case 'TACHE_COMMENTEE':
      return `${acteur} a commenté la tâche ${titre}`
    case 'TACHE_ASSIGNEE':
      return n.personneId === n.acteurId
        ? `${acteur} s’occupe de la tâche ${titre}`
        : n.personneId === moiId
          ? `${acteur} vous a assigné la tâche ${titre}`
          : `${acteur} a assigné la tâche ${titre} à ${personne}`
    case 'TACHE_DESASSIGNEE':
      return n.personneId === n.acteurId
        ? `${acteur} ne s’occupe plus de la tâche ${titre}`
        : n.personneId === moiId
          ? `${acteur} vous a retiré·e de la tâche ${titre}`
          : `${acteur} a retiré ${personne} de la tâche ${titre}`
    case 'ECHEANCE_PROCHE':
      return n.jours === 0
        ? `La tâche ${titre} arrive à échéance aujourd’hui`
        : n.jours === 1
          ? `La tâche ${titre} arrive à échéance demain`
          : `La tâche ${titre} arrive à échéance dans ${n.jours ?? 7} jours`
    case 'TACHE_EN_RETARD':
      return tache.echeance
        ? `La tâche ${titre} est en retard depuis le ${dateLongue(tache.echeance)}`
        : `La tâche ${titre} est en retard`
    case 'TACHE_STATUT':
      switch (n.statut) {
        // Qui a coché reste réservé : la phrase ne nomme personne.
        case 'FAITE':
          return `La tâche ${titre} est faite`
        case 'EN_COURS':
          return `${acteur} a commencé la tâche ${titre}`
        case 'ABANDONNEE':
          return `${acteur} a abandonné la tâche ${titre}`
        default:
          return `${acteur} a remis la tâche ${titre} à faire`
      }
    default:
      return `${acteur} a agi sur la tâche ${titre}`
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
    case 'PLACE_MODIFIEE':
      return `/${slug}`
    case 'FICHE_CREEE':
    case 'FICHE_MODIFIEE':
      return n.fiche ? `/${slug}/fiches/${n.fiche.slug}` : `/${slug}`
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
  const c = await lireContexte(prisma, notifications)
  return notifications.map(n => {
    const activiteId = activiteIdDe(n)
    const perimetreId = perimetreIdDe(n)
    const activite = (activiteId && c.activites.get(activiteId)) || null
    const perimetre = (perimetreId && c.perimetres.get(perimetreId)) || null
    const periode =
      activite !== null && c.plusieursPeriodes.has(activite.id) && n.tache
        ? n.tache.edition.nom
        : null
    const nomActivite = periode ?? activite?.nom ?? null
    const objet = n.tache !== null || n.fiche !== null
    const lieu = !objet
      ? ''
      : [nomActivite, perimetre?.nom].filter(Boolean).length > 0
        ? ` (${[nomActivite, perimetre?.nom].filter(Boolean).join(', ')})`
        : ''
    const sansActivite =
      !objet && nomActivite !== null ? ` (${nomActivite})` : ''
    const parties = [periode, perimetre?.nom].filter(Boolean)
    const lieuPerimetre =
      objet && parties.length > 0 ? ` (${parties.join(', ')})` : ''
    return {
      id: n.id,
      message: `${phrase(n, c, moiId, '', '')}.`,
      messageAvecContexte: `${phrase(n, c, moiId, lieu, sansActivite)}.`,
      messageAvecPerimetre: `${phrase(n, c, moiId, lieuPerimetre, '')}.`,
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
