import type { PrismaClient } from '@relaytour/database'

import type { CourrielJobData, SorteCourriel } from '../jobs/queues.ts'
import { CODE_VALIDITE_SECONDES } from '../lib/connexion.ts'
import { concilierApresEnvoi } from '../lib/convocations.ts'
import { adminsAPrevenir, demandesEnAttente } from '../lib/demandes.ts'
import { TACHES_ACTIVES } from '../lib/declinaisons.ts'
import { aujourdhui } from '../lib/droits.ts'
import {
  changementsEquipe,
  activitesADecouvrir,
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
import { i18n, langueCourante } from '../lib/langue.ts'
import {
  LIBELLES_ROLE,
  lienModeDEmploi,
  listeDesModesDEmploi,
  roleDuModeDEmploi,
} from '../lib/modes-d-emploi.ts'
import {
  avecOrganisation,
  composerNotifications,
  grouperParActivite,
  SELECTION_NOTIFICATION,
} from '../lib/composition-notifications.ts'
import {
  adresseDesabonnement,
  jetonDesabonnement,
  type MailDesabonnable,
} from '../lib/desabonnement.ts'
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

/** Le libellé d'un statut de tâche, dans la langue de l'envoi. */
function libelleStatut(statut: string): string | undefined {
  switch (statut) {
    case 'A_FAIRE':
      return i18n._('À faire', {}, { comment: 'Statut d’une tâche' })
    case 'EN_COURS':
      return i18n._('En cours', {}, { comment: 'Statut d’une tâche' })
    case 'FAITE':
      return i18n._('Faite', {}, { comment: 'Statut d’une tâche' })
    case 'ABANDONNEE':
      return i18n._('Abandonnée', {}, { comment: 'Statut d’une tâche' })
    default:
      return undefined
  }
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
    essai: i18n._('Essai d’envoi du serveur Relaytour'),
    invitation: i18n._('{tete} : votre accès à l’espace organisateur', {
      tete,
    }),
    'code-connexion': i18n._('{nomCourt} : votre code de connexion', {
      nomCourt,
    }),
    'tache-modifiee': i18n._('{tete} : une de vos tâches a été modifiée', {
      tete,
    }),
    'rappels-echeance': i18n._('{tete} : échéances de vos tâches', { tete }),
    resume: i18n._('{nomCourt} : votre résumé', { nomCourt }),
    equipe: i18n._('{tete} : votre place dans l’équipe a changé', { tete }),
    demandes: i18n._('{tete} : demandes pour rejoindre l’équipe', { tete }),
    'convocation-reunion': i18n._('{tete} : convocation à une réunion', {
      tete,
    }),
    'annulation-reunion': i18n._('{tete} : réunion annulée', { tete }),
    'benevole-lien': i18n._('{tete} : votre participation', { tete }),
    'benevole-places': i18n._('{tete} : vos places ont changé', { tete }),
  }
}

/** L'activité qu'un sujet nomme : celle de la configuration du mail, s'il y en a une. */
function activiteDuSujet(
  configuration: ConfigurationOrganisation
): string | undefined {
  return (configuration as Partial<ConfigurationActivite>).activite?.nom
}

const SANS_REPONSE = new Set<SorteCourriel>(['essai', 'code-connexion'])

/** L'adresse nue d'un expéditeur « Nom <adresse> ». */
function adresseNue(expediteur: string): string {
  return /<([^>]+)>/.exec(expediteur)?.[1] ?? expediteur
}

/**
 * Où vont les réponses d'un mail (ADR 0053) : le contact de l'activité ou de
 * l'organisation en Reply-To, sauf pour un code de connexion et un essai. Le pied
 * propose de répondre quand une boîte reçoit la réponse : ce contact, sinon
 * l'expéditeur s'il reçoit du courrier.
 */
