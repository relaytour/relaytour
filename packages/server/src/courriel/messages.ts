import type { PrismaClient } from '@relaytour/database'

import type { CourrielJobData, SorteCourriel } from '../jobs/queues.ts'
import { CODE_VALIDITE_SECONDES } from '../lib/connexion.ts'
import { aujourdhui } from '../lib/droits.ts'
import {
  messageNotification,
  preferencesDe,
  type NotificationAComposer,
} from '../lib/notifications.ts'
import {
  configurationOrganisation,
  variablesOrganisation,
} from '../lib/organisation.ts'

import { rendre, type Variables } from './rendu.ts'

const LIBELLES_STATUT: Record<string, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  FAITE: 'Faite',
  ABANDONNEE: 'Abandonnée',
}

/** Les sujets, composés à l'envoi avec le nom court de l'organisation. */
export function sujets(nomCourt: string): Record<SorteCourriel, string> {
  return {
    essai: 'Essai d’envoi du serveur Relaytour',
    invitation: `Votre accès à l’espace organisateur ${nomCourt}`,
    'code-connexion': `Votre code de connexion ${nomCourt}`,
    'tache-modifiee': 'Une de vos tâches a été modifiée',
    'rappels-echeance': `Échéances de vos tâches ${nomCourt}`,
    resume: `Votre résumé ${nomCourt}`,
  }
}

export interface MessageCompose {
  sujet: string
  html: string
  texte: string
  desabonnement?: string
  /** Appelé après le départ du mail : dates d'envoi et de résumé. */
  apresEnvoi?: () => Promise<void>
}

const SELECTION_NOTIFICATION = {
  id: true,
  type: true,
  jours: true,
  acteurId: true,
  personneId: true,
  tache: {
    select: {
      titre: true,
      echeance: true,
      perimetre: { select: { nom: true, slug: true } },
    },
  },
} as const

async function nomsDes(
  prisma: PrismaClient,
  notifications: NotificationAComposer[]
) {
  const ids = [
    ...new Set(
      notifications
        .flatMap(n => [n.acteurId, n.personneId])
        .filter(id => id !== null)
    ),
  ]
  const personnes = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })
  return new Map(personnes.map(p => [p.id, p.name]))
}

/**
 * L'organisation dont un mail porte le nom et les couleurs (ADR 0008) : celle du job,
 * sinon l'unique organisation de la personne. Undefined laisse la configuration
 * choisir la première organisation de l'installation.
 */
async function organisationDuMail(
  prisma: PrismaClient,
  job: CourrielJobData
): Promise<string | undefined> {
  if (job.organisationId !== undefined) return job.organisationId
  if (job.userId === undefined) return undefined
  const appartenances = await prisma.appartenance.findMany({
    where: { userId: job.userId },
    select: { organisationId: true },
    take: 2,
  })
  return appartenances.length === 1
    ? appartenances[0]?.organisationId
    : undefined
}

/**
 * Compose le message d'une sorte donnée, au moment de l'envoi.
 * Les données du compte se relisent en base ; le code vient de la charge utile.
 * Renvoie null quand il n'y a rien à envoyer (préférence désactivée, résumé vide).
 */
