import type { PrismaClient } from '@relaytour/database'

import type { CourrielJobData, SorteCourriel } from '../jobs/queues.ts'
import { CODE_VALIDITE_SECONDES } from '../lib/connexion.ts'
import { adminsAPrevenir, demandesEnAttente } from '../lib/demandes.ts'
import { TACHES_ACTIVES } from '../lib/declinaisons.ts'
import { aujourdhui } from '../lib/droits.ts'
import {
  changementsEquipe,
  decouvreDesPerimetres,
  perimetresDeLaPersonne,
} from '../lib/equipe.ts'
import { invitationEnAttente } from '../lib/invitations.ts'
import {
  LIBELLES_ROLE,
  lienModeDEmploi,
  roleDuModeDEmploi,
} from '../lib/modes-d-emploi.ts'
import {
  avecOrganisation,
  composerNotifications,
  grouperParActivite,
  SELECTION_NOTIFICATION,
} from '../lib/composition-notifications.ts'
import { preferencesDe } from '../lib/notifications.ts'
import { filtreNotificationsAdmin } from '../lib/notifications-admin.ts'
import {
  configurationActivite,
  configurationOrganisation,
  type ConfigurationActivite,
  type ConfigurationOrganisation,
  variablesOrganisation,
} from '../lib/organisation.ts'

import { rendre, type Variables } from './rendu.ts'

const LIBELLES_STATUT: Record<string, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  FAITE: 'Faite',
  ABANDONNEE: 'Abandonnée',
}

/**
 * Les sujets, composés à l'envoi (ADR 0032). Chaque sujet commence par le nom court
 * de l'organisation ; un mail qui porte sur une seule activité ajoute son nom après
 * un point médian : « TIMM · Rencontres : une de vos tâches a été modifiée ».
 */
export function sujets(
  nomCourt: string,
  activite?: string
): Record<SorteCourriel, string> {
  const tete = activite === undefined ? nomCourt : `${nomCourt} · ${activite}`
  return {
    essai: 'Essai d’envoi du serveur Relaytour',
    invitation: `${tete} : votre accès à l’espace organisateur`,
    'code-connexion': `${nomCourt} : votre code de connexion`,
    'tache-modifiee': `${tete} : une de vos tâches a été modifiée`,
    'rappels-echeance': `${tete} : échéances de vos tâches`,
    resume: `${nomCourt} : votre résumé`,
    equipe: `${tete} : votre place dans l’équipe a changé`,
    demandes: `${tete} : demandes pour rejoindre l’équipe`,
  }
}

/** L'activité qu'un sujet nomme : celle de la configuration du mail, s'il y en a une. */
function activiteDuSujet(
  configuration: ConfigurationOrganisation
): string | undefined {
  return (configuration as Partial<ConfigurationActivite>).activite?.nom
}

const SANS_REPONSE = new Set<SorteCourriel>(['essai', 'code-connexion'])

export interface MessageCompose {
  sujet: string
  html: string
  texte: string
  desabonnement?: string
  /** Contact de l'activité ou de l'organisation, en Reply-To. */
  repondreA?: string
  /** Appelé après le départ du mail : dates d'envoi et de résumé. */
  apresEnvoi?: () => Promise<void>
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
  // Le sujet d'une sorte de mail, sauf quand le contenu en demande un autre.
  let sujet: string | undefined
  let desabonnement: string | undefined
  let apresEnvoi: (() => Promise<void>) | undefined
  const organisationId = await organisationDuMail(prisma, job)
  // Un mail qui concerne une seule activité prend son identité (ADR 0009).
  let configuration: ConfigurationOrganisation =
    job.activiteId === undefined
      ? await configurationOrganisation(organisationId)
      : await configurationActivite(job.activiteId)
  const origine = configuration.origineOrga
  // Les préférences se lisent dans l'organisation du mail (ADR 0032).
  const organisationDesPreferences = organisationId ?? configuration.id ?? ''
  // Chaque lien désigne l'organisation du mail (ADR 0032) : l'espace organisateur
  // la choisit à l'ouverture, même si l'appareil en a choisi une autre.
  const lienVers = (chemin: string) =>
    `${origine}${avecOrganisation(chemin, configuration.slug)}`
  const lienPreferences = lienVers('/preferences')