export function reponsesDuMail(
  configuration: Pick<
    ConfigurationOrganisation,
    'contactRecrutement' | 'expediteurRecoitReponses'
  >,
  sorte: SorteCourriel
): { repondreA: string | undefined; repondre: boolean } {
  const repondreA = SANS_REPONSE.has(sorte)
    ? undefined
    : configuration.contactRecrutement
  return {
    repondreA,
    repondre: repondreA !== undefined || configuration.expediteurRecoitReponses,
  }
}

/**
 * L'adresse de l'organisateur d'une réunion (ADR 0053) : le contact, sinon
 * l'expéditeur s'il reçoit du courrier. Sans l'un ni l'autre, le fichier
 * iCalendar ne nomme pas d'organisateur.
 */
export function adresseOrganisateur(
  configuration: Pick<
    ConfigurationOrganisation,
    'contactRecrutement' | 'expediteur' | 'expediteurRecoitReponses'
  >
): string | undefined {
  return (
    configuration.contactRecrutement ??
    (configuration.expediteurRecoitReponses
      ? adresseNue(configuration.expediteur)
      : undefined)
  )
}

/** La dernière phrase du pied : répondre au mail, ou passer par un espace. */
function consigneReponse(repondre: boolean, sorte: SorteCourriel): string {
  if (repondre) return i18n._('Pour toute question, répondez à ce mail.')
  return sorte === 'benevole-lien' || sorte === 'benevole-places'
    ? i18n._(
        'Cette adresse d’envoi ne reçoit pas de réponse. Pour toute question, adressez-vous à l’équipe d’organisation de l’activité.'
      )
    : i18n._(
        'Cette adresse d’envoi ne reçoit pas de réponse. Pour toute question, contactez l’équipe d’organisation depuis l’espace organisateur.'
      )
}

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
 * La situation d'une personne invitée sans périmètre (ADR 0045) : les activités
 * dont elle découvre les périmètres, sinon l'attente d'une affectation.
 */