export async function composer(
  prisma: PrismaClient,
  job: CourrielJobData
): Promise<MessageCompose | null> {
  const variables: Variables = {}
  let desabonnement: string | undefined
  let apresEnvoi: (() => Promise<void>) | undefined
  const organisationId = await organisationDuMail(prisma, job)
  const configuration = await configurationOrganisation(organisationId)
  const origine = configuration.origineOrga
  const lienPreferences = `${origine}/preferences`

  if (job.sorte === 'invitation') {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: job.userId },
      select: { name: true },
    })
    variables.nom = user.name
    variables.lienConnexion = `${origine}/connexion`
  }

  if (job.sorte === 'code-connexion') {
    if (job.code === undefined) {
      throw new Error('Le mail « code-connexion » exige un code.')
    }
    variables.code = job.code
    variables.validite = `${CODE_VALIDITE_SECONDES / 60} minutes`
    // Le code et l'adresse sont placés après « # » : le navigateur ne les envoie
    // jamais au serveur, et l'écran de connexion remplit les deux champs.
    const compte = job.userId
      ? await prisma.user.findUnique({
          where: { id: job.userId },
          select: { email: true },
        })
      : null
    const fragment = new URLSearchParams({ code: job.code })
    if (compte !== null) fragment.set('adresse', compte.email)
    variables.lienConnexion = `${origine}/connexion#${fragment.toString()}`
  }

  if (job.sorte === 'tache-modifiee') {
    if (job.tache === undefined) {
      throw new Error('Le mail « tache-modifiee » exige une tâche.')
    }
    if (
      job.userId &&
      !(await preferencesDe(prisma, job.userId)).mailModification
    ) {
      return null
    }
    const [tache, acteur] = await Promise.all([
      prisma.tache.findUniqueOrThrow({
        where: { id: job.tache.tacheId },
        select: {
          titre: true,
          statut: true,
          perimetre: {
            select: {
              nom: true,
              slug: true,
              activite: { select: { slug: true } },
            },
          },
        },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: job.tache.acteurId },
        select: { name: true },
      }),
    ])
    variables.acteur = acteur.name
    variables.titre = tache.titre
    variables.perimetre = tache.perimetre.nom
    variables.changement =
      job.tache.changement === 'statut'
        ? `Le nouveau statut de la tâche est « ${LIBELLES_STATUT[tache.statut]} ».`
        : 'Le titre, la description ou l’échéance de la tâche ont changé.'
    // Les pages d'un périmètre vivent sous le slug de son activité (ADR 0008).
    variables.lienPerimetre = `${origine}/${tache.perimetre.activite.slug}/perimetres/${tache.perimetre.slug}`
    const notificationId = job.notificationId
    if (notificationId) {
      apresEnvoi = async () => {
        await prisma.notification.updateMany({
          where: { id: notificationId },
          data: { envoyeeLe: new Date() },
        })
      }
    }
  }

  if (job.sorte === 'rappels-echeance') {
    if (!job.userId || !job.notificationIds?.length) return null
    if (!(await preferencesDe(prisma, job.userId)).mailEcheance) return null
    const notifications = await prisma.notification.findMany({
      where: {
        id: { in: job.notificationIds },
        userId: job.userId,
        lueLe: null,
      },
      select: SELECTION_NOTIFICATION,
      orderBy: { createdAt: 'asc' },
    })
    if (notifications.length === 0) return null
    const noms = await nomsDes(prisma, notifications)
    variables.rappels = notifications.map(n =>
      messageNotification(n, noms, job.userId!)
    )
    variables.lienConnexion = `${origine}/`
    variables.lienPreferences = lienPreferences
    desabonnement = lienPreferences
    apresEnvoi = async () => {
      await prisma.notification.updateMany({
        where: { id: { in: notifications.map(n => n.id) } },
        data: { envoyeeLe: new Date() },
      })
    }
  }

  if (job.sorte === 'resume') {
    if (!job.userId) return null
    const userId = job.userId
    const preferences = await preferencesDe(prisma, userId)
    if (preferences.frequenceResume === 'AUCUN') return null
    // Le résumé porte sur une organisation : ses notifications et ses tâches.
    const idOrganisation = configuration.id
    if (idOrganisation === null) return null
    const jour = new Date(
      `${aujourdhui(new Date(), configuration.fuseauHoraire)}T00:00:00Z`
    )
    const [personne, notifications, taches] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true },
      }),
      prisma.notification.findMany({
        where: {
          userId,
          organisationId: idOrganisation,
          lueLe: null,
          resumeeLe: null,
        },
        select: SELECTION_NOTIFICATION,
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.tache.findMany({
        where: {
          statut: { in: ['A_FAIRE', 'EN_COURS'] },
          assignations: { some: { userId } },
          edition: { statut: { not: 'ARCHIVEE' } },
          perimetre: { organisationId: idOrganisation },
          echeance: {
            lte: new Date(jour.getTime() + 14 * 24 * 3600 * 1000),
          },
        },
        select: {
          titre: true,
          echeance: true,
          perimetre: { select: { nom: true } },
        },
        orderBy: { echeance: 'asc' },
      }),
    ])
    if (notifications.length === 0 && taches.length === 0) return null
    const noms = await nomsDes(prisma, notifications)
    variables.nom = personne.name
    variables.periode =
      preferences.frequenceResume === 'QUOTIDIEN'
        ? 'depuis hier'
        : 'de la semaine'
    variables.nouvelles =
      notifications.length > 0
        ? notifications.map(n => messageNotification(n, noms, userId))
        : ['Aucune nouvelle.']
    variables.echeances =
      taches.length > 0
        ? taches.map(t => {
            const date = t.echeance!.toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            })
            const retard = t.echeance! < jour ? ' (en retard)' : ''
            return `${date} : ${t.titre} (${t.perimetre.nom})${retard}`
          })
        : ['Aucune échéance.']
    variables.lienConnexion = `${origine}/`
    variables.lienPreferences = lienPreferences
    desabonnement = lienPreferences
    apresEnvoi = async () => {
      const maintenant = new Date()
      await prisma.notification.updateMany({
        where: { id: { in: notifications.map(n => n.id) } },
        data: { resumeeLe: maintenant },
      })
      // La date du résumé se note pour cette organisation : une personne membre de
      // plusieurs organisations reçoit le résumé de chacune.
      const actuelles = await prisma.preferenceNotification.findUnique({
        where: { userId },
        select: { derniersResumes: true },
      })
      const derniersResumes = {
        ...(typeof actuelles?.derniersResumes === 'object' &&
        actuelles.derniersResumes !== null
          ? (actuelles.derniersResumes as Record<string, string>)
          : {}),
        [idOrganisation]: maintenant.toISOString(),
      }
      await prisma.preferenceNotification.upsert({
        where: { userId },
        update: { dernierResumeLe: maintenant, derniersResumes },
        create: {
          userId,
          dernierResumeLe: maintenant,
          derniersResumes,
          organisationId: idOrganisation,
        },
      })
    }
  }

  const { html, texte } = rendre(
    job.sorte,
    variables,
    variablesOrganisation(configuration)
  )
  return {
    sujet: sujets(configuration.nomCourt)[job.sorte],
    html,
    texte,
    desabonnement,
    apresEnvoi,
  }
}
