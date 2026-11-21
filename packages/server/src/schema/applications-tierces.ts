import { randomBytes } from 'node:crypto'

import {
  prisma,
  type ClientApplication,
  type DemandeAutorisation,
} from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'
import { apiInactive, erreurSaisie } from '../lib/erreurs.ts'
import {
  apiOuverte,
  applicationRefuseeParLOrganisation,
  causeFermeture,
  empreinteJetonAcces,
  etatApi,
  nouveauJetonAcces,
} from '../lib/jetons-acces.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'
import {
  AUTORISATIONS_ACTIVES_MAX,
  DUREE_AUTORISATION_JOURS,
  DUREE_CODE_S,
  empreinte,
  nouveauCode,
} from '../oauth/jetons.ts'
import { ADRESSE_MAX } from '../oauth/clients.ts'
import { adresseDeRetour } from '../oauth/metadonnees.ts'
import { applicationRefusee } from '../oauth/refus.ts'

import { ApplicationTierceRef, hoteDe } from './application-tierce.ts'
import { builder } from './builder.ts'
import {
  activitesChoisies,
  JetonAccesRef,
  PorteeJetonEnum,
} from './jetons-acces.ts'

// Consentement et autorisations d'applications tierces (ADR 0067).
//
// /oauth/autoriser garde la demande, puis renvoie le navigateur vers l'écran de
// consentement de l'espace organisateur. Cet écran lit la demande, puis la personne
// l'accepte ou la refuse avec sa session. L'accord crée une autorisation (une ligne
// JetonAcces liée au client) et un code de 60 secondes, et rend l'adresse de retour
// que le navigateur suit. Rien n'est implicite : chaque demande passe par cet écran.

type DemandeLue = DemandeAutorisation & { clientApplication: ClientApplication }

async function demandeOuverte(
  id: string,
  maintenant = new Date()
): Promise<DemandeLue | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return null
  const demande = await prisma.demandeAutorisation.findUnique({
    where: { id },
    include: { clientApplication: true },
  })
  if (
    demande === null ||
    demande.reponduLe !== null ||
    demande.expireLe.getTime() <= maintenant.getTime()
  ) {
    return null
  }
  return demande
}

const demandeExpiree = () =>
  erreurSaisie(
    i18n._(
      'Cette demande d’autorisation n’est plus valable. Recommencez depuis l’application.'
    )
  )

const DemandeAutorisationRef = builder
  .objectRef<DemandeLue>('DemandeAutorisation')
  .implement({
    description:
      'Une demande d’accès d’une application tierce, en attente de la réponse de la personne connectée.',
    fields: t => ({
      id: t.exposeID('id'),
      application: t.field({
        type: ApplicationTierceRef,
        resolve: d => d.clientApplication,
      }),
      hoteRetour: t.string({
        description:
          'L’hôte vers lequel le navigateur revient après la réponse : il reçoit le code.',
        resolve: d => hoteDe(d.redirectUri),
      }),
      ecritureDemandee: t.boolean({
        description:
          'Vrai quand l’application demande aussi l’écriture. La personne peut la limiter à la lecture.',
        resolve: d => d.portees.split(' ').includes('ecriture'),
      }),
      lectureDocumentsDemandee: t.boolean({
        description:
          'Vrai quand l’application demande aussi la lecture du texte des documents (portée `documents`, ADR 0072). La personne décide : la case reste décochée par défaut.',
        resolve: d => d.portees.split(' ').includes('documents'),
      }),
      expireLe: t.expose('expireLe', { type: 'DateTime' }),
    }),
  })

