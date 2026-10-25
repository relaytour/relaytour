import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import {
  importerEquipeDuTableur,
  type LigneEquipe,
  type RapportImportEquipe,
} from '../lib/import-equipe-tableur.ts'
import { i18n } from '../lib/langue.ts'

import { builder } from './builder.ts'
import { LIGNES_PAR_LOT, LigneImportRef } from './import-commun.ts'

// Import de l'équipe d'une période depuis un tableur (ADR 0049), réservé aux admins
// de l'activité. Aucun mail ne part sans `envoyerMails`. La simulation n'écrit rien.

const LigneEquipeInput = builder.inputType('LigneEquipeImport', {
  fields: t => ({
    ligne: t.int({ required: true }),
    nom: t.string({ required: true }),
    adresse: t.string({ required: true }),
    perimetres: t.stringList({
      required: true,
      description: 'Les noms ou les identifiants des périmètres.',
    }),
    contactPrincipal: t.boolean({ required: true }),
  }),
})

const RapportImportEquipeRef = builder
  .objectRef<RapportImportEquipe>('RapportImportEquipe')
  .implement({
    description:
      'Ce que l’import de l’équipe fait, ou ferait. Les nombres ne distinguent pas une personne nouvelle d’une personne déjà membre (ADR 0018).',
    fields: t => ({
      lignes: t.field({ type: [LigneImportRef], resolve: r => r.lignes }),
      personnes: t.exposeInt('personnes'),
      invitationsEnAttente: t.exposeInt('invitationsEnAttente'),
      affectationsCreees: t.exposeInt('affectationsCreees'),
      contactsPrincipaux: t.exposeInt('contactsPrincipaux'),
      rattachements: t.exposeInt('rattachements'),
      mailsInvitations: t.exposeInt('mailsInvitations'),
      mailsEquipe: t.exposeInt('mailsEquipe'),
    }),
  })

async function executer(
  ctx: AppContext,
  args: {
    editionId: string | number
    lignes: LigneEquipe[]
    envoyerMails?: boolean | null
  },
  ecrire: boolean
): Promise<RapportImportEquipe> {
  const edition = await ctx.exigerEdition(args.editionId)
  await ctx.exigerAdminDe(edition.activiteId)
  if (edition.statut === 'ARCHIVEE') {
    throw erreurSaisie(
      i18n._('Cette édition est archivée : son équipe est en lecture seule.')
    )
  }
  if (args.lignes.length > LIGNES_PAR_LOT) {
    throw erreurSaisie(
      i18n._('Un envoi compte {max} lignes au plus.', { max: LIGNES_PAR_LOT })
    )
  }
  const organisationId = ctx.organisation!.id
  const { annee } = await prisma.edition.findUniqueOrThrow({
    where: { id: edition.id },
    select: { annee: true },
  })
  const rapport = await importerEquipeDuTableur(args.lignes, {
    organisationId,
    activiteId: edition.activiteId,
    edition: { id: edition.id, annee },
    adminOrganisation: ctx.personne!.estAdmin,
    envoyerMails: args.envoyerMails === true,
    ecrire,
  })
  if (ecrire && rapport.personnes + rapport.invitationsEnAttente > 0) {
    publierPourActivite('EQUIPE', organisationId, edition.activiteId, {
      editionId: edition.id,
    })
  }
  return rapport
}

builder.queryFields(t => ({
  simulerImportEquipe: t.field({
    type: RapportImportEquipeRef,
    authScopes: { gestion: true },
    description:
      'Simule l’import d’un lot de lignes de l’équipe : rien ne change en base.',
    args: {
      editionId: t.arg.id({ required: true }),
      lignes: t.arg({ type: [LigneEquipeInput], required: true }),
    },
    resolve: (_root, args, ctx) => executer(ctx, args, false),
  }),
}))

builder.mutationFields(t => ({
  importerEquipe: t.field({
    type: RapportImportEquipeRef,
    authScopes: { gestion: true },
    description:
      'Importe un lot de lignes de l’équipe : comptes, rattachements, affectations et contacts principaux qui manquent. Rien n’est retiré, et aucun mail ne part sans `envoyerMails`.',
    args: {
      editionId: t.arg.id({ required: true }),
      lignes: t.arg({ type: [LigneEquipeInput], required: true }),
      envoyerMails: t.arg.boolean(),
    },
    resolve: (_root, args, ctx) => executer(ctx, args, true),
  }),
}))