  if (job.sorte === 'invitation') {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: job.userId },
      select: { id: true, name: true },
    })
    variables.nom = user.name
    variables.lienConnexion = lienVers('/connexion')
    variables.accroche =
      'L’équipe d’organisation vous a ouvert un accès à l’espace organisateur. Vous y retrouverez vos périmètres, vos tâches et les fiches méthode des éditions précédentes.'
    // Le rôle se lit à l'envoi : une invitation renvoyée après une nomination
    // lie le mode d'emploi du nouveau rôle.
    const role = await roleDuModeDEmploi(
      prisma,
      user.id,
      organisationId ?? configuration.id
    )
    const { env } = await import('../env.ts')
    variables.roleModeDEmploi = LIBELLES_ROLE[role]
    variables.lienModeDEmploi = lienModeDEmploi(env.MODES_D_EMPLOI_URL, role)
    // Les périmètres de la personne, avec leur description (ADR 0012). Sans
    // périmètre, le mail explique comment en obtenir un.
    const idOrganisation = organisationId ?? configuration.id
    const perimetres =
      idOrganisation === null
        ? []
        : await perimetresDeLaPersonne(prisma, user.id, idOrganisation)
    variables.perimetres = perimetres
    // Un compte connu hors de l'organisation n'en est pas membre : son invitation
    // attend son accord (ADR 0030). Le mail le dit, et liste ce qu'on lui propose.
    // Sans appartenance ni invitation en cours (refusée, retirée, expirée), rien ne part.
    const attente =
      idOrganisation === null
        ? 'membre'
        : await invitationEnAttente(prisma, user.id, idOrganisation)
    if (attente === 'aucune') return null
    if (attente !== 'membre') {
      const activite = activiteDuSujet(configuration)
      sujet = `${activite === undefined ? configuration.nomCourt : `${configuration.nomCourt} · ${activite}`} : invitation à rejoindre l’espace organisateur`
      variables.accroche = `${configuration.nomCourt} vous invite à rejoindre son espace organisateur. Vous avez déjà un compte à cette adresse : après connexion, vous acceptez ou refusez cette invitation depuis le menu de votre compte. Rien n’est partagé avec cette organisation avant votre accord.`
      variables.perimetres = attente.perimetres
      // La personne n'a encore aucun rôle dans l'organisation : le mode d'emploi
      // lié est celui du rôle que l'invitation propose.
      const propose =
        attente.role === 'ADMIN' ? 'admin-organisation' : 'referent'
      variables.roleModeDEmploi = LIBELLES_ROLE[propose]
      variables.lienModeDEmploi = lienModeDEmploi(
        env.MODES_D_EMPLOI_URL,
        propose
      )
    }
    variables.situation =
      attente !== 'membre'
        ? attente.perimetres.length > 0
          ? 'L’invitation vous propose ces périmètres :'
          : 'Vous choisirez vos périmètres avec l’équipe après votre accord.'
        : perimetres.length > 0
          ? 'Vous faites partie de l’équipe de ces périmètres :'
          : idOrganisation !== null &&
              (await decouvreDesPerimetres(prisma, user.id, idOrganisation))
            ? 'Vous n’avez pas encore de périmètre. Dans « Tous les périmètres », vous découvrez les périmètres et formulez vos souhaits. Un admin vous affectera ensuite. En attendant, le mode d’emploi vous aide à découvrir l’espace.'
            : 'Vous n’avez pas encore de périmètre : un admin vous affectera à l’un d’eux. En attendant, le mode d’emploi vous aide à découvrir l’espace.'
  }

  if (job.sorte === 'equipe') {
    if (job.fenetre === undefined) {
      throw new Error('Le mail « equipe » exige une fenêtre.')
    }
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: job.userId },
      select: { id: true, name: true },
    })
    const idOrganisation = organisationId ?? configuration.id
    if (idOrganisation === null) return null
    const changements = await changementsEquipe(
      prisma,
      user.id,
      idOrganisation,
      job.fenetre,
      job.activiteId
    )
    // Un changement annulé pendant la fenêtre ne s'annonce pas.
    if (changements.length === 0) return null
    variables.nom = user.name
    variables.changements = changements
    variables.lienConnexion = lienVers('/connexion')
    const role = await roleDuModeDEmploi(prisma, user.id, idOrganisation)
    const { env } = await import('../env.ts')
    variables.roleModeDEmploi = LIBELLES_ROLE[role]
    variables.lienModeDEmploi = lienModeDEmploi(env.MODES_D_EMPLOI_URL, role)
  }

  if (job.sorte === 'demandes') {
    if (job.activiteId === undefined) {
      throw new Error('Le mail « demandes » exige une activité.')
    }
    if (!job.userId) return null
    const userId = job.userId
    const activite = await prisma.activite.findUnique({
      where: { id: job.activiteId },
      select: { id: true, slug: true, nom: true, organisationId: true },
    })
    if (activite === null) return null
    if (
      !(await preferencesDe(prisma, userId, activite.organisationId))
        .mailDemandes
    )
      return null
    // Le rôle se relit à l'envoi : une personne qui n'administre plus l'activité
    // ne reçoit rien.
    const admins = await adminsAPrevenir(
      prisma,
      activite.organisationId,
      activite.id
    )
    if (!admins.includes(userId)) return null
    // Le mail compte les demandes qui attendent au moment de l'envoi : une demande
    // déjà traitée ne s'annonce pas. Il porte un nombre et un lien, et ne cite
    // aucune personne qui n'est pas membre.
    const nombre = await demandesEnAttente(prisma, activite.id)
    if (nombre === 0) return null
    const personne = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    })
    variables.nom = personne.name
    variables.annonce =
      nombre === 1
        ? `Une demande pour rejoindre l’équipe de l’activité ${activite.nom} attend votre décision.`
        : `${nombre} demandes pour rejoindre l’équipe de l’activité ${activite.nom} attendent votre décision.`
    variables.lienDemandes = lienVers(
      `/${activite.slug}/admin/personnes?onglet=demandes`
    )
    variables.lienPreferences = lienPreferences
    desabonnement = lienPreferences
    apresEnvoi = async () => {
      await prisma.notification.updateMany({
        where: {
          userId,
          activiteId: activite.id,
          type: 'DEMANDE_RECUE',
          envoyeeLe: null,
        },
        data: { envoyeeLe: new Date() },
      })
    }
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
      !(await preferencesDe(prisma, job.userId, organisationDesPreferences))
        .mailModification
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
              activite: { select: { id: true, slug: true } },
            },
          },
        },
      }),
      // Un passage à « faite » arrive sans auteur : le mail ne nomme personne.
      job.tache.acteurId === undefined
        ? { name: 'Une autre personne' }
        : prisma.user.findUniqueOrThrow({
            where: { id: job.tache.acteurId },
            select: { name: true },
          }),
    ])
    configuration = await configurationActivite(tache.perimetre.activite.id)
    variables.acteur = acteur.name
    variables.titre = tache.titre
    variables.perimetre = tache.perimetre.nom
    variables.changement =
      job.tache.changement === 'statut'
        ? `Le nouveau statut de la tâche est « ${LIBELLES_STATUT[tache.statut]} ».`
        : 'Le titre, la description ou l’échéance de la tâche ont changé.'
    // Les pages d'un périmètre vivent sous le slug de son activité (ADR 0008).
    variables.lienPerimetre = lienVers(
      `/${tache.perimetre.activite.slug}/perimetres/${tache.perimetre.slug}`
    )
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
    const userId = job.userId
    if (
      !(await preferencesDe(prisma, userId, organisationDesPreferences))
        .mailEcheance
    )
      return null
    const notifications = await prisma.notification.findMany({
      where: { id: { in: job.notificationIds }, userId, lueLe: null },
      select: SELECTION_NOTIFICATION,
      orderBy: { createdAt: 'asc' },
    })
    if (notifications.length === 0) return null
    const composees = await composerNotifications(prisma, notifications, userId)
    // Les rappels se rangent par activité (ADR 0032). Un seul rappel d'activité
    // nomme son activité dans le sujet.
    variables.rappels = grouperParActivite(composees, configuration.nomCourt)
    const activites = new Set(composees.map(n => n.activite?.nom ?? null))
    const seule = activites.size === 1 ? [...activites][0] : null
    if (seule) sujet = sujets(configuration.nomCourt, seule)['rappels-echeance']
    variables.lienConnexion = lienVers('/')
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
    // Le résumé porte sur une organisation : ses notifications, ses tâches et ses
    // préférences (ADR 0032).
    const idOrganisation = configuration.id
    if (idOrganisation === null) return null
    const preferences = await preferencesDe(prisma, userId, idOrganisation)
    if (preferences.frequenceResume === 'AUCUN') return null
    const jour = new Date(
      `${aujourdhui(new Date(), configuration.fuseauHoraire)}T00:00:00Z`
    )
    // La section « Pour vos rôles d'admin » ne reprend que les notifications que la
    // personne lit encore à ce titre (ADR 0033).
    const filtreAdmin = preferences.resumeAdmin
      ? await filtreNotificationsAdmin(prisma, userId, idOrganisation)
      : null
    const nonResumees = {
      userId,
      organisationId: idOrganisation,
      lueLe: null,
      resumeeLe: null,
    }
    const [personne, notifications, notificationsAdmin, taches] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { name: true },
        }),
        prisma.notification.findMany({
          where: { ...nonResumees, niveau: 'REFERENT' },
          select: SELECTION_NOTIFICATION,
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
        filtreAdmin === null
          ? []
          : prisma.notification.findMany({
              where: { ...nonResumees, ...filtreAdmin },
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
            AND: [TACHES_ACTIVES],
          },
          select: {
            titre: true,
            echeance: true,
            perimetre: {
              select: {
                nom: true,
                activite: { select: { id: true, nom: true } },
              },
            },
          },
          orderBy: { echeance: 'asc' },
        }),
      ])
    if (
      notifications.length === 0 &&
      notificationsAdmin.length === 0 &&
      taches.length === 0
    )
      return null
    const [composees, composeesAdmin] = await Promise.all([
      composerNotifications(prisma, notifications, userId),
      composerNotifications(prisma, notificationsAdmin, userId),
    ])
    variables.nom = personne.name
    variables.periode =
      preferences.frequenceResume === 'QUOTIDIEN'
        ? 'depuis hier'
        : 'de la semaine'
    // Les nouvelles se rangent par activité, puis viennent celles des rôles
    // d'admin, sous un intertitre qui le dit (ADR 0032 et 0033).
    const groupes = [
      ...grouperParActivite(composees, configuration.nomCourt),
      ...grouperParActivite(
        composeesAdmin,
        configuration.nomCourt,
        'Pour vos rôles d’admin · '
      ),
    ]
    variables.nouvelles = groupes.length > 0 ? groupes : ['Aucune nouvelle.']
    // Les échéances se rangent aussi par activité.
    const parActivite = new Map<string, { titre: string; elements: string[] }>()
    for (const t of taches) {
      const date = t.echeance!.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
      const retard = t.echeance! < jour ? ' (en retard)' : ''
      const groupe = parActivite.get(t.perimetre.activite.id) ?? {
        titre: t.perimetre.activite.nom,
        elements: [],
      }
      groupe.elements.push(`${date} : ${t.titre} (${t.perimetre.nom})${retard}`)
      parActivite.set(t.perimetre.activite.id, groupe)
    }
    variables.echeances =
      parActivite.size > 0 ? [...parActivite.values()] : ['Aucune échéance.']
    variables.lienConnexion = lienVers('/')
    variables.lienPreferences = lienPreferences
    desabonnement = lienPreferences
    apresEnvoi = async () => {
      const maintenant = new Date()
      await prisma.notification.updateMany({
        where: {
          id: { in: [...notifications, ...notificationsAdmin].map(n => n.id) },
        },
        data: { resumeeLe: maintenant },
      })
      // La date du résumé se note pour cette organisation (ADR 0032).
      await prisma.preferenceOrganisation.upsert({
        where: {
          userId_organisationId: { userId, organisationId: idOrganisation },
        },
        update: { dernierResumeLe: maintenant },
        create: {
          userId,
          organisationId: idOrganisation,
          dernierResumeLe: maintenant,
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
    sujet:
      sujet ??
      sujets(configuration.nomCourt, activiteDuSujet(configuration))[job.sorte],
    html,
    texte,
    desabonnement,
    // Un code de connexion et un essai n'appellent pas de réponse.
    repondreA: SANS_REPONSE.has(job.sorte)
      ? undefined
      : configuration.contactRecrutement,
    apresEnvoi,
  }
}
