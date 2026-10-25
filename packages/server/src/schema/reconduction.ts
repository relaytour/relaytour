import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { i18n } from '../lib/langue.ts'
import {
  reconduire,
  type LigneReconduction,
  type RapportReconduction,
} from '../lib/reconduction.ts'

import { builder } from './builder.ts'
import { StatutTacheEnum } from './taches.ts'

// Reconduction d'une période (ADR 0048). La simulation, sans `tacheIds`, liste les
// tâches de la période source et celles retenues par défaut : l'écran s'en sert pour
// proposer le choix. La mutation crée les tâches choisies et les effectifs.

const EtatReconductionEnum = builder.enumType('EtatReconduction', {
  values: ['A_CREER', 'DEJA_PRESENTE', 'ECARTEE'] as const,
})

const LigneReconductionRef = builder
  .objectRef<LigneReconduction>('LigneReconduction')
  .implement({
    description:
      'Une tâche de la période source et ce que la reconduction en fait. Une tâche partagée compte ses déclinaisons recréées.',
    fields: t => ({
      tacheId: t.exposeID('tacheId'),
      perimetreId: t.exposeID('perimetreId'),
      perimetre: t.exposeString('perimetre'),
      titre: t.exposeString('titre'),
      statutSource: t.expose('statutSource', { type: StatutTacheEnum }),
      echeance: t.expose('echeance', { type: 'Date', nullable: true }),
      declinaisons: t.exposeInt('declinaisons'),
      parDefaut: t.exposeBoolean('parDefaut'),
      retenue: t.exposeBoolean('retenue'),
      etat: t.expose('etat', { type: EtatReconductionEnum }),
      raison: t.exposeString('raison', { nullable: true }),
    }),
  })

const RapportReconductionRef = builder
  .objectRef<RapportReconduction>('RapportReconduction')
  .implement({
    description:
      'Ce que la reconduction fait à la période cible, ou ferait en simulation.',
    fields: t => ({
      lignes: t.field({ type: [LigneReconductionRef], resolve: r => r.lignes }),
      effectifsCrees: t.stringList({ resolve: r => r.effectifs.crees }),
      effectifsDejaPresents: t.stringList({
        resolve: r => r.effectifs.dejaPresents,
      }),
      ignorees: t.exposeInt('ignorees'),
    }),
  })

async function executer(
  ctx: AppContext,
  sourceId: string,
  cibleId: string,
  tacheIds: readonly (string | number)[] | null | undefined,
  ecrire: boolean
): Promise<RapportReconduction> {
  const source = await ctx.exigerEdition(sourceId)
  const cible = await ctx.exigerEdition(cibleId)
  // Deux périodes de deux activités valent une période inconnue.
  if (source.activiteId !== cible.activiteId) throw accesRefuse()
  await ctx.exigerAdminDe(cible.activiteId)
  if (source.id === cible.id) {
    throw erreurSaisie(i18n._('Choisissez une autre édition comme source.'))
  }
  if (cible.statut === 'ARCHIVEE') {
    throw erreurSaisie(
      i18n._('Cette édition est archivée : ses tâches sont en lecture seule.')
    )
  }
  const [debutSource, debutCible] = await Promise.all(
    [source.id, cible.id].map(id =>
      prisma.edition.findUniqueOrThrow({
        where: { id },
        select: { id: true, debut: true },
      })
    )
  )
  const rapport = await prisma.$transaction(
    tx =>
      reconduire(tx, {
        source: debutSource!,
        cible: debutCible!,
        tacheIds:
          tacheIds === null || tacheIds === undefined
            ? null
            : tacheIds.map(String),
        auteurId: ctx.personne!.id,
        ecrire,
      }),
    { timeout: 60_000 }
  )
  if (ecrire) {
    publierPourActivite('TACHE', ctx.organisation!.id, cible.activiteId, {
      editionId: cible.id,
    })
  }
  return rapport
}

builder.queryFields(t => ({
  simulerReconduction: t.field({
    type: RapportReconductionRef,
    authScopes: { gestion: true },
    description:
      'Simule la reconduction des tâches d’une période vers une autre de la même activité : rien ne change en base. Sans `tacheIds`, toutes les tâches qui n’ont pas été abandonnées.',
    args: {
      sourceId: t.arg.id({ required: true }),
      cibleId: t.arg.id({ required: true }),
      tacheIds: t.arg.idList(),
    },
    resolve: (_root, { sourceId, cibleId, tacheIds }, ctx) =>
      executer(ctx, String(sourceId), String(cibleId), tacheIds, false),
  }),
}))

builder.mutationFields(t => ({
  reconduireEdition: t.field({
    type: RapportReconductionRef,
    authScopes: { gestion: true },
    description:
      'Recrée dans la période cible les tâches choisies de la période source, avec le même écart en jours depuis le premier jour, et les effectifs souhaités. Une tâche déjà présente n’est pas recréée.',
    args: {
      sourceId: t.arg.id({ required: true }),
      cibleId: t.arg.id({ required: true }),
      tacheIds: t.arg.idList(),
    },
    resolve: (_root, { sourceId, cibleId, tacheIds }, ctx) =>
      executer(ctx, String(sourceId), String(cibleId), tacheIds, true),
  }),
}))
