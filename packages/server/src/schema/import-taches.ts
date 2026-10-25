import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import {
  importerTaches,
  type LigneTache,
  type RapportImportTaches,
} from '../lib/import-taches.ts'
import { i18n } from '../lib/langue.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'

import { builder } from './builder.ts'
import { LIGNES_PAR_LOT, LigneImportRef } from './import-commun.ts'

// Import des tâches d'une période depuis un tableur (ADR 0049), réservé aux admins
// de l'activité. La simulation suit le même chemin sans rien écrire ni verrouiller.

const LigneTacheInput = builder.inputType('LigneTacheImport', {
  fields: t => ({
    ligne: t.int({ required: true }),
    perimetre: t.string({ required: true }),
    titre: t.string({ required: true }),
    description: t.string(),
    echeance: t.string({
      description:
        'Une date AAAA-MM-JJ, ou un décalage depuis le premier jour : J-30, J+3.',
    }),
    fiche: t.string({ description: 'Le titre ou l’identifiant d’une fiche.' }),
    responsable: t.string({
      description: 'L’adresse d’une personne affectée au périmètre.',
    }),
  }),
})

const RapportImportTachesRef = builder
  .objectRef<RapportImportTaches>('RapportImportTaches')
  .implement({
    fields: t => ({
      lignes: t.field({ type: [LigneImportRef], resolve: r => r.lignes }),
      perimetresCrees: t.exposeStringList('perimetresCrees'),
      tachesTypesAjoutees: t.exposeInt('tachesTypesAjoutees'),
    }),
  })

interface Arguments {
  editionId: string | number
  lignes: LigneTache[]
  groupeNouveaux?: string | null
  enregistrerTachesTypes?: boolean | null
}

async function executer(
  ctx: AppContext,
  args: Arguments,
  ecrire: boolean
): Promise<RapportImportTaches> {
  const edition = await ctx.exigerEdition(args.editionId)
  await ctx.exigerAdminDe(edition.activiteId)
  if (edition.statut === 'ARCHIVEE') {
    throw erreurSaisie(
      i18n._('Cette édition est archivée : ses tâches sont en lecture seule.')
    )
  }
  if (args.lignes.length > LIGNES_PAR_LOT) {
    throw erreurSaisie(
      i18n._('Un envoi compte {max} lignes au plus.', { max: LIGNES_PAR_LOT })
    )
  }
  const organisationId = ctx.organisation!.id
  const { debut } = await prisma.edition.findUniqueOrThrow({
    where: { id: edition.id },
    select: { debut: true },
  })
  const options = {
    organisationId,
    activiteId: edition.activiteId,
    edition: { id: edition.id, debut },
    groupeNouveaux: args.groupeNouveaux ?? null,
    enregistrerTachesTypes: args.enregistrerTachesTypes === true,
    ecrire,
  }
  const rapport = ecrire
    ? await sousVerrouOrganisation(
        organisationId,
        tx => importerTaches(tx, args.lignes, options),
        { timeout: 60_000 }
      )
    : await prisma.$transaction(
        tx => importerTaches(tx, args.lignes, options),
        { timeout: 60_000 }
      )
  if (ecrire) {
    publierPourActivite('TACHE', organisationId, edition.activiteId, {
      editionId: edition.id,
    })
    if (rapport.perimetresCrees.length > 0) {
      publierPourActivite('PERIMETRE', organisationId, edition.activiteId)
    }
  }
  return rapport
}

builder.queryFields(t => ({
  simulerImportTaches: t.field({
    type: RapportImportTachesRef,
    authScopes: { gestion: true },
    description:
      'Simule l’import d’un lot de lignes de tâches : rien ne change en base.',
    args: {
      editionId: t.arg.id({ required: true }),
      lignes: t.arg({ type: [LigneTacheInput], required: true }),
      groupeNouveaux: t.arg.string({
        description:
          'Le groupe des périmètres inconnus, créés par l’import. Sans valeur, leurs lignes sont écartées.',
      }),
      enregistrerTachesTypes: t.arg.boolean(),
    },
    resolve: (_root, args, ctx) => executer(ctx, args, false),
  }),
}))

builder.mutationFields(t => ({
  importerTaches: t.field({
    type: RapportImportTachesRef,
    authScopes: { gestion: true },
    description:
      'Importe un lot de lignes de tâches dans une période. Une tâche déjà présente (même périmètre, même titre, même échéance) n’est pas recréée.',
    args: {
      editionId: t.arg.id({ required: true }),
      lignes: t.arg({ type: [LigneTacheInput], required: true }),
      groupeNouveaux: t.arg.string(),
      enregistrerTachesTypes: t.arg.boolean(),
    },
    resolve: (_root, args, ctx) => executer(ctx, args, true),
  }),
}))
