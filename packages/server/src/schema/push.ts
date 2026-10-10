import { prisma } from '@relaytour/database'

import { erreurSaisie } from '../lib/erreurs.ts'
import {
  ABONNEMENTS_MAX,
  adressePushAcceptee,
  clePushValide,
  empreinteAdresse,
  libelleAppareil,
} from '../lib/push.ts'

import { builder } from './builder.ts'

// Notifications push (ADR 0024). Une personne ne crée et ne retire que ses propres
// abonnements : chaque écriture filtre sur l'identifiant de la session. Le schéma
// n'importe pas `env.ts` au chargement (invariant 12) : la clé se lit à la demande.

builder.queryFields(t => ({
  clePubliquePush: t.string({
    nullable: true,
    description:
      'Clé publique VAPID de l’installation, dont un navigateur a besoin pour s’abonner aux notifications push. Null quand le canal est fermé. Lisible sans session.',
    resolve: async () => {
      const [{ env }, { clesVapid }] = await Promise.all([
        import('../env.ts'),
        import('../lib/push.ts'),
      ])
      return clesVapid(env)?.publique ?? null
    },
  }),

  abonnePush: t.boolean({
    authScopes: { connecte: true },
    description:
      'Vrai quand cet abonnement, désigné par son adresse, est enregistré pour la personne connectée.',
    args: { adresse: t.arg.string({ required: true }) },
    resolve: async (_root, { adresse }, ctx) =>
      (await prisma.abonnementPush.count({
        where: {
          userId: ctx.personne!.id,
          empreinte: empreinteAdresse(adresse),
        },
      })) > 0,
  }),
}))

builder.mutationFields(t => ({
  abonnerPush: t.boolean({
    authScopes: { connecte: true },
    // Un abonnement appartient à la personne, pas à l'organisation : une
    // organisation en lecture seule le permet, comme la lecture des notifications.
    skipTypeScopes: true,
    description:
      'Enregistre l’abonnement push de cet appareil pour la personne connectée. Reste possible dans une organisation en lecture seule.',
    args: {
      adresse: t.arg.string({ required: true }),
      p256dh: t.arg.string({ required: true }),
      auth: t.arg.string({ required: true }),
      agent: t.arg.string({
        description:
          'Agent de navigation, dont le serveur tire un libellé d’appareil.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const [{ env }, { clesVapid }] = await Promise.all([
        import('../env.ts'),
        import('../lib/push.ts'),
      ])
      if (clesVapid(env) === null)
        throw erreurSaisie(
          'Les notifications push ne sont pas activées sur cette installation.'
        )
      if (!adressePushAcceptee(args.adresse))
        throw erreurSaisie(
          'Cet abonnement ne vient pas d’un service de push reconnu.'
        )
      if (!clePushValide(args.p256dh) || !clePushValide(args.auth))
        throw erreurSaisie('Les clés de cet abonnement sont invalides.')
      const userId = ctx.personne!.id
      const empreinte = empreinteAdresse(args.adresse)
      const donnees = {
        adresse: args.adresse,
        p256dh: args.p256dh,
        auth: args.auth,
        appareil: libelleAppareil(args.agent?.slice(0, 400)),
      }
      // Un appareil ne sert qu'un compte : l'abonnement qu'un autre compte y avait
      // laissé (session expirée, compte archivé) est retiré. Sans cela, l'appareil
      // continuerait de recevoir les notifications du compte précédent.
      await prisma.abonnementPush.deleteMany({
        where: { empreinte, userId: { not: userId } },
      })
      await prisma.abonnementPush.upsert({
        where: { userId_empreinte: { userId, empreinte } },
        update: donnees,
        create: { userId, empreinte, ...donnees },
      })
      // Au-delà du plafond, les abonnements les plus anciens sont retirés.
      const anciens = await prisma.abonnementPush.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip: ABONNEMENTS_MAX,
        select: { id: true },
      })
      if (anciens.length > 0)
        await prisma.abonnementPush.deleteMany({
          where: { id: { in: anciens.map(a => a.id) } },
        })
      return true
    },
  }),

  desabonnerPush: t.boolean({
    authScopes: { connecte: true },
    skipTypeScopes: true,
    description:
      'Retire l’abonnement push de cet appareil. Rend vrai quand un abonnement de la personne connectée a été retiré.',
    args: { adresse: t.arg.string({ required: true }) },
    resolve: async (_root, { adresse }, ctx) => {
      const { count } = await prisma.abonnementPush.deleteMany({
        where: {
          userId: ctx.personne!.id,
          empreinte: empreinteAdresse(adresse),
        },
      })
      return count > 0
    },
  }),
}))
