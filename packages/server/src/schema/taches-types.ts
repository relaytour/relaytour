import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { i18n } from '../lib/langue.ts'
import { lireTachesTypes, type TacheModele } from '../orga/modeles.ts'
import {
  creerTachesDeLaPeriode,
  rapportTachesVide,
  type RapportTachesDeLaPeriode,
} from '../orga/taches-de-la-periode.ts'

import { builder } from './builder.ts'

// Tâches types appliquées à une période depuis l'espace organisateur (ADR 0048).
// Même règle que `orga:importer --edition` : une tâche type crée sa tâche une seule
// fois, et une tâche déjà créée ne change plus. La simulation suit le même chemin
// sans rien écrire.

interface RapportTachesTypes extends RapportTachesDeLaPeriode {
  /** Les périmètres dont la colonne des tâches types ne se lit pas. */
  illisibles: string[]
}

const RapportTachesTypesRef = builder
  .objectRef<RapportTachesTypes>('RapportTachesTypes')
  .implement({
    description:
      'Ce que l’application des tâches types fait à une période, ou ferait en simulation. Une tâche se nomme « périmètre/modèle ».',
    fields: t => ({
      effectifsCrees: t.stringList({ resolve: r => r.effectifs.crees }),
      effectifsDejaPresents: t.stringList({
        resolve: r => r.effectifs.dejaPresents,
      }),
      tachesCreees: t.stringList({ resolve: r => r.taches.creees }),
      tachesDejaPresentes: t.stringList({
        resolve: r => r.taches.dejaPresentes,
      }),
      tachesRattachees: t.stringList({ resolve: r => r.taches.rattachees }),
      conflits: t.stringList({ resolve: r => r.taches.conflits }),
      illisibles: t.exposeStringList('illisibles'),
    }),
  })

async function appliquer(
  ctx: AppContext,
  editionId: string,
  perimetreIds: readonly (string | number)[] | null | undefined,
  ecrire: boolean
): Promise<RapportTachesTypes> {
  const edition = await ctx.exigerEdition(editionId)
  await ctx.exigerAdminDe(edition.activiteId)
  if (edition.statut === 'ARCHIVEE') {
    throw erreurSaisie(
      i18n._('Cette édition est archivée : ses tâches sont en lecture seule.')
    )
  }
  const activiteId = edition.activiteId
  const perimetres = await prisma.perimetre.findMany({
    where: { activiteId },
    orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
    select: {
      id: true,
      slug: true,
      groupe: true,
      archivedAt: true,
      effectifParDefaut: true,
      tachesTypes: true,
    },
  })
  const actifs = perimetres.filter(p => p.archivedAt === null)
  // Un périmètre demandé hors de l'activité, ou archivé, vaut un périmètre inconnu.
  let retenus = actifs
  if (perimetreIds !== null && perimetreIds !== undefined) {
    const voulus = new Set(perimetreIds.map(String))
    retenus = actifs.filter(p => voulus.has(p.id))
    if (retenus.length !== voulus.size) throw accesRefuse()
  }

  const rapport: RapportTachesTypes = { ...rapportTachesVide(), illisibles: [] }
  const taches = new Map<string, TacheModele[]>()
  for (const perimetre of retenus) {
    const lues = lireTachesTypes(perimetre.tachesTypes)
    if (lues !== null) taches.set(perimetre.slug, lues)
    else if (perimetre.tachesTypes !== null) {
      rapport.illisibles.push(perimetre.slug)
    }
  }
  const fiches = new Map(
    (
      await prisma.fiche.findMany({
        where: { activiteId, archivedAt: null },
        select: { id: true, slug: true },
      })
    ).map(f => [f.slug, f.id])
  )

  const periode = await prisma.edition.findUniqueOrThrow({
    where: { id: edition.id },
    select: { id: true, debut: true },
  })
  await prisma.$transaction(
    tx =>
      creerTachesDeLaPeriode(
        tx,
        {
          periode,
          activiteId,
          perimetres: perimetres.map(p => ({
            slug: p.slug,
            groupe: p.groupe,
            id: p.id,
            archive: p.archivedAt !== null,
            effectif: p.effectifParDefaut,
          })),
          taches,
          ficheDe: slug =>
            slug === undefined ? null : (fiches.get(slug) ?? null),
          origines: new Set(retenus.map(p => p.slug)),
          ecrire,
        },
        rapport
      ),
    { timeout: 60_000 }
  )
  if (
    ecrire &&
    rapport.taches.creees.length + rapport.taches.rattachees.length > 0
  ) {
    publierPourActivite('TACHE', ctx.organisation!.id, activiteId, {
      editionId: edition.id,
    })
  }
  return rapport
}

builder.queryFields(t => ({
  simulerTachesTypes: t.field({
    type: RapportTachesTypesRef,
    authScopes: { gestion: true },
    description:
      'Simule l’application des tâches types à une période : rien ne change en base. Sans `perimetreIds`, tous les périmètres actifs de l’activité.',
    args: {
      editionId: t.arg.id({ required: true }),
      perimetreIds: t.arg.idList(),
    },
    resolve: (_root, { editionId, perimetreIds }, ctx) =>
      appliquer(ctx, String(editionId), perimetreIds, false),
  }),
}))

builder.mutationFields(t => ({
  appliquerTachesTypes: t.field({
    type: RapportTachesTypesRef,
    authScopes: { gestion: true },
    description:
      'Crée les effectifs et les tâches d’une période à partir des tâches types de ses périmètres. Une tâche déjà créée depuis sa tâche type ne change pas. Avec `perimetreIds`, seuls ces périmètres d’origine sont appliqués ; une tâche partagée se décline dans tous ses périmètres cibles.',
    args: {
      editionId: t.arg.id({ required: true }),
      perimetreIds: t.arg.idList(),
    },
    resolve: (_root, { editionId, perimetreIds }, ctx) =>
      appliquer(ctx, String(editionId), perimetreIds, true),
  }),
}))