export function situationSansPerimetre(
  activites: { nom: string; souhaitsOuverts: boolean }[]
): string {
  const attente = i18n._(
    'En attendant, le mode d’emploi vous aide à découvrir l’espace.'
  )
  if (activites.length === 0) {
    return `${i18n._('Vous n’avez pas encore de périmètre : un admin vous affectera à l’un d’eux.')} ${attente}`
  }
  // Le français sépare les noms par une virgule et « et » devant le dernier.
  const noms = new Intl.ListFormat(langueCourante(), {
    style: 'long',
    type: 'conjunction',
  }).format(activites.map(a => `« ${a.nom} »`))
  // Chaque phrase se traduit en entier ; le mail les range dans l'ordre.
  const equipe = i18n._(
    '{n, plural, one {Vous faites partie de l’équipe de l’activité {noms}, sans périmètre pour l’instant.} other {Vous faites partie de l’équipe des activités {noms}, sans périmètre pour l’instant.}}',
    { n: activites.length, noms }
  )
  const decouverte = activites.some(a => a.souhaitsOuverts)
    ? i18n._(
        'Dans « Tous les périmètres », vous découvrez les périmètres et formulez vos souhaits.'
      )
    : i18n._('Dans « Tous les périmètres », vous découvrez les périmètres.')
  return `${equipe} ${decouverte} ${i18n._('Un admin vous affectera ensuite.')} ${attente}`
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
  // L'adresse de désabonnement en un clic d'un mail désactivable (ADR 0050).
  const lienDesabonnement = async (
    sorte: MailDesabonnable,
    userId: string,
    idOrganisation: string
  ) => {
    if (idOrganisation === '') return undefined
    const { env } = await import('../env.ts')
    return adresseDesabonnement(
      origine,
      jetonDesabonnement(env.BETTER_AUTH_SECRET, {
        sorte,
        userId,
        organisationId: idOrganisation,
      })
    )
  }

  if (job.sorte === 'invitation') {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: job.userId },
      select: { id: true, name: true },
    })
    variables.nom = user.name
    variables.lienConnexion = lienVers('/connexion')
    variables.accroche = i18n._(
      'L’équipe d’organisation vous a ouvert un accès à l’espace organisateur. Vous y retrouverez vos périmètres, vos tâches et les fiches méthode des éditions précédentes.'
    )
    // Le rôle se lit à l'envoi : une invitation renvoyée après une nomination
    // lie le mode d'emploi du nouveau rôle.
    const role = await roleDuModeDEmploi(
      prisma,
      user.id,
      organisationId ?? configuration.id
    )
    const { env } = await import('../env.ts')
    variables.roleModeDEmploi = LIBELLES_ROLE[role]
    variables.lienModeDEmploi = lienModeDEmploi(
      listeDesModesDEmploi(env, langueCourante()),
      role
    )
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
      const tete =
        activite === undefined
          ? configuration.nomCourt
          : `${configuration.nomCourt} · ${activite}`
      sujet = i18n._('{tete} : invitation à rejoindre l’espace organisateur', {
        tete,
      })
      variables.accroche = i18n._(
        '{nomCourt} vous invite à rejoindre son espace organisateur. Vous avez déjà un compte à cette adresse : après connexion, vous acceptez ou refusez cette invitation depuis le menu de votre compte. Rien n’est partagé avec cette organisation avant votre accord.',
        { nomCourt: configuration.nomCourt }
      )
      variables.perimetres = attente.perimetres
      // La personne n'a encore aucun rôle dans l'organisation : le mode d'emploi
      // lié est celui du rôle que l'invitation propose.
      const propose =
        attente.role === 'ADMIN' ? 'admin-organisation' : 'referent'
      variables.roleModeDEmploi = LIBELLES_ROLE[propose]
      variables.lienModeDEmploi = lienModeDEmploi(
        listeDesModesDEmploi(env, langueCourante()),
        propose
      )
    }
    variables.situation =
      attente !== 'membre'
        ? attente.perimetres.length > 0
          ? i18n._('L’invitation vous propose ces périmètres :')
          : i18n._(
              'Vous choisirez vos périmètres avec l’équipe après votre accord.'
            )
        : perimetres.length > 0
          ? i18n._('Vous faites partie de l’équipe de ces périmètres :')
          : situationSansPerimetre(
              idOrganisation === null
                ? []
                : await activitesADecouvrir(prisma, user.id, idOrganisation)
            )
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
    variables.lienModeDEmploi = lienModeDEmploi(
      listeDesModesDEmploi(env, langueCourante()),
      role
    )
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
    variables.annonce = i18n._(
      '{n, plural, one {Une demande pour rejoindre l’équipe de l’activité {activite} attend votre décision.} other {# demandes pour rejoindre l’équipe de l’activité {activite} attendent votre décision.}}',
      { n: nombre, activite: activite.nom }
    )
    variables.lienDemandes = lienVers(
      `/${activite.slug}/admin/personnes?onglet=demandes`
    )
    variables.lienPreferences = lienPreferences
    desabonnement = await lienDesabonnement(
      'demandes',
      userId,
      activite.organisationId
    )
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
    // Une durée, insérée dans « Il est valable {validite}. » du gabarit.
    variables.validite = i18n._(
      '{n, plural, one {# minute} other {# minutes}}',
      { n: CODE_VALIDITE_SECONDES / 60 }
    )
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
        ? { name: i18n._('Une autre personne') }
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
        ? i18n._('Le nouveau statut de la tâche est « {statut} ».', {
            statut: libelleStatut(tache.statut),
          })
        : i18n._(
            'Le titre, la description ou l’échéance de la tâche ont changé.'
          )
    // Les pages d'un périmètre vivent sous le slug de son activité (ADR 0008).
    variables.lienPerimetre = lienVers(
      `/${tache.perimetre.activite.slug}/perimetres/${tache.perimetre.slug}`
    )
    variables.lienPreferences = lienPreferences
    if (job.userId) {
      desabonnement = await lienDesabonnement(
        'tache-modifiee',
        job.userId,
        organisationDesPreferences
      )
    }
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
    desabonnement = await lienDesabonnement(
      'rappels-echeance',
      userId,
      organisationDesPreferences
    )
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
    variables.introduction =
      preferences.frequenceResume === 'QUOTIDIEN'
        ? i18n._('Voici les nouvelles de vos périmètres depuis hier.')
        : i18n._('Voici les nouvelles de vos périmètres de la semaine.')
    // Les nouvelles se rangent par activité, puis viennent celles des rôles
    // d'admin, sous un intertitre qui le dit (ADR 0032 et 0033).
    const groupes = [
      ...grouperParActivite(composees, configuration.nomCourt),
      ...grouperParActivite(
        composeesAdmin,
        configuration.nomCourt,
        `${i18n._('Pour vos rôles d’admin')} · `
      ),
    ]
    variables.nouvelles =
      groupes.length > 0 ? groupes : [i18n._('Aucune nouvelle.')]
    // Les échéances se rangent aussi par activité.
    const parActivite = new Map<string, { titre: string; elements: string[] }>()
    for (const t of taches) {
      const date = t.echeance!.toLocaleDateString(langueCourante(), {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
      const valeurs = { date, titre: t.titre, perimetre: t.perimetre.nom }
      const groupe = parActivite.get(t.perimetre.activite.id) ?? {
        titre: t.perimetre.activite.nom,
        elements: [],
      }
      groupe.elements.push(
        t.echeance! < jour
          ? i18n._('{date} : {titre} ({perimetre}) (en retard)', valeurs)
          : i18n._('{date} : {titre} ({perimetre})', valeurs)
      )
      parActivite.set(t.perimetre.activite.id, groupe)
    }
    variables.echeances =
      parActivite.size > 0
        ? [...parActivite.values()]
        : [i18n._('Aucune échéance.')]
    variables.lienConnexion = lienVers('/')
    variables.lienPreferences = lienPreferences
    desabonnement = await lienDesabonnement('resume', userId, idOrganisation)
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
      reunion.perimetre?.nom ??
      i18n._('l’agenda de {activite}', { activite: reunion.activite.nom })
    const titre = reunion.titre
    const teteReunion = `${configuration.nomCourt} · ${reunion.activite.nom}`
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
          ? i18n._('Réunion annulée')
          : i18n._('Vous n’êtes plus convoqué·e')
        : miseAJour
          ? i18n._('Réunion modifiée')
          : i18n._('Convocation à une réunion')
    variables.intro =
      job.sorte === 'annulation-reunion'
        ? annulee
          ? i18n._('La réunion « {titre} » ({agenda}) est annulée.', {
              titre,
              agenda,
            })
          : i18n._(
              'Vous ne faites plus partie des personnes convoquées à la réunion « {titre} » ({agenda}).',
              { titre, agenda }
            )
        : miseAJour
          ? i18n._(
              'La réunion « {titre} » ({agenda}) a changé. Voici son horaire et son lieu à jour.',
              { titre, agenda }
            )
          : i18n._(
              'Vous êtes convoqué·e à la réunion « {titre} » ({agenda}).',
              {
                titre,
                agenda,
              }
            )
    variables.details = [
      i18n._('Quand : {horaire}', {
        horaire: horaireEnClair(reunion.debut, reunion.fin, fuseau),
      }),
      ...(reunion.lieu && !retrait
        ? [i18n._('Lieu : {lieu}', { lieu: reunion.lieu })]
        : []),
      ...(reunion.lienVisio && !retrait
        ? [i18n._('Visio : {lien}', { lien: reunion.lienVisio })]
        : []),
    ]
    variables.consigne =
      job.sorte === 'annulation-reunion'
        ? i18n._('Le fichier joint retire la réunion de votre agenda.')
        : i18n._(
            'Le fichier joint ajoute la réunion à votre agenda. Indiquez si vous serez présente ou présent dans l’espace organisateur : une réponse envoyée depuis votre agenda n’y arrive pas.'
          )
    variables.lienAgenda = lienAgenda
    if (miseAJour) {
      sujet = i18n._('{tete} : réunion modifiée', { tete: teteReunion })
    }
    if (job.sorte === 'annulation-reunion' && !annulee) {
      sujet = i18n._('{tete} : vous n’êtes plus convoqué·e', {
        tete: teteReunion,
      })
    }
    const organisateur = adresseOrganisateur(configuration)
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
            organisateur:
              organisateur === undefined
                ? undefined
                : { nom: configuration.nomCourt, adresse: organisateur },
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
    // La marque d'une place que la personne doit confirmer : la liste et la
    // consigne la citent de la même façon.
    const aConfirmer = i18n._(
      'à confirmer',
      {},
      { comment: 'Marque d’une place que la personne doit encore confirmer' }
    )
    variables.places =
      places.length === 0
        ? [i18n._('Vous n’avez plus de place à venir.')]
        : places.map(p => {
            const valeurs = {
              horaire: horaireEnClair(p.sequence.debut, p.sequence.fin, fuseau),
              titre: p.sequence.titre,
              lieu: p.sequence.lieu?.nom ?? '',
              aConfirmer,
            }
            if (p.sequence.lieu) {
              return p.confirmeeLe === null
                ? i18n._('{horaire} · {titre} ({lieu}) · {aConfirmer}', valeurs)
                : i18n._('{horaire} · {titre} ({lieu})', valeurs)
            }
            return p.confirmeeLe === null
              ? i18n._('{horaire} · {titre} · {aConfirmer}', valeurs)
              : i18n._('{horaire} · {titre}', valeurs)
          })
    const activite = fiche.activite.nom
    if (job.sorte === 'benevole-lien' && !confirmee) {
      variables.intitule = i18n._('Votre candidature est retenue')
      variables.intro = i18n._(
        'L’équipe d’organisation vous propose les places suivantes pour « {activite} ».',
        { activite }
      )
      variables.consigne = i18n._(
        'Confirmez votre participation depuis votre espace. Vous pouvez aussi y décliner une place.'
      )
      variables.libelleBouton = i18n._('Confirmer ma participation')
      variables.avertissement = i18n._(
        'Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message. Vos données seront supprimées.'
      )
    } else if (job.sorte === 'benevole-lien') {
      variables.intitule = i18n._('Votre espace bénévole')
      variables.intro = i18n._(
        'Voici le lien de votre espace bénévole pour « {activite} ».',
        { activite }
      )
      variables.consigne = i18n._(
        'Vous y retrouvez vos places, leurs consignes et le fichier pour votre agenda.'
      )
      variables.libelleBouton = i18n._('Ouvrir mon espace')
      variables.avertissement = i18n._('Gardez ce lien : il reste le même.')
    } else {
      variables.intitule = i18n._('Vos places ont changé')
      variables.intro = i18n._(
        'L’équipe d’organisation a modifié vos places pour « {activite} ». Voici la liste à jour.',
        { activite }
      )
      variables.consigne = places.some(p => p.confirmeeLe === null)
        ? i18n._(
            'Confirmez les places marquées « {aConfirmer} » depuis votre espace.',
            {
              aConfirmer,
            }
          )
        : i18n._(
            'Vous retrouvez vos places et leurs consignes dans votre espace.'
          )
      variables.avertissement = i18n._('Votre lien personnel reste le même.')
    }
  }

  const { repondreA, repondre } = reponsesDuMail(configuration, job.sorte)
  const { html, texte } = rendre(job.sorte, variables, {
    ...variablesOrganisation(configuration),
    consigneReponse: consigneReponse(repondre, job.sorte),
  })
  return {
    sujet:
      sujet ??
      sujets(configuration.nomCourt, activiteDuSujet(configuration))[job.sorte],
    html,
    texte,
    desabonnement,
    repondreA,
    apresEnvoi,
    icalEvent,
  }
}
