import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { planifierExportFiches } from '../espace-fichiers/export.ts'
import { lireGroupes } from '../lib/activites.ts'
import { peutLirePerimetre } from '../lib/droits.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { peutLireFiche, peutRedigerFiche } from '../lib/fiches.ts'
import { i18n } from '../lib/langue.ts'
import {
  conditionFichesConnexesDe,
  perimetresConcernes,
  publierFiche,
  type OrigineConnexe,
  type PerimetreConcerne,
} from '../lib/fiches-connexes.ts'
import { notifierLePerimetre } from '../lib/notifications.ts'

import { builder } from './builder.ts'
import { FicheRef } from './fiches.ts'
import { PerimetreRef } from './organisation.ts'

// Fiches connexes (ADR 0039) : la liste « Concerne aussi » d'une fiche, les fiches
// connexes d'un périmètre, et le masquage par un périmètre cible.

/** Le nombre de périmètres et de groupes qu'une liste accepte. */
const LISTE_MAX = 100

const OrigineConnexeEnum = builder.enumType('OrigineConnexe', {
  description:
    'Chemin du partage d’une fiche vers un périmètre : sa liste « Concerne aussi », un groupe de cette liste, ou une déclinaison acceptée qui cite la fiche.',
  values: ['LISTE', 'GROUPE', 'DECLINAISON'] satisfies OrigineConnexe[],
})

const ConnexionFicheRef = builder
  .objectRef<PerimetreConcerne>('ConnexionFiche')
  .implement({
    description:
      'Un périmètre qu’une fiche concerne, avec le chemin du partage et son masquage.',
    fields: t => ({
      perimetre: t.prismaField({
        type: PerimetreRef,
        resolve: (query, c) =>
          prisma.perimetre.findUniqueOrThrow({
            ...query,
            where: { id: c.perimetreId },
          }),
      }),
      par: t.field({ type: OrigineConnexeEnum, resolve: c => c.par }),
      groupe: t.string({ nullable: true, resolve: c => c.groupe }),
      tacheId: t.id({ nullable: true, resolve: c => c.tacheId }),
      masquee: t.boolean({ resolve: c => c.masquee }),
    }),
  })

// ── Champs de la fiche ───────────────────────────────────────────────────────

builder.prismaObjectFields(FicheRef, t => ({
  // La liste « Concerne aussi » : ses périmètres non archivés, puis ses groupes.
  concerneAussi: t.prismaField({
    type: [PerimetreRef],
    resolve: (query, fiche) =>
      prisma.perimetre.findMany({
        ...query,
        where: {
          archivedAt: null,
          activiteId: fiche.activiteId,
          fichesConnexes: { some: { ficheId: fiche.id } },
        },
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      }),
  }),
  concerneGroupes: t.stringList({
    resolve: async fiche =>
      (
        await prisma.ficheGroupeConnexe.findMany({
          where: { ficheId: fiche.id },
          select: { groupe: true },
          orderBy: { groupe: 'asc' },
        })
      ).map(g => g.groupe),
  }),
  // Tous les périmètres que la fiche concerne, par la liste, un groupe ou une
  // déclinaison, avec leur masquage.
  connexions: t.field({
    type: [ConnexionFicheRef],
    resolve: fiche => perimetresConcernes(fiche),
  }),
}))

// ── Champs du périmètre ──────────────────────────────────────────────────────

builder.prismaObjectFields(PerimetreRef, t => ({
  // Les fiches d'autres périmètres qui concernent celui-ci. Elles suivent la règle
  // de lecture des fiches du périmètre : la consultation ne les ouvre pas.
  fichesConnexes: t.prismaField({
    type: [FicheRef],
    args: { inclureMasquees: t.arg.boolean({ defaultValue: false }) },
    resolve: async (query, perimetre, { inclureMasquees }, ctx) => {
      if (!(await peutLirePerimetre(ctx, perimetre.id))) throw accesRefuse()
      if (perimetre.archivedAt !== null) return []
      return prisma.fiche.findMany({
        ...query,
        where: conditionFichesConnexesDe(perimetre, inclureMasquees ?? false),
        orderBy: { slug: 'asc' },
      })
    },
  }),
  peutMasquerFichesConnexes: t.boolean({
    resolve: (perimetre, _args, ctx) =>
      peutEcrireDansLePerimetre(ctx, perimetre),
  }),
}))

// ── Droits ───────────────────────────────────────────────────────────────────

