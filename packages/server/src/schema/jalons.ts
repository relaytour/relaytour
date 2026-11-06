import { prisma, type Prisma, type Tache, type User } from '@relaytour/database'

import {
  aujourdhui,
  exigerConsultation,
  exigerEcriture,
  peutModifierPerimetre,
} from '../lib/droits.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourPerimetre } from '../lib/flux.ts'
import {
  estActive,
  LIENS_JALON_MAX,
  resumerJalon,
  type ResumeJalon,
} from '../lib/jalons.ts'
import { i18n } from '../lib/langue.ts'

import { builder } from './builder.ts'
import { PersonneRef } from './personnes.ts'
import { chargerTache, exigerDeclinaisonAcceptee, TacheRef } from './taches.ts'

// Jalons (ADR 0062).
//
// Un jalon est une tâche qui porte le marqueur facultatif `jalonLe`. Il lie d'autres
// tâches de la même période, dans son périmètre ou dans un autre périmètre de
// l'activité. Lier une tâche demande d'écrire dans le périmètre du jalon et de
// consulter celui de la tâche liée : le lien ne change pas la tâche liée. Retirer un
// lien demande d'écrire dans l'un des deux périmètres.

const ResumeJalonRef = builder.objectRef<ResumeJalon>('ResumeJalon').implement({
  description:
    'L’état des tâches liées d’un jalon, en nombres. `enRetard` et `assigneesAMoi` se comptent parmi les tâches ouvertes.',
  fields: t => ({
    total: t.exposeInt('total'),
    ouvertes: t.exposeInt('ouvertes'),
    faites: t.exposeInt('faites'),
    abandonnees: t.exposeInt('abandonnees'),
    enRetard: t.exposeInt('enRetard'),
    assigneesAMoi: t.exposeInt('assigneesAMoi'),
  }),
})

// Les étapes d'un jalon, lues dans le journal.
const ETAPES_JALON = {
  JALON_MARQUE: 'MARQUE',
  JALON_RETIRE: 'RETIRE',
  TACHE_LIEE: 'LIEE',
  TACHE_DELIEE: 'DELIEE',
} as const
type TypeEtapeJalon = keyof typeof ETAPES_JALON

const EtapeJalonEnum = builder.enumType('EtapeJalon', {
  description:
    'Étape d’un jalon : marqué, marque retirée, tâche liée, tâche déliée (ADR 0062).',
  values: Object.values(ETAPES_JALON),
})

const EtapeJalonRef = builder
  .objectRef<{
    type: TypeEtapeJalon
    createdAt: Date
    acteur: User
    tacheLiee: Tache | null
  }>('EtapeDeJalon')
  .implement({
    description:
      'Une étape d’un jalon : qui l’a marqué, qui a lié ou délié une tâche, et quand.',
    fields: t => ({
      etape: t.field({
        type: EtapeJalonEnum,
        resolve: e => ETAPES_JALON[e.type],
      }),
      le: t.field({ type: 'DateTime', resolve: e => e.createdAt }),
      par: t.field({ type: PersonneRef, resolve: e => e.acteur }),
      tache: t.field({
        type: TacheRef,
        nullable: true,
        description: 'Pour une tâche liée ou déliée : cette tâche.',
        resolve: e => e.tacheLiee,
      }),
    }),
  })

// Toutes les tâches d'un jalon appartiennent à sa période, donc à son activité : qui
// consulte le jalon consulte ses tâches liées (ADR 0014).
builder.prismaObjectFields(TacheRef, t => ({
  jalon: t.boolean({
    description: 'Vrai quand la tâche est un jalon (ADR 0062).',
    select: { jalonLe: true },
    resolve: tache => tache.jalonLe !== null,
  }),
  // Le résumé se charge avec la tâche et coûte peu : une liste de tâches le lit.
  resumeJalon: t.field({
    type: ResumeJalonRef,
    description:
      'L’état des tâches liées de ce jalon, en nombres. Tous à zéro pour une tâche qui ne lie aucune tâche.',
    select: {
      liensJalon: {
        select: {
          tache: {
            select: {
              statut: true,
              echeance: true,
              assignations: { select: { userId: true } },
            },
          },
        },
      },
    },
    resolve: (tache, _args, ctx) =>
      resumerJalon(
        tache.liensJalon.map(l => l.tache),
        aujourdhui(new Date(), ctx.organisation?.fuseauHoraire),
        ctx.personne?.id ?? null
      ),
  }),
  // Le détail dépasse le plafond de complexité dans une liste : l'espace
  // organisateur le lit par la requête d'une seule tâche.
  tachesLiees: t.field({
    type: [TacheRef],
    description:
      'Les tâches liées de ce jalon, par échéance. Vide pour une tâche qui n’est pas un jalon.',
    complexity: { field: 1, multiplier: 20 },
    select: (_args, _ctx, selection) => ({
      liensJalon: {
        select: { tache: selection(true) },
        orderBy: [{ tache: { echeance: 'asc' } }, { createdAt: 'asc' }],
      },
    }),
    resolve: tache => tache.liensJalon.map(l => l.tache),
  }),
  jalons: t.field({
    type: [TacheRef],
    description: 'Les jalons que cette tâche sert, par échéance.',
    complexity: { field: 1, multiplier: 3 },
    select: (_args, _ctx, selection) => ({
      liensTache: {
        select: { jalon: selection(true) },
        orderBy: [{ jalon: { echeance: 'asc' } }, { createdAt: 'asc' }],
      },
    }),
    resolve: tache => tache.liensTache.map(l => l.jalon),
  }),
  historiqueJalon: t.field({
    type: [EtapeJalonRef],
    description:
      'Les étapes de ce jalon, de la plus ancienne à la plus récente. Lisible par toute personne qui consulte le jalon.',
    resolve: async tache => {
      const lignes = await prisma.journal.findMany({
        where: {
          tacheId: tache.id,
          type: { in: Object.keys(ETAPES_JALON) as TypeEtapeJalon[] },
        },
        orderBy: { createdAt: 'asc' },
        select: { type: true, createdAt: true, acteur: true, tacheLiee: true },
      })
      return lignes.map(l => ({ ...l, type: l.type as TypeEtapeJalon }))
    },
  }),
}))