builder.queryFields(t => ({
  demandeAutorisation: t.field({
    type: DemandeAutorisationRef,
    nullable: true,
    authScopes: { authentifie: true },
    description:
      'Une demande d’autorisation en attente. Nulle quand elle est inconnue, expirée ou déjà traitée.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, args) => demandeOuverte(String(args.id)),
  }),

  mesAutorisationsApplications: t.field({
    type: [JetonAccesRef],
    authScopes: { $all: { connecte: true, session: true } },
    description:
      'Les applications tierces que la personne a autorisées dans l’organisation active : les autorisations actives, puis celles révoquées ou expirées depuis moins de 30 jours. `revoquerJetonAcces` en révoque une.',
    resolve: (_root, _args, ctx) => {
      const recents = new Date(Date.now() - 30 * 86_400_000)
      return prisma.jetonAcces.findMany({
        where: {
          organisationId: ctx.organisation!.id,
          userId: ctx.personne!.id,
          clientApplicationId: { not: null },
          OR: [
            { revoqueLe: null, expireLe: { gt: recents } },
            { revoqueLe: { gt: recents } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 50,
      })
    },
  }),
}))

builder.mutationFields(t => ({
  refuserDemandeAutorisation: t.string({
    authScopes: { authentifie: true },
    // Un refus n'écrit rien dans une organisation.
    skipTypeScopes: true,
    description:
      'Refuse une demande d’autorisation. Rend l’adresse de retour de l’application, avec `error=access_denied`.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args) => {
      const demande = await demandeOuverte(String(args.id))
      if (demande === null) throw demandeExpiree()
      const { count } = await prisma.demandeAutorisation.updateMany({
        where: { id: demande.id, reponduLe: null },
        data: { reponduLe: new Date() },
      })
      if (count === 0) throw demandeExpiree()
      return adresseDeRetour(demande.redirectUri, {
        error: 'access_denied',
        state: demande.state,
      })
    },
  }),

  accorderDemandeAutorisation: t.string({
    authScopes: { $all: { connecte: true, session: true } },
    // Une organisation en lecture seule permet d'autoriser une application, pour
    // lire et exporter, comme un jeton d'accès.
    skipTypeScopes: true,
    description:
      'Accepte une demande d’autorisation pour l’organisation active. Crée l’autorisation et rend l’adresse de retour de l’application, avec le code. La portée, la lecture des documents et les activités peuvent réduire la demande, jamais l’étendre.',
    args: {
      id: t.arg.id({ required: true }),
      portee: t.arg({ type: PorteeJetonEnum, required: true }),
      activiteIds: t.arg.idList(),
      lectureDocuments: t.arg.boolean({
        description:
          'Accorde la lecture du texte des documents (ADR 0072), si l’application l’a demandée. Faux par défaut.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const maintenant = new Date()
      const demande = await demandeOuverte(String(args.id), maintenant)
      if (demande === null) throw demandeExpiree()
      const client = demande.clientApplication
      if (
        args.portee === 'LECTURE_ECRITURE' &&
        !demande.portees.split(' ').includes('ecriture')
      ) {
        throw erreurSaisie(i18n._('L’application n’a demandé que la lecture.'))
      }
      const lectureDocuments = args.lectureDocuments ?? false
      if (
        lectureDocuments &&
        !demande.portees.split(' ').includes('documents')
      ) {
        throw erreurSaisie(
          i18n._(
            'L’application n’a pas demandé la lecture du texte des documents.'
          )
        )
      }
      if (applicationRefusee(client.clientId)) {
        throw erreurSaisie(
          i18n._('Cette installation n’accepte pas cette application.')
        )
      }
      const organisationId = ctx.organisation!.id
      const reglage = await prisma.organisation.findUniqueOrThrow({
        where: { id: organisationId },
        select: {
          apiActivee: true,
          apiAutorisee: true,
          apiImposee: true,
          apiSuspendueLe: true,
          apiSuspensionMotif: true,
          applicationsAutorisees: true,
        },
      })
      if (
        !reglage.applicationsAutorisees ||
        (await applicationRefuseeParLOrganisation(
          organisationId,
          client.clientId
        ))
      ) {
        throw erreurSaisie(
          i18n._('Cette organisation n’accepte pas cette application.')
        )
      }
      if (!apiOuverte(reglage)) {
        const cause = causeFermeture(etatApi(reglage))
        throw apiInactive(
          cause,
          cause === 'suspendue' ? reglage.apiSuspensionMotif : null
        )
      }
      const activiteIds = await activitesChoisies(ctx, args.activiteIds)
      const userId = ctx.personne!.id
      const code = nouveauCode()
      const autorisation = await sousVerrouOrganisation(
        organisationId,
        async tx => {
          // La demande se prend d'abord : deux réponses simultanées n'en créent
          // qu'une.
          const prise = await tx.demandeAutorisation.updateMany({
            where: { id: demande.id, reponduLe: null },
            data: { reponduLe: maintenant },
          })
          if (prise.count === 0) throw demandeExpiree()
          // Une nouvelle autorisation du même client remplace la précédente.
          await tx.jetonAcces.updateMany({
            where: {
              organisationId,
              userId,
              clientApplicationId: client.id,
              revoqueLe: null,
            },
            data: { revoqueLe: maintenant },
          })
          const actives = await tx.jetonAcces.count({
            where: {
              organisationId,
              userId,
              clientApplicationId: { not: null },
              revoqueLe: null,
              expireLe: { gt: maintenant },
            },
          })
          if (actives >= AUTORISATIONS_ACTIVES_MAX) {
            throw erreurSaisie(
              i18n._(
                'Vous avez déjà autorisé {max} applications dans cette organisation : révoquez-en une avant d’en autoriser une autre.',
                { max: AUTORISATIONS_ACTIVES_MAX }
              )
            )
          }
          // L'autorisation n'a pas de valeur utilisable : son empreinte est celle
          // d'un jeton tiré puis oublié.
          const ligne = await tx.jetonAcces.create({
            data: {
              organisationId,
              userId,
              creeParId: userId,
              nom: client.nom,
              empreinte: empreinteJetonAcces(nouveauJetonAcces()),
              apercu: randomBytes(6).toString('base64url'),
              portee: args.portee,
              activiteIds: activiteIds ?? undefined,
              expireLe: new Date(
                maintenant.getTime() + DUREE_AUTORISATION_JOURS * 86_400_000
              ),
              gestionMembres: false,
              lectureDocuments,
              clientApplicationId: client.id,
            },
          })
          await tx.demandeAutorisation.update({
            where: { id: demande.id },
            data: {
              jetonAccesId: ligne.id,
              codeEmpreinte: empreinte(code),
              codeExpireLe: new Date(
                maintenant.getTime() + DUREE_CODE_S * 1000
              ),
            },
          })
          return ligne
        }
      )
      journal.info(
        {
          evenement: 'autorisation-application-accordee',
          jetonAccesId: autorisation.id,
          clientApplicationId: client.id,
          organisationId,
          userId,
          portee: autorisation.portee,
          lectureDocuments: autorisation.lectureDocuments,
        },
        'Une application tierce a été autorisée.'
      )
      // La personne apprend l'autorisation par mail, avec un lien de révocation : une
      // session volée ne crée pas un accès en silence.
      await mettreEnFile(
        'application-autorisee',
        { userId },
        { organisationId, jetonAccesId: autorisation.id }
      )
      return adresseDeRetour(demande.redirectUri, {
        code,
        state: demande.state,
      })
    },
  }),
}))

// Refus d'une application par les admins d'une organisation (ADR 0067). Le refus
// révoque ses autorisations dans l'organisation, prévient leurs porteuses, et
// bloque les nouvelles demandes. Il se lève par `autoriserApplicationOrganisation`.

interface ApplicationRefuseeLue {
  clientId: string
  createdAt: Date
  par: { name: string } | null
  nom: string | null
}

const ApplicationRefuseeRef = builder
  .objectRef<ApplicationRefuseeLue>('ApplicationRefusee')
  .implement({
    description:
      'Une application tierce refusée par un admin de l’organisation active.',
    fields: t => ({
      clientId: t.exposeString('clientId'),
      nom: t.exposeString('nom', {
        nullable: true,
        description:
          'Le nom que l’application déclare. Nul quand l’installation ne la connaît pas.',
      }),
      hote: t.string({ resolve: a => hoteDe(a.clientId) }),
      refuseeLe: t.expose('createdAt', { type: 'DateTime' }),
      refuseePar: t.string({
        nullable: true,
        resolve: a => a.par?.name ?? null,
      }),
    }),
  })

/** Applications refusées par une organisation, au plus : la liste les rend toutes. */
const REFUS_MAX = 200

/** Un identifiant d'application tel qu'un admin le saisit. */
function clientIdSaisi(brut: string): string {
  const clientId = brut.trim()
  if (clientId.length === 0 || clientId.length > ADRESSE_MAX) {
    throw erreurSaisie(
      i18n._('Indiquez l’identifiant de l’application, 512 caractères au plus.')
    )
  }
  return clientId
}

builder.queryFields(t => ({
  applicationsRefuseesOrganisation: t.field({
    type: [ApplicationRefuseeRef],
    authScopes: { $all: { admin: true, session: true } },
    description:
      'Les applications tierces que les admins de l’organisation active ont refusées.',
    resolve: async (_root, _args, ctx) => {
      const refus = await prisma.applicationRefusee.findMany({
        where: { organisationId: ctx.organisation!.id },
        include: { par: { select: { name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: REFUS_MAX,
      })
      const clients = await prisma.clientApplication.findMany({
        where: { clientId: { in: refus.map(r => r.clientId) } },
        select: { clientId: true, nom: true },
      })
      return refus.map(r => ({
        clientId: r.clientId,
        createdAt: r.createdAt,
        par: r.par,
        nom: clients.find(c => c.clientId === r.clientId)?.nom ?? null,
      }))
    },
  }),
}))

builder.mutationFields(t => ({
  refuserApplicationOrganisation: t.int({
    authScopes: { $all: { admin: true, session: true } },
    // Une application indésirable se refuse même dans une organisation en lecture seule.
    skipTypeScopes: true,
    description:
      'Refuse une application tierce pour l’organisation active. Révoque ses autorisations, dont les porteuses l’apprennent par mail, et rend leur nombre.',
    args: { clientId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const parId = ctx.personne!.id
      const clientId = clientIdSaisi(args.clientId)
      const maintenant = new Date()
      const revoquees = await sousVerrouOrganisation(
        organisationId,
        async tx => {
          const deja = await tx.applicationRefusee.findUnique({
            where: { organisationId_clientId: { organisationId, clientId } },
            select: { id: true },
          })
          if (
            deja === null &&
            (await tx.applicationRefusee.count({
              where: { organisationId },
            })) >= REFUS_MAX
          ) {
            throw erreurSaisie(
              i18n._(
                'Cette organisation refuse déjà {max} applications : levez un refus avant d’en ajouter un.',
                { max: REFUS_MAX }
              )
            )
          }
          await tx.applicationRefusee.upsert({
            where: { organisationId_clientId: { organisationId, clientId } },
            create: { organisationId, clientId, parId },
            update: {},
          })
          const cibles = await tx.jetonAcces.findMany({
            where: {
              organisationId,
              revoqueLe: null,
              clientApplication: { clientId },
            },
            select: { id: true, userId: true },
          })
          await tx.jetonAcces.updateMany({
            where: { id: { in: cibles.map(c => c.id) } },
            data: { revoqueLe: maintenant, revoqueParId: parId },
          })
          return cibles
        }
      )
      journal.info(
        {
          evenement: 'application-refusee-par-organisation',
          organisationId,
          par: parId,
          autorisationsRevoquees: revoquees.length,
        },
        'Un admin de l’organisation a refusé une application tierce.'
      )
      for (const r of revoquees) {
        if (r.userId === parId) continue
        await mettreEnFile(
          'jeton-revoque',
          { userId: r.userId },
          { organisationId, jetonAccesId: r.id }
        )
      }
      return revoquees.length
    },
  }),

  autoriserApplicationOrganisation: t.boolean({
    authScopes: { $all: { admin: true, session: true } },
    skipTypeScopes: true,
    description:
      'Lève le refus d’une application tierce dans l’organisation active. Les autorisations révoquées ne reviennent pas. Rend faux quand l’application n’était pas refusée.',
    args: { clientId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { count } = await prisma.applicationRefusee.deleteMany({
        where: {
          organisationId: ctx.organisation!.id,
          clientId: clientIdSaisi(args.clientId),
        },
      })
      if (count > 0) {
        journal.info(
          {
            evenement: 'application-autorisee-par-organisation',
            organisationId: ctx.organisation!.id,
            par: ctx.personne!.id,
          },
          'Un admin de l’organisation a levé le refus d’une application tierce.'
        )
      }
      return count > 0
    },
  }),
}))
