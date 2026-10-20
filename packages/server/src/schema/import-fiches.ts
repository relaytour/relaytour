import { prisma } from '@relaytour/database'

import {
  importerDepuisEspace,
  type RapportImportEspace,
  type SourceImport,
} from '../espace-fichiers/import.ts'
import { erreurEspace } from '../espace-fichiers/index.ts'
import type { AppContext } from '../context.ts'
import { accesRefuse } from '../lib/erreurs.ts'

import { builder } from './builder.ts'

// Import initial des fiches depuis l'espace de fichiers (ADR 0038), réservé aux
// admins de l'organisation : il lit des dossiers que les membres ne lisent pas
// forcément. La simulation et l'import suivent le même chemin ; seul l'import
// écrit.

const SourceImportInput = builder.inputType('SourceImportFiches', {
  description:
    'Dossier source des fiches d’un périmètre, ou des fiches communes quand le périmètre est nul.',
  fields: t => ({
    perimetreId: t.id(),
    emplacement: t.string({ required: true }),
    chemin: t.stringList({ required: true }),
  }),
})

const ConflitImportRef = builder
  .objectRef<{ fiche: string; raison: string }>('ConflitImport')
  .implement({
    fields: t => ({
      fiche: t.exposeString('fiche'),
      raison: t.exposeString('raison'),
    }),
  })

const FichierEcarteRef = builder
  .objectRef<{ fichier: string; raison: string }>('FichierEcarte')
  .implement({
    fields: t => ({
      fichier: t.exposeString('fichier'),
      raison: t.exposeString('raison'),
    }),
  })

const RapportImportRef = builder
  .objectRef<RapportImportEspace>('RapportImportFiches')
  .implement({
    description:
      'Ce que l’import des fiches depuis l’espace de fichiers fait, ou ferait en simulation.',
    fields: t => ({
      creees: t.exposeStringList('creees'),
      nouvellesVersions: t.exposeStringList('nouvellesVersions'),
      inchangees: t.exposeStringList('inchangees'),
      conflits: t.field({
        type: [ConflitImportRef],
        resolve: r => r.conflits,
      }),
      nonImportes: t.field({
        type: [FichierEcarteRef],
        resolve: r => r.nonImportes,
      }),
      refusees: t.field({ type: [FichierEcarteRef], resolve: r => r.refusees }),
      converties: t.field({
        type: [FichierEcarteRef],
        resolve: r => r.converties,
      }),
      incomplet: t.exposeBoolean('incomplet'),
    }),
  })

async function importer(
  ctx: AppContext,
  activiteId: string,
  sources: readonly {
    perimetreId?: string | number | null
    emplacement: string
    chemin: string[]
  }[],
  ecrire: boolean
): Promise<RapportImportEspace> {
  const organisationId = ctx.organisation!.id
  const activite = await prisma.activite.findFirst({
    where: { id: activiteId, organisationId },
    select: { id: true },
  })
  if (activite === null) throw accesRefuse()
  const lues: SourceImport[] = sources.map(s => ({
    perimetreId:
      s.perimetreId === null || s.perimetreId === undefined
        ? null
        : String(s.perimetreId),
    emplacement: s.emplacement,
    chemin: s.chemin,
  }))
  try {
    return await importerDepuisEspace(organisationId, activite.id, lues, {
      ecrire,
      auteurId: ctx.personne!.id,
    })
  } catch (erreur) {
    throw erreurEspace(erreur)
  }
}

builder.queryFields(t => ({
  simulerImportFiches: t.field({
    type: RapportImportRef,
    authScopes: { admin: true },
    description:
      'Simule l’import des fiches depuis l’espace de fichiers : rien ne change en base.',
    args: {
      activiteId: t.arg.id({ required: true }),
      sources: t.arg({ type: [SourceImportInput], required: true }),
    },
    resolve: (_root, { activiteId, sources }, ctx) =>
      importer(ctx, String(activiteId), sources, false),
  }),
}))

builder.mutationFields(t => ({
  importerFichesEspace: t.field({
    type: RapportImportRef,
    authScopes: { admin: true },
    description:
      'Importe les fiches des dossiers sources dans l’activité. Une fiche modifiée dans Relaytour n’est pas remplacée.',
    args: {
      activiteId: t.arg.id({ required: true }),
      sources: t.arg({ type: [SourceImportInput], required: true }),
    },
    resolve: (_root, { activiteId, sources }, ctx) =>
      importer(ctx, String(activiteId), sources, true),
  }),
}))