/**
 * Verrouille le jalon et rend son marqueur lu sous le verrou. Sous MariaDB 11.8, le
 * verrou se prend avant toute lecture ordinaire de la transaction.
 */
async function verrouillerJalon(
  tx: Prisma.TransactionClient,
  id: string
): Promise<{ marque: boolean }> {
  const lignes = await tx.$queryRaw<{ jalonLe: Date | null }[]>`
    SELECT jalonLe FROM Tache WHERE id = ${id} FOR UPDATE`
  const ligne = lignes[0]
  return { marque: ligne !== undefined && ligne.jalonLe !== null }
}

/** Prévient les pages des périmètres touchés par un lien. */
function publierPerimetres(
  editionId: string,
  taches: readonly { id: string; perimetreId: string }[]
) {
  const vus = new Set<string>()
  for (const tache of taches) {
    if (vus.has(tache.perimetreId)) continue
    vus.add(tache.perimetreId)
    publierPourPerimetre('TACHE', tache.perimetreId, {
      id: tache.id,
      editionId,
    })
  }
}

builder.mutationFields(t => ({
  marquerJalon: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    description:
      'Pose ou retire le marqueur de jalon d’une tâche (ADR 0062). Le retrait retire aussi tous les liens du jalon. Demande d’écrire dans le périmètre de la tâche.',
    args: {
      id: t.arg.id({ required: true }),
      jalon: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      const relire = () =>
        prisma.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      const journal = {
        acteurId: acteur.id,
        editionId: tache.editionId,
        perimetreId: tache.perimetreId,
        tacheId: tache.id,
      }
      if (args.jalon) {
        // Une déclinaison qui attend un accord, ou refusée, ne se marque pas.
        exigerDeclinaisonAcceptee(tache)
        if (tache.jalonLe !== null) return relire()
        const ecrite = await prisma.$transaction(async tx => {
          const { count } = await tx.tache.updateMany({
            where: { id: tache.id, jalonLe: null },
            data: { jalonLe: new Date(), jalonParId: acteur.id },
          })
          if (count === 0) return false
          await tx.journal.create({
            data: { type: 'JALON_MARQUE', ...journal },
          })
          return true
        })
        if (ecrite) publierPerimetres(tache.editionId, [tache])
        return relire()
      }
      if (tache.jalonLe === null) return relire()
      const liees = await prisma.$transaction(async tx => {
        const { marque } = await verrouillerJalon(tx, tache.id)
        if (!marque) return null
        const liens = await tx.lienJalon.findMany({
          where: { jalonId: tache.id },
          select: { tache: { select: { id: true, perimetreId: true } } },
        })
        await tx.lienJalon.deleteMany({ where: { jalonId: tache.id } })
        await tx.tache.update({
          where: { id: tache.id },
          data: { jalonLe: null, jalonParId: null },
        })
        await tx.journal.create({ data: { type: 'JALON_RETIRE', ...journal } })
        return liens.map(l => l.tache)
      })
      if (liees !== null) publierPerimetres(tache.editionId, [tache, ...liees])
      return relire()
    },
  }),

  lierTaches: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    description: `Lie des tâches de la même période à un jalon (ADR 0062). Demande d’écrire dans le périmètre du jalon et de consulter celui de chaque tâche liée. Une tâche déjà liée est ignorée. Un jalon lie au plus ${LIENS_JALON_MAX} tâches. Rend le jalon.`,
    args: {
      id: t.arg.id({ required: true, description: 'Le jalon.' }),
      tacheIds: t.arg.idList({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const jalon = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        jalon.perimetreId,
        jalon.editionId
      )
      const relire = () =>
        prisma.tache.findUniqueOrThrow({ ...query, where: { id: jalon.id } })
      const ids = [...new Set(args.tacheIds.map(String))]
      if (ids.length === 0) {
        throw erreurSaisie(i18n._('Choisissez au moins une tâche.'))
      }
      if (ids.length > LIENS_JALON_MAX) {
        throw erreurSaisie(
          i18n._('Un jalon lie {max} tâches au plus.', {
            max: LIENS_JALON_MAX,
          })
        )
      }
      if (jalon.jalonLe === null) {
        throw erreurSaisie(
          i18n._('Cette tâche n’est pas un jalon : transformez-la d’abord.')
        )
      }
      exigerDeclinaisonAcceptee(jalon)
      if (ids.includes(jalon.id)) {
        throw erreurSaisie(i18n._('Un jalon ne se lie pas à lui-même.'))
      }
      const taches = await prisma.tache.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          titre: true,
          editionId: true,
          perimetreId: true,
          accord: true,
          perimetre: {
            select: {
              nom: true,
              archivedAt: true,
              organisationId: true,
              activiteId: true,
            },
          },
        },
      })
      // Une tâche inconnue, d'une autre période ou d'une autre organisation reçoit
      // le même refus.
      if (taches.length !== ids.length) throw accesRefuse()
      for (const tache of taches) {
        if (tache.editionId !== jalon.editionId) throw accesRefuse()
        await exigerConsultation(ctx, tache.perimetre)
        if (!estActive(tache)) {
          throw erreurSaisie(
            i18n._(
              'La tâche « {titre} » attend l’accord de son périmètre : elle ne se lie pas encore.',
              { titre: tache.titre }
            )
          )
        }
        if (tache.perimetre.archivedAt !== null) {
          throw erreurSaisie(
            i18n._('Le périmètre « {nom} » est archivé.', {
              nom: tache.perimetre.nom,
            })
          )
        }
      }
      const nouvelles = await prisma.$transaction(async tx => {
        // Le verrou du jalon précède toute lecture : deux liaisons simultanées ne
        // dépassent pas le plafond, et un retrait du marqueur ne laisse aucun lien.
        const { marque } = await verrouillerJalon(tx, jalon.id)
        if (!marque) {
          throw erreurSaisie(
            i18n._('Cette tâche n’est plus un jalon : transformez-la d’abord.')
          )
        }
        const presents = new Set(
          (
            await tx.lienJalon.findMany({
              where: { jalonId: jalon.id },
              select: { tacheId: true },
            })
          ).map(l => l.tacheId)
        )
        const aLier = taches.filter(x => !presents.has(x.id))
        if (aLier.length === 0) return []
        if (presents.size + aLier.length > LIENS_JALON_MAX) {
          throw erreurSaisie(
            i18n._('Un jalon lie {max} tâches au plus.', {
              max: LIENS_JALON_MAX,
            })
          )
        }
        await tx.lienJalon.createMany({
          data: aLier.map(x => ({
            jalonId: jalon.id,
            tacheId: x.id,
            creeParId: acteur.id,
          })),
        })
        await tx.journal.createMany({
          data: aLier.map(x => ({
            type: 'TACHE_LIEE' as const,
            acteurId: acteur.id,
            editionId: jalon.editionId,
            perimetreId: jalon.perimetreId,
            tacheId: jalon.id,
            tacheLieeId: x.id,
          })),
        })
        return aLier
      })
      if (nouvelles.length > 0) {
        publierPerimetres(jalon.editionId, [jalon, ...nouvelles])
      }
      return relire()
    },
  }),

  delierTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    description:
      'Retire une tâche liée d’un jalon (ADR 0062). La tâche liée ne change pas. Demande d’écrire dans le périmètre du jalon ou dans celui de la tâche liée. Rend le jalon.',
    args: {
      id: t.arg.id({ required: true, description: 'Le jalon.' }),
      tacheId: t.arg.id({ required: true, description: 'La tâche liée.' }),
    },
    resolve: async (query, _root, args, ctx) => {
      const jalon = await chargerTache(String(args.id))
      const tache = await chargerTache(String(args.tacheId))
      // Deux tâches de périodes différentes ne sont jamais liées. Le refus est
      // celui d'une tâche inconnue : la réponse ne décrit pas une autre période.
      if (tache.editionId !== jalon.editionId) throw accesRefuse()
      // L'équipe du jalon comme celle de la tâche liée retire le lien. Un refus
      // dans les deux périmètres reste le refus d'écriture habituel.
      const acteur = (await peutModifierPerimetre(
        ctx,
        jalon.perimetreId,
        jalon.editionId
      ))
        ? await exigerEcriture(ctx, jalon.perimetreId, jalon.editionId)
        : await exigerEcriture(ctx, tache.perimetreId, tache.editionId)
      const relire = () =>
        prisma.tache.findUniqueOrThrow({ ...query, where: { id: jalon.id } })
      const ecrite = await prisma.$transaction(async tx => {
        const { count } = await tx.lienJalon.deleteMany({
          where: { jalonId: jalon.id, tacheId: tache.id },
        })
        if (count === 0) return false
        await tx.journal.create({
          data: {
            type: 'TACHE_DELIEE',
            acteurId: acteur.id,
            editionId: jalon.editionId,
            perimetreId: jalon.perimetreId,
            tacheId: jalon.id,
            tacheLieeId: tache.id,
          },
        })
        return true
      })
      if (ecrite) publierPerimetres(jalon.editionId, [jalon, tache])
      return relire()
    },
  }),
}))