/**
 * Écrire dans un périmètre, sans période désignée : l'administrer, ou y être
 * affecté pour une période non archivée.
 */
async function peutEcrireDansLePerimetre(
  ctx: AppContext,
  perimetre: { id: string; activiteId: string; archivedAt: Date | null }
): Promise<boolean> {
  if (ctx.personne === null || perimetre.archivedAt !== null) return false
  if (await ctx.estAdminDe(perimetre.activiteId)) return true
  const affectation = await prisma.affectation.findFirst({
    where: {
      userId: ctx.personne.id,
      perimetreId: perimetre.id,
      edition: { statut: { not: 'ARCHIVEE' } },
    },
    select: { id: true },
  })
  return affectation !== null
}

/** Une fiche de l'organisation active, lisible par la personne, sinon un refus. */
async function ficheLisible(ctx: AppContext, ficheId: string) {
  if (ctx.organisation === null) throw accesRefuse()
  const fiche = await prisma.fiche.findFirst({
    where: { id: ficheId, organisationId: ctx.organisation.id },
  })
  if (fiche === null || !(await peutLireFiche(ctx, fiche))) throw accesRefuse()
  return fiche
}

// ── Écriture ─────────────────────────────────────────────────────────────────

builder.mutationFields(t => ({
  // Règle la liste « Concerne aussi » d'une fiche de périmètre. Les personnes qui
  // peuvent rédiger la fiche, et les admins de son activité, la règlent. Les
  // périmètres et les groupes ajoutés préviennent leurs référentes et référents.
  reglerConcerneAussi: t.prismaField({
    type: FicheRef,
    authScopes: { connecte: true },
    args: {
      ficheId: t.arg.id({ required: true }),
      perimetreIds: t.arg.idList({ required: true }),
      groupes: t.arg.stringList({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const fiche = await ficheLisible(ctx, String(args.ficheId))
      if (!(await peutRedigerFiche(ctx, fiche.perimetreId, fiche.activiteId))) {
        throw accesRefuse()
      }
      if (fiche.perimetreId === null) {
        throw erreurSaisie(
          i18n._(
            'Une fiche commune concerne déjà tous les périmètres : elle n’a pas de liste « Concerne aussi ».'
          )
        )
      }
      if (fiche.archivedAt !== null) {
        throw erreurSaisie(i18n._('Cette fiche est archivée.'))
      }
      const ids = [...new Set(args.perimetreIds.map(String))]
      const groupes = [...new Set(args.groupes.map(g => g.trim()))]
      if (ids.length + groupes.length > LISTE_MAX) {
        throw erreurSaisie(
          i18n._('Une fiche concerne au plus {max} périmètres et groupes.', {
            max: LISTE_MAX,
          })
        )
      }
      if (ids.includes(fiche.perimetreId)) {
        throw erreurSaisie(
          i18n._(
            'La fiche appartient déjà à ce périmètre : retirez-le de la liste.'
          )
        )
      }
      // Les périmètres : de l'activité de la fiche, non archivés. Un périmètre d'une
      // autre activité ou d'une autre organisation vaut un périmètre inconnu.
      const trouves = await prisma.perimetre.count({
        where: {
          id: { in: ids },
          organisationId: fiche.organisationId,
          activiteId: fiche.activiteId,
          archivedAt: null,
        },
      })
      if (trouves !== ids.length) throw accesRefuse()
      const activite = await prisma.activite.findUniqueOrThrow({
        where: { id: fiche.activiteId },
        select: { groupes: true },
      })
      const declares = new Set(lireGroupes(activite.groupes).map(g => g.cle))
      const inconnu = groupes.find(g => !declares.has(g))
      if (inconnu !== undefined) {
        throw erreurSaisie(
          i18n._('L’activité ne déclare pas le groupe « {groupe} ».', {
            groupe: inconnu,
          })
        )
      }

      const avant = await perimetresConcernes(fiche)
      const acteurId = ctx.personne!.id
      await prisma.$transaction([
        prisma.ficheConnexe.deleteMany({
          where: { ficheId: fiche.id, perimetreId: { notIn: ids } },
        }),
        prisma.ficheGroupeConnexe.deleteMany({
          where: { ficheId: fiche.id, groupe: { notIn: groupes } },
        }),
        prisma.ficheConnexe.createMany({
          data: ids.map(perimetreId => ({
            ficheId: fiche.id,
            perimetreId,
            ajouteeParId: acteurId,
          })),
          skipDuplicates: true,
        }),
        prisma.ficheGroupeConnexe.createMany({
          data: groupes.map(groupe => ({
            ficheId: fiche.id,
            groupe,
            ajouteParId: acteurId,
          })),
          skipDuplicates: true,
        }),
      ])
      const apres = await perimetresConcernes(fiche)
      const deja = new Set(avant.map(c => c.perimetreId))
      for (const nouveau of apres.filter(c => !deja.has(c.perimetreId))) {
        await notifierLePerimetre(prisma, {
          type: 'FICHE_CONNEXE',
          perimetreId: nouveau.perimetreId,
          editionId: null,
          acteurId,
          ficheId: fiche.id,
        })
      }
      publierFiche(
        fiche,
        avant.map(c => c.perimetreId)
      )
      // L'en-tête de la fiche exportée porte la liste « Concerne aussi ».
      planifierExportFiches(fiche.organisationId)
      return prisma.fiche.findUniqueOrThrow({
        ...query,
        where: { id: fiche.id },
      })
    },
  }),

  // Masque une fiche connexe pour un périmètre cible : elle quitte sa liste
  // « Fiches connexes » et reste lisible par son lien.
  masquerFicheConnexe: t.prismaField({
    type: FicheRef,
    authScopes: { connecte: true },
    args: {
      ficheId: t.arg.id({ required: true }),
      perimetreId: t.arg.id({ required: true }),
    },
    resolve: (query, _root, args, ctx) =>
      changerMasquage(
        ctx,
        String(args.ficheId),
        String(args.perimetreId),
        true,
        query
      ),
  }),

  afficherFicheConnexe: t.prismaField({
    type: FicheRef,
    authScopes: { connecte: true },
    args: {
      ficheId: t.arg.id({ required: true }),
      perimetreId: t.arg.id({ required: true }),
    },
    resolve: (query, _root, args, ctx) =>
      changerMasquage(
        ctx,
        String(args.ficheId),
        String(args.perimetreId),
        false,
        query
      ),
  }),
}))

/**
 * Masque ou affiche une fiche connexe pour un périmètre cible. Les personnes qui
 * écrivent dans ce périmètre, et les admins de son activité, le font. Le périmètre
 * doit être concerné par la fiche. Le journal garde chaque geste.
 */
async function changerMasquage(
  ctx: AppContext,
  ficheId: string,
  perimetreId: string,
  masquer: boolean,
  query: { include?: unknown; select?: unknown }
) {
  if (ctx.organisation === null || ctx.personne === null) throw accesRefuse()
  const perimetre = await prisma.perimetre.findFirst({
    where: { id: perimetreId, organisationId: ctx.organisation.id },
    select: { id: true, activiteId: true, archivedAt: true },
  })
  if (
    perimetre === null ||
    !(await peutEcrireDansLePerimetre(ctx, perimetre))
  ) {
    throw accesRefuse()
  }
  const fiche = await prisma.fiche.findFirst({
    where: {
      id: ficheId,
      organisationId: ctx.organisation.id,
      activiteId: perimetre.activiteId,
    },
  })
  if (fiche === null) throw accesRefuse()
  const concernes = await perimetresConcernes(fiche)
  if (!concernes.some(c => c.perimetreId === perimetre.id)) {
    throw erreurSaisie(i18n._('Cette fiche ne concerne pas ce périmètre.'))
  }
  const acteurId = ctx.personne.id
  if (masquer) {
    await prisma.$transaction([
      prisma.ficheConnexeMasquee.upsert({
        where: { ficheId_perimetreId: { ficheId, perimetreId } },
        create: { ficheId, perimetreId, masqueeParId: acteurId },
        update: {},
      }),
      prisma.journal.create({
        data: {
          type: 'FICHE_CONNEXE_MASQUEE',
          acteurId,
          perimetreId,
          ficheId,
        },
      }),
    ])
  } else {
    await prisma.$transaction([
      prisma.ficheConnexeMasquee.deleteMany({
        where: { ficheId, perimetreId },
      }),
      prisma.journal.create({
        data: {
          type: 'FICHE_CONNEXE_AFFICHEE',
          acteurId,
          perimetreId,
          ficheId,
        },
      }),
    ])
  }
  publierFiche(fiche)
  return prisma.fiche.findUniqueOrThrow({
    ...(query as object),
    where: { id: fiche.id },
  })
}
