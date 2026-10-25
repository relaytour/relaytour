import type { AppContext } from '../context.ts'
import {
  ETAPES,
  etatPremiersPas,
  reglerPremiersPas,
  type PremiersPas,
} from '../lib/premiers-pas.ts'

import { builder } from './builder.ts'

// Liste « Premiers pas » de Mon espace (ADR 0048), réservée aux admins de
// l'activité. Sans `activiteId`, l'activité de la requête.

const EtapePremiersPasEnum = builder.enumType('EtapePremiersPas', {
  values: ETAPES,
})

const EtatEtapeRef = builder
  .objectRef<PremiersPas['etapes'][number]>('EtatEtapePremiersPas')
  .implement({
    fields: t => ({
      etape: t.expose('etape', { type: EtapePremiersPasEnum }),
      faite: t.exposeBoolean('faite'),
    }),
  })

const PremiersPasRef = builder.objectRef<PremiersPas>('PremiersPas').implement({
  description:
    'Les étapes qui mènent une activité vide à une période prête : la décrire, créer la première période, les périmètres et les tâches, inviter l’équipe.',
  fields: t => ({
    etapes: t.field({ type: [EtatEtapeRef], resolve: p => p.etapes }),
    masques: t.exposeBoolean('masques', {
      description: 'Un admin a masqué la liste pour toute l’activité.',
    }),
    termines: t.exposeBoolean('termines', {
      description: 'Toutes les étapes sont faites.',
    }),
  }),
})

async function activiteAdministree(
  ctx: AppContext,
  activiteId: string | number | null | undefined
): Promise<string> {
  const id = await ctx.exigerActivite(activiteId)
  await ctx.exigerAdminDe(id)
  return id
}

builder.queryFields(t => ({
  premiersPas: t.field({
    type: PremiersPasRef,
    authScopes: { gestion: true },
    args: { activiteId: t.arg.id() },
    resolve: async (_root, { activiteId }, ctx) =>
      etatPremiersPas(
        await activiteAdministree(ctx, activiteId),
        ctx.personne!.id
      ),
  }),
}))

builder.mutationFields(t => ({
  confirmerActivite: t.field({
    type: PremiersPasRef,
    authScopes: { gestion: true },
    description:
      'Coche l’étape « Décrire l’activité » : un admin confirme le nom, la nature et les groupes.',
    args: { activiteId: t.arg.id() },
    resolve: async (_root, { activiteId }, ctx) => {
      const id = await activiteAdministree(ctx, activiteId)
      await reglerPremiersPas(id, r => ({
        ...r,
        activiteConfirmeeLe: r.activiteConfirmeeLe ?? new Date().toISOString(),
      }))
      return etatPremiersPas(id, ctx.personne!.id)
    },
  }),

  masquerPremiersPas: t.field({
    type: PremiersPasRef,
    authScopes: { gestion: true },
    description: 'Masque la liste « Premiers pas » pour toute l’activité.',
    args: { activiteId: t.arg.id() },
    resolve: async (_root, { activiteId }, ctx) => {
      const id = await activiteAdministree(ctx, activiteId)
      await reglerPremiersPas(id, r => ({
        ...r,
        masqueeLe: new Date().toISOString(),
      }))
      return etatPremiersPas(id, ctx.personne!.id)
    },
  }),

  afficherPremiersPas: t.field({
    type: PremiersPasRef,
    authScopes: { gestion: true },
    description: 'Affiche de nouveau la liste « Premiers pas » de l’activité.',
    args: { activiteId: t.arg.id() },
    resolve: async (_root, { activiteId }, ctx) => {
      const id = await activiteAdministree(ctx, activiteId)
      await reglerPremiersPas(id, r => ({
        activiteConfirmeeLe: r.activiteConfirmeeLe,
      }))
      return etatPremiersPas(id, ctx.personne!.id)
    },
  }),
}))
