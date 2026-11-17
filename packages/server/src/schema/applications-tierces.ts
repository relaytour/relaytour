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
      'Accepte une demande d’autorisation pour l’organisation active. Crée l’autorisation et rend l’adresse de retour de l’application, avec le code. La portée et les activités peuvent réduire la demande, jamais l’étendre.',
    args: {
      id: t.arg.id({ required: true }),
      portee: t.arg({ type: PorteeJetonEnum, required: true }),
      activiteIds: t.arg.idList(),
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
        },
      })
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
