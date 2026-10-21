import type { PrismaClient } from '@relaytour/database'

import type { CourrielJobData, SorteCourriel } from '../jobs/queues.ts'
import { CODE_VALIDITE_SECONDES } from '../lib/connexion.ts'
import { concilierApresEnvoi } from '../lib/convocations.ts'
import { adminsAPrevenir, demandesEnAttente } from '../lib/demandes.ts'
import { TACHES_ACTIVES } from '../lib/declinaisons.ts'
import { aujourdhui } from '../lib/droits.ts'
import {
  changementsEquipe,
  decouvreDesPerimetres,
  perimetresDeLaPersonne,
} from '../lib/equipe.ts'
import { horaireEnClair } from '../lib/heures.ts'
import { calendrier } from '../lib/ics.ts'
import {
  jetonEspace,
  lienEspace,
  placesAVenir,
} from '../lib/espace-benevole.ts'
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
    'convocation-reunion': `${tete} : convocation à une réunion`,
    'annulation-reunion': `${tete} : réunion annulée`,
    'benevole-lien': `${tete} : votre participation`,
    'benevole-places': `${tete} : vos places ont changé`,
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
  /** Fichier iCalendar joint (ADR 0037). */
  icalEvent?: { methode: 'REQUEST' | 'CANCEL'; contenu: string }
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

  let icalEvent: MessageCompose['icalEvent']
  if (
    job.sorte === 'convocation-reunion' ||
    job.sorte === 'annulation-reunion'
  ) {
    if (job.reunionId === undefined || job.userId === undefined) {
      throw new Error(
        `Le mail « ${job.sorte} » exige une réunion et un compte.`
      )
    }
    const [reunion, personne] = await Promise.all([
      prisma.reunion.findUnique({
        where: { id: job.reunionId },
        include: {
          perimetre: { select: { nom: true } },
          activite: { select: { id: true, slug: true, nom: true } },
          organisation: { select: { fuseauHoraire: true } },
          // La convocation de ce job ; pour une annulation, toute convocation
          // actuelle de la personne, qui l'aurait convoquée de nouveau.
          convocations: {
            where:
              job.sorte === 'convocation-reunion' &&
              job.convocationId !== undefined
                ? { id: job.convocationId }
                : { userId: job.userId },
          },
        },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: job.userId },
        select: { name: true, email: true },
      }),
    ])
    if (reunion === null) return null
    const convocation = reunion.convocations[0]
    const maintenant = new Date()
    if (job.sorte === 'convocation-reunion') {
      // La convocation part pour une réunion prévue et pas encore terminée, à
      // une personne encore convoquée, une fois par version. Une convocation
      // retardée par le plafond quotidien (ADR 0034) part donc même après le
      // début de la réunion. Seul le job de la version courante envoie : un job
      // d'une version dépassée laisse la place au suivant.
      if (
        convocation === undefined ||
        reunion.statut !== 'PREVUE' ||
        reunion.fin.getTime() <= maintenant.getTime() ||
        (job.sequenceReunion !== undefined &&
          job.sequenceReunion !== reunion.sequence) ||
        convocation.sequenceEnvoyee === reunion.sequence
      ) {
        return null
      }
    } else if (convocation !== undefined && reunion.statut === 'PREVUE') {
      // La personne a été convoquée de nouveau : rien n'est annulé.
      return null
    }
    configuration = await configurationActivite(reunion.activite.id)
    const fuseau = reunion.organisation.fuseauHoraire
    const lienAgenda = lienVers(
      `/${reunion.activite.slug}/agenda?edition=${reunion.editionId}&reunion=${reunion.id}`
    )
    const agenda =
      reunion.perimetre?.nom ?? `l’agenda de ${reunion.activite.nom}`
    const miseAJour =
      job.sorte === 'convocation-reunion' &&
      convocation?.sequenceEnvoyee !== null &&
      convocation?.sequenceEnvoyee !== undefined
    const annulee = reunion.statut === 'ANNULEE'
    // Une personne retirée ne lit plus le détail de la réunion : son annulation
    // ne porte ni le lieu, ni le lien de visio, ni la description.
    const retrait = job.sorte === 'annulation-reunion' && !annulee
    variables.intitule =
      job.sorte === 'annulation-reunion'
        ? annulee
          ? 'Réunion annulée'
          : 'Vous n’êtes plus convoqué·e'
        : miseAJour
          ? 'Réunion modifiée'
          : 'Convocation à une réunion'
    variables.intro =
      job.sorte === 'annulation-reunion'
        ? annulee
          ? `La réunion « ${reunion.titre} » (${agenda}) est annulée.`
          : `Vous ne faites plus partie des personnes convoquées à la réunion « ${reunion.titre} » (${agenda}).`
        : miseAJour
          ? `La réunion « ${reunion.titre} » (${agenda}) a changé. Voici son horaire et son lieu à jour.`
          : `Vous êtes convoqué·e à la réunion « ${reunion.titre} » (${agenda}).`
    variables.details = [
      `Quand : ${horaireEnClair(reunion.debut, reunion.fin, fuseau)}`,
      ...(reunion.lieu && !retrait ? [`Lieu : ${reunion.lieu}`] : []),
      ...(reunion.lienVisio && !retrait
        ? [`Visio : ${reunion.lienVisio}`]
        : []),
    ]
    variables.consigne =
      job.sorte === 'annulation-reunion'
        ? 'Le fichier joint retire la réunion de votre agenda.'
        : 'Le fichier joint ajoute la réunion à votre agenda. Indiquez si vous serez présente ou présent dans l’espace organisateur : une réponse envoyée depuis votre agenda n’y arrive pas.'
    variables.lienAgenda = lienAgenda
    if (miseAJour) {
      sujet = `${configuration.nomCourt} · ${reunion.activite.nom} : réunion modifiée`
    }
    if (job.sorte === 'annulation-reunion' && !annulee) {
      sujet = `${configuration.nomCourt} · ${reunion.activite.nom} : vous n’êtes plus convoqué·e`
    }
    const expediteur = (await configurationOrganisation()).expediteur
    const adresseOrganisateur =
      configuration.contactRecrutement ??
      /<([^>]+)>/.exec(expediteur)?.[1] ??
      expediteur
    const description = retrait
      ? null
      : [
          reunion.description,
          reunion.lienVisio ? `Visio : ${reunion.lienVisio}` : null,
          `Répondre : ${lienAgenda}`,
        ]
          .filter(Boolean)
          .join('\n\n')
    icalEvent = {
      methode: job.sorte === 'annulation-reunion' ? 'CANCEL' : 'REQUEST',
      contenu: calendrier({
        methode: job.sorte === 'annulation-reunion' ? 'CANCEL' : 'REQUEST',
        maintenant,
        evenements: [
          {
            uid: `reunion-${reunion.id}@${new URL(origine).hostname}`,
            titre: reunion.titre,
            horaire: { debut: reunion.debut, fin: reunion.fin },
            lieu: retrait ? null : reunion.lieu,
            description,
            url: lienAgenda,
            sequence: reunion.sequence,
            annule: job.sorte === 'annulation-reunion',
            modifieLe: reunion.updatedAt,
            organisateur: {
              nom: configuration.nomCourt,
              adresse: adresseOrganisateur,
            },
            participant: { nom: personne.name, adresse: personne.email },
          },
        ],
      }),
    }
    if (job.sorte === 'convocation-reunion' && convocation !== undefined) {
      const envoyee = {
        id: convocation.id,
        userId: job.userId,
        reunionId: reunion.id,
      }
      const { sequence } = reunion
      apresEnvoi = () => concilierApresEnvoi(envoyee, sequence)
    }
  }

  if (job.sorte === 'benevole-lien' || job.sorte === 'benevole-places') {
    if (job.benevoleId === undefined) {
      throw new Error(`Le mail « ${job.sorte} » exige une fiche bénévole.`)
    }
    const fiche = await prisma.benevole.findUnique({
      where: { id: job.benevoleId },
      include: {
        activite: { select: { nom: true } },
        organisation: { select: { fuseauHoraire: true } },
      },
    })
    // Seule une fiche joignable reçoit un mail (ADR 0041).
    if (fiche === null || fiche.courriel === null || !fiche.prevenirParMail) {
      return null
    }
    const confirmee = fiche.courrielConfirmeLe !== null
    // Le mail des places ne part qu'à une adresse confirmée (ADR 0041).
    if (job.sorte === 'benevole-places' && !confirmee) return null
    const maintenant = new Date()
    const places = await placesAVenir(prisma, fiche.id, maintenant)
    if (job.sorte === 'benevole-lien' && places.length === 0) return null
    const fuseau = fiche.organisation.fuseauHoraire
    // Le lien se recalcule à l'envoi : la file n'en porte aucun (invariant 5),
    // et il reste le même d'un mail à l'autre.
    variables.lienEspace = lienEspace(
      origine,
      await jetonEspace(prisma, fiche.id)
    )
    variables.places =
      places.length === 0
        ? ['Vous n’avez plus de place à venir.']
        : places.map(
            p =>
              `${horaireEnClair(p.sequence.debut, p.sequence.fin, fuseau)} · ${p.sequence.titre}` +
              (p.sequence.lieu ? ` (${p.sequence.lieu.nom})` : '') +
              (p.confirmeeLe === null ? ' · à confirmer' : '')
          )
    const activite = fiche.activite.nom
    if (job.sorte === 'benevole-lien' && !confirmee) {
      variables.intitule = 'Votre candidature est retenue'
      variables.intro = `L’équipe d’organisation vous propose les places suivantes pour « ${activite} ».`
      variables.consigne =
        'Confirmez votre participation depuis votre espace. Vous pouvez aussi y décliner une place.'
      variables.libelleBouton = 'Confirmer ma participation'
      variables.avertissement =
        'Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message. Vos données seront supprimées.'
    } else if (job.sorte === 'benevole-lien') {
      variables.intitule = 'Votre espace bénévole'
      variables.intro = `Voici le lien de votre espace bénévole pour « ${activite} ».`
      variables.consigne =
        'Vous y retrouvez vos places, leurs consignes et le fichier pour votre agenda.'
      variables.libelleBouton = 'Ouvrir mon espace'
      variables.avertissement = 'Gardez ce lien : il reste le même.'
    } else {
      variables.intitule = 'Vos places ont changé'
      variables.intro = `L’équipe d’organisation a modifié vos places pour « ${activite} ». Voici la liste à jour.`
      variables.consigne = places.some(p => p.confirmeeLe === null)
        ? 'Confirmez les places marquées « à confirmer » depuis votre espace.'
        : 'Vous retrouvez vos places et leurs consignes dans votre espace.'
      variables.avertissement = 'Votre lien personnel reste le même.'
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
    icalEvent,
  }
}
