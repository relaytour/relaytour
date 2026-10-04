import {
  prisma,
  StatutTache,
  type Prisma,
  type User,
} from '@relaytour/database'
import { GraphQLError } from 'graphql'

import type { AppContext } from '../context.ts'
import {
  accesAuPerimetre,
  aujourdhui,
  estEnRetard,
  exigerConsultation,
  exigerEcriture,
  perimetresLisibles,
  peutModifierPerimetre,
} from '../lib/droits.ts'
import { accesRefuse, conflitDeVersion, erreurSaisie } from '../lib/erreurs.ts'
import { notifier, referentsSauf } from '../lib/notifications.ts'
import { texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'

export const StatutTacheEnum = builder.enumType(StatutTache, {
  name: 'StatutTache',
})

// ── Types ────────────────────────────────────────────────────────────────────

export const TacheRef = builder.prismaObject('Tache', {
  fields: t => ({
    id: t.exposeID('id'),
    titre: t.exposeString('titre'),
    description: t.exposeString('description', { nullable: true }),
    echeance: t.expose('echeance', { type: 'Date', nullable: true }),
    statut: t.expose('statut', { type: StatutTacheEnum }),
    version: t.exposeInt('version', {
      description:
        'Nombre de modifications du contenu. `modifierTache` la reçoit en `versionAttendue`.',
    }),
    // Le retard se juge au jour du fuseau de l'organisation.
    enRetard: t.boolean({
      resolve: (tache, _args, ctx) =>
        estEnRetard(
          tache,
          aujourdhui(new Date(), ctx.organisation?.fuseauHoraire)
        ),
    }),
    termineeLe: t.expose('termineeLe', { type: 'DateTime', nullable: true }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    modifieeLe: t.expose('updatedAt', { type: 'DateTime' }),
    perimetre: t.relation('perimetre', { type: PerimetreRef }),
    edition: t.relation('edition', { type: EditionRef }),
    // Les personnes assignées sont chargées avec la tâche, sans requête par tâche.
    assignes: t.field({
      type: [PersonneRef],
      select: (_args, _ctx, selection) => ({
        assignations: {
          select: { user: selection(true) },
          orderBy: { user: { name: 'asc' } },
        },
      }),
      resolve: tache => tache.assignations.map(a => a.user),
    }),
    // Qui a coché la tâche et qui l'a réalisée : ces informations ne sont lisibles que
    // par la personne qui a coché et par les admins. Les autres lisent null.
    // L'activité se charge avec la tâche : aucune requête de plus par tâche.
    clotureePar: t.field({
      type: PersonneRef,
      nullable: true,
      select: { perimetre: { select: { activiteId: true } } },
      resolve: async (tache, _args, ctx) =>
        tache.clotureeParId !== null && (await voitLaCloture(ctx, tache))
          ? prisma.user.findUnique({ where: { id: tache.clotureeParId } })
          : null,
    }),
    realiseePar: t.field({
      type: PersonneRef,
      nullable: true,
      select: { perimetre: { select: { activiteId: true } } },
      resolve: async (tache, _args, ctx) =>
        tache.realiseeParId !== null && (await voitLaCloture(ctx, tache))
          ? prisma.user.findUnique({ where: { id: tache.realiseeParId } })
          : null,
    }),
    // Les droits d'écriture sur la tâche, pour n'afficher que les actions permises.
    // La tâche porte son périmètre et son édition : le champ ne prend aucun argument,
    // et les listes qui la rendent hors de la page d'un périmètre le lisent aussi.
    peutModifier: t.boolean({
      resolve: (tache, _args, ctx) =>
        peutModifierPerimetre(ctx, tache.perimetreId, tache.editionId),
    }),
  }),
})

/** Qui a coché et qui a réalisé : la personne qui a coché, et les admins de l'activité. */
async function voitLaCloture(
  ctx: AppContext,
  tache: { clotureeParId: string | null; perimetre: { activiteId: string } }
) {
  if (ctx.personne === null) return false
  if (ctx.personne.id === tache.clotureeParId) return true
  // Les activités administrées se calculent une fois par requête.
  return ctx.estAdminDe(tache.perimetre.activiteId)
}

const AvancementRef = builder
  .objectRef<{
    total: number
    aFaire: number
    enCours: number
    faites: number
    abandonnees: number
    enRetard: number
    sansPersonne: number
  }>('Avancement')
  .implement({
    fields: t => ({
      total: t.exposeInt('total'),
      aFaire: t.exposeInt('aFaire'),
      enCours: t.exposeInt('enCours'),
      faites: t.exposeInt('faites'),
      abandonnees: t.exposeInt('abandonnees'),
      enRetard: t.exposeInt('enRetard'),
      sansPersonne: t.exposeInt('sansPersonne'),
    }),
  })

async function calculerAvancement(
  where: Prisma.TacheWhereInput,
  fuseau: string | undefined
) {
  const taches = await prisma.tache.findMany({
    where,
    select: {
      statut: true,
      echeance: true,
      perimetreId: true,
      _count: { select: { assignations: true } },
    },
  })
  const jour = aujourdhui(new Date(), fuseau)
  const parPerimetre = new Map<string, ReturnType<typeof avancementVide>>()
  for (const tache of taches) {
    const a = parPerimetre.get(tache.perimetreId) ?? avancementVide()
    a.total += 1
    if (tache.statut === 'A_FAIRE') a.aFaire += 1
    if (tache.statut === 'EN_COURS') a.enCours += 1
    if (tache.statut === 'FAITE') a.faites += 1
    if (tache.statut === 'ABANDONNEE') a.abandonnees += 1
    if (estEnRetard(tache, jour)) a.enRetard += 1
    const ouverte = tache.statut === 'A_FAIRE' || tache.statut === 'EN_COURS'
    if (ouverte && tache._count.assignations === 0) a.sansPersonne += 1
    parPerimetre.set(tache.perimetreId, a)
  }
  return parPerimetre
}

function avancementVide() {
  return {
    total: 0,
    aFaire: 0,
    enCours: 0,
    faites: 0,
    abandonnees: 0,
    enRetard: 0,
    sansPersonne: 0,
  }
}

const AvancementPerimetreRef = builder
  .objectRef<{
    perimetreId: string
    avancement: ReturnType<typeof avancementVide>
  }>('AvancementPerimetre')
  .implement({
    fields: t => ({
      perimetre: t.prismaField({
        type: PerimetreRef,
        resolve: (query, parent) =>
          prisma.perimetre.findUniqueOrThrow({
            ...query,
            where: { id: parent.perimetreId },
          }),
      }),
      avancement: t.field({
        type: AvancementRef,
        resolve: parent => parent.avancement,
      }),
    }),
  })

// Contacts principaux d'une édition, lus une fois par requête GraphQL (ADR 0011).
// L'avancement global demande le contact et les référent·es de chaque périmètre :
// les deux champs partagent cette lecture au lieu de relire la base par périmètre.
// L'édition a déjà été contrôlée par l'appelant.
const contactsParRequete = new WeakMap<
  AppContext,
  Map<string, Promise<Map<string, User>>>
>()

function contactsDeLEdition(
  ctx: AppContext,
  editionId: string
): Promise<Map<string, User>> {
  let parEdition = contactsParRequete.get(ctx)
  if (parEdition === undefined) {
    parEdition = new Map()
    contactsParRequete.set(ctx, parEdition)
  }
  let contacts = parEdition.get(editionId)
  if (contacts === undefined) {
    contacts = prisma.affectation
      .findMany({
        where: { editionId, contactPrincipal: true },
        include: { user: true },
      })
      .then(lignes => new Map(lignes.map(l => [l.perimetreId, l.user])))
    parEdition.set(editionId, contacts)
  }
  return contacts
}

const ORDRE_TACHES: Prisma.TacheOrderByWithRelationInput[] = [
  { echeance: { sort: 'asc', nulls: 'last' } },
  { createdAt: 'asc' },
]

// ── Champs ajoutés au périmètre ──────────────────────────────────────────────

const AccesPerimetreEnum = builder.enumType('AccesPerimetre', {
  values: ['COMPLET', 'CONSULTATION', 'AUCUN'] as const,
})

builder.prismaObjectFields(PerimetreRef, t => ({
  taches: t.prismaField({
    type: [TacheRef],
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, perimetre, { editionId }, ctx) => {
      await exigerConsultation(ctx, perimetre)
      const edition = await ctx.exigerEdition(editionId)
      return prisma.tache.findMany({
        ...query,
        where: { perimetreId: perimetre.id, editionId: edition.id },
        orderBy: ORDRE_TACHES,
      })
    },
  }),

  // Les personnes affectées au périmètre pour l'édition : les co-référent·es. Le
  // contact principal vient en tête, les autres suivent par nom (ADR 0011).
  referents: t.prismaField({
    type: [PersonneRef],
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, perimetre, { editionId }, ctx) => {
      await exigerConsultation(ctx, perimetre)
      const edition = await ctx.exigerEdition(editionId)
      const [personnes, contacts] = await Promise.all([
        prisma.user.findMany({
          ...query,
          where: {
            affectations: {
              some: { perimetreId: perimetre.id, editionId: edition.id },
            },
          },
          orderBy: { name: 'asc' },
        }),
        contactsDeLEdition(ctx, edition.id),
      ])
      const contactId = contacts.get(perimetre.id)?.id
      const enTete = (id: string) => (id === contactId ? 0 : 1)
      return personnes.sort((p, q) => enTete(p.id) - enTete(q.id))
    },
  }),

  // Le contact principal du périmètre pour l'édition, s'il est désigné. Il se lit
  // comme les référent·es : c'est une information, sans droit (ADR 0011).
  contactPrincipal: t.field({
    type: PersonneRef,
    nullable: true,
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (perimetre, { editionId }, ctx) => {
      await exigerConsultation(ctx, perimetre)
      const edition = await ctx.exigerEdition(editionId)
      return (
        (await contactsDeLEdition(ctx, edition.id)).get(perimetre.id) ?? null
      )
    },
  }),

  avancement: t.field({
    type: AvancementRef,
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (perimetre, { editionId }, ctx) => {
      await exigerConsultation(ctx, perimetre)
      const edition = await ctx.exigerEdition(editionId)
      const resultat = await calculerAvancement(
        { perimetreId: perimetre.id, editionId: edition.id },
        ctx.organisation?.fuseauHoraire
      )
      return resultat.get(perimetre.id) ?? avancementVide()
    },
  }),

  peutModifier: t.boolean({
    args: { editionId: t.arg.id({ required: true }) },
    resolve: (perimetre, { editionId }, ctx) =>
      peutModifierPerimetre(ctx, perimetre.id, String(editionId)),
  }),

  acces: t.field({
    type: AccesPerimetreEnum,
    description:
      'Accès de la personne connectée au périmètre (ADR 0014). COMPLET : elle lit ses tâches et ses fiches. CONSULTATION : elle lit ses tâches, son avancement et son équipe, sans ses fiches. AUCUN : elle ne lit ni ses tâches, ni son avancement, ni son équipe, ni ses fiches. Le nom et la description du périmètre restent lisibles en découverte (ADR 0012).',
    resolve: (perimetre, _args, ctx) => accesAuPerimetre(ctx, perimetre),
  }),
}))

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryFields(t => ({
  perimetre: t.prismaField({
    type: PerimetreRef,
    nullable: true,
    authScopes: { connecte: true },
    args: {
      slug: t.arg.string({ required: true }),
      activiteId: t.arg.id(),
    },
    resolve: async (query, _root, { slug, activiteId }, ctx) => {
      const perimetre = await prisma.perimetre.findUnique({
        ...query,
        where: {
          activiteId_slug: {
            activiteId: await ctx.exigerActivite(activiteId),
            slug,
          },
        },
      })
      // Un périmètre inconnu et un périmètre interdit donnent la même réponse.
      if (perimetre === null) {
        if (ctx.personne?.estAdmin) return null
        throw accesRefuse()
      }
      await exigerConsultation(ctx, perimetre)
      return perimetre
    },
  }),

  // Les périmètres accessibles en lecture dans l'organisation active : tous ceux qui
  // ne sont pas archivés pour un admin, sinon ceux où la personne a été affectée au
  // moins une fois. Avec `activiteId`, ceux de cette activité seulement.
  mesPerimetres: t.prismaField({
    type: [PerimetreRef],
    authScopes: { connecte: true },
    args: { activiteId: t.arg.id() },
    resolve: async (query, _root, { activiteId }, ctx) => {
      const lisibles = await perimetresLisibles(ctx)
      const activite =
        activiteId === null || activiteId === undefined
          ? {}
          : { activiteId: await ctx.exigerActivite(activiteId) }
      return prisma.perimetre.findMany({
        ...query,
        where: {
          id: { in: lisibles },
          ...activite,
          // Un admin voit tous les périmètres des activités qu'il administre : les
          // archivés de ces activités n'encombrent pas sa liste. Une personne garde
          // les périmètres archivés où elle a été affectée.
          OR: [
            { archivedAt: null },
            { activiteId: { notIn: [...(await ctx.activitesAdministrees())] } },
          ],
        },
        orderBy: [{ type: 'asc' }, { ordre: 'asc' }, { nom: 'asc' }],
      })
    },
  }),

  mesTaches: t.prismaField({
    type: [TacheRef],
    authScopes: { connecte: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, _root, { editionId }, ctx) =>
      prisma.tache.findMany({
        ...query,
        where: {
          editionId: (await ctx.exigerEdition(editionId)).id,
          statut: { in: ['A_FAIRE', 'EN_COURS'] },
          assignations: { some: { userId: ctx.personne!.id } },
        },
        orderBy: ORDRE_TACHES,
      }),
  }),

  // Toutes les tâches d'une édition, triées par échéance, dans les périmètres non
  // archivés de son activité. Toute personne qui voit l'activité les consulte
  // (ADR 0014) : exigerEdition refuse l'édition d'une activité invisible.
  retroplanning: t.prismaField({
    type: [TacheRef],
    authScopes: { connecte: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, _root, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      return prisma.tache.findMany({
        ...query,
        where: {
          editionId: edition.id,
          perimetre: { archivedAt: null },
        },
        orderBy: ORDRE_TACHES,
      })
    },
  }),

  // Les tâches ouvertes sans personne dans les périmètres de la personne.
  tachesAPrendre: t.prismaField({
    type: [TacheRef],
    authScopes: { connecte: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, _root, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      const perimetres = [...(await ctx.perimetresAffectes(edition.id))]
      return prisma.tache.findMany({
        ...query,
        where: {
          editionId: edition.id,
          perimetreId: { in: perimetres },
          statut: { in: ['A_FAIRE', 'EN_COURS'] },
          assignations: { none: {} },
        },
        orderBy: ORDRE_TACHES,
      })
    },
  }),

  avancementGlobal: t.field({
    type: [AvancementPerimetreRef],
    authScopes: { gestion: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      await ctx.exigerAdminDe(edition.activiteId)
      const [perimetres, parPerimetre] = await Promise.all([
        prisma.perimetre.findMany({
          where: { activiteId: edition.activiteId, archivedAt: null },
          select: { id: true },
          orderBy: [{ type: 'asc' }, { ordre: 'asc' }, { nom: 'asc' }],
        }),
        calculerAvancement(
          { editionId: edition.id },
          ctx.organisation?.fuseauHoraire
        ),
      ])
      return perimetres.map(p => ({
        perimetreId: p.id,
        avancement: parPerimetre.get(p.id) ?? avancementVide(),
      }))
    },
  }),
}))

// ── Écriture ─────────────────────────────────────────────────────────────────

type TacheChargee = Prisma.TacheGetPayload<{
  include: {
    assignations: { select: { userId: true } }
    perimetre: { select: { nom: true } }
  }
}>

async function chargerTache(id: string): Promise<TacheChargee> {
  const tache = await prisma.tache.findUnique({
    where: { id },
    include: {
      assignations: { select: { userId: true } },
      perimetre: { select: { nom: true } },
    },
  })
  if (tache === null) throw accesRefuse()
  return tache
}

/**
 * Règle de collaboration n° 2 : modifier une tâche assignée à d'autres personnes
 * demande une confirmation explicite. Sans elle, l'API refuse et renvoie les noms
 * des personnes concernées.
 */
async function exigerConfirmation(
  tache: TacheChargee,
  acteurId: string,
  confirmer: boolean
): Promise<string[]> {
  const autres = tache.assignations
    .map(a => a.userId)
    .filter(id => id !== acteurId)
  if (autres.length > 0 && !confirmer) {
    const personnes = await prisma.user.findMany({
      where: { id: { in: autres } },
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    throw new GraphQLError('Cette tâche est assignée à d’autres personnes.', {
      extensions: {
        code: 'CONFIRMATION_REQUISE',
        personnes: personnes.map(p => p.name),
      },
    })
  }
  return autres
}

function echeanceValide(echeance: Date | null | undefined): Date | null {
  return echeance ?? null
}

// Travail à plusieurs. Une modification du contenu porte la version que la personne
// a lue, et un changement de statut le statut qu'elle a vu : le serveur refuse
// d'écraser ce qu'une autre personne a écrit entre-temps. L'erreur dit l'état actuel,
// et l'interface propose de recharger ou d'écraser.

/**
 * Le contenu a changé depuis la version lue. L'erreur nomme la personne qui l'a
 * modifié : une modification du contenu n'est pas confidentielle, à la différence de
 * « qui a coché ».
 */
async function conflitDeContenu(tacheId: string): Promise<GraphQLError> {
  const [tache, derniere] = await Promise.all([
    prisma.tache.findUniqueOrThrow({
      where: { id: tacheId },
      select: { version: true, updatedAt: true },
    }),
    prisma.journal.findFirst({
      where: { tacheId, type: 'TACHE_MODIFIEE' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, acteur: { select: { name: true } } },
    }),
  ])
  return conflitDeVersion(
    'Une autre personne a modifié cette tâche depuis votre lecture.',
    {
      versionCourante: tache.version,
      modifieeLe: (derniere?.createdAt ?? tache.updatedAt).toISOString(),
      modifieePar: derniere?.acteur.name ?? null,
    }
  )
}

/**
 * Le statut a changé depuis la lecture. L'erreur ne nomme personne : qui a coché une
 * tâche reste réservé à la personne qui a coché et aux admins.
 */
function conflitDeStatut(statut: StatutTache): GraphQLError {
  return conflitDeVersion(
    'Le statut de cette tâche a changé depuis votre lecture.',
    { statutCourant: statut }
  )
}

async function exigerAffectee(
  personneId: string,
  tache: { perimetreId: string; editionId: string }
) {
  const affectation = await prisma.affectation.findFirst({
    where: {
      userId: personneId,
      perimetreId: tache.perimetreId,
      editionId: tache.editionId,
    },
    select: { id: true },
  })
  if (affectation === null) {
    throw erreurSaisie(
      'Cette personne n’est pas affectée à ce périmètre pour cette édition.'
    )
  }
}

/**
 * Une tâche se lie à une fiche commune de son activité ou à une fiche de son propre
 * périmètre.
 */
async function ficheValide(
  ficheId: string | number | null | undefined,
  perimetreId: string
): Promise<string | null> {
  if (ficheId === null || ficheId === undefined || ficheId === '') return null
  const [fiche, perimetre] = await Promise.all([
    prisma.fiche.findUnique({
      where: { id: String(ficheId) },
      select: { id: true, perimetreId: true, activiteId: true },
    }),
    prisma.perimetre.findUniqueOrThrow({
      where: { id: perimetreId },
      select: { activiteId: true },
    }),
  ])
  if (
    fiche === null ||
    fiche.activiteId !== perimetre.activiteId ||
    (fiche.perimetreId !== null && fiche.perimetreId !== perimetreId)
  ) {
    throw erreurSaisie('Cette fiche ne peut pas être liée à cette tâche.')
  }
  return fiche.id
}

builder.mutationFields(t => ({
  creerTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    args: {
      perimetreId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
      titre: t.arg.string({ required: true }),
      description: t.arg.string(),
      echeance: t.arg({ type: 'Date' }),
      ficheId: t.arg.id(),
      mAssigner: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      const perimetreId = String(args.perimetreId)
      const editionId = String(args.editionId)
      const acteur = await exigerEcriture(ctx, perimetreId, editionId)
      const ficheId = await ficheValide(args.ficheId, perimetreId)
      const creee = await prisma.$transaction(async tx => {
        const tache = await tx.tache.create({
          data: {
            perimetreId,
            editionId,
            titre: texteRequis(args.titre, 'Le titre', 200),
            description: args.description?.trim() || null,
            echeance: echeanceValide(args.echeance),
            ficheId,
            creeParId: acteur.id,
            ...(args.mAssigner
              ? { assignations: { create: { userId: acteur.id } } }
              : {}),
          },
        })
        await tx.journal.create({
          data: {
            type: 'TACHE_CREEE',
            acteurId: acteur.id,
            editionId,
            perimetreId,
            tacheId: tache.id,
          },
        })
        return tx.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      })
      // Règle n° 3 : les autres référent·es du périmètre le voient dans leur résumé.
      await notifier(prisma, {
        type: 'TACHE_CREEE',
        destinataires: await referentsSauf(
          prisma,
          perimetreId,
          editionId,
          acteur.id
        ),
        acteurId: acteur.id,
        tacheId: creee.id,
        perimetreId,
      })
      return creee
    },
  }),

  modifierTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    description:
      'Modifie le contenu d’une tâche. Un champ absent ne change pas ; null efface la description, l’échéance ou la fiche. Avec `versionAttendue`, le serveur refuse d’écraser une modification faite depuis cette version (code `CONFLIT_VERSION`).',
    args: {
      id: t.arg.id({ required: true }),
      titre: t.arg.string(),
      description: t.arg.string(),
      echeance: t.arg({ type: 'Date' }),
      ficheId: t.arg.id(),
      versionAttendue: t.arg.int(),
      confirmer: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      // Le conflit se dit avant la confirmation : la personne ne confirme pas une
      // écriture que le serveur refusera.
      const versionAttendue = args.versionAttendue ?? null
      if (versionAttendue !== null && versionAttendue !== tache.version) {
        throw await conflitDeContenu(tache.id)
      }
      const donnees = {
        ...(args.titre === undefined
          ? {}
          : { titre: texteRequis(args.titre ?? '', 'Le titre', 200) }),
        ...(args.description === undefined
          ? {}
          : { description: args.description?.trim() || null }),
        ...(args.echeance === undefined
          ? {}
          : { echeance: echeanceValide(args.echeance) }),
        ...(args.ficheId === undefined
          ? {}
          : { ficheId: await ficheValide(args.ficheId, tache.perimetreId) }),
      }
      const relire = () =>
        prisma.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      if (Object.keys(donnees).length === 0) return relire()
      const autres = await exigerConfirmation(
        tache,
        acteur.id,
        args.confirmer ?? false
      )
      const ecrite = await prisma.$transaction(async tx => {
        // L'écriture porte la version attendue : une modification simultanée ne
        // trouve plus la ligne. Sans version attendue, la dernière écriture gagne.
        const { count } = await tx.tache.updateMany({
          where: {
            id: tache.id,
            ...(versionAttendue === null ? {} : { version: versionAttendue }),
          },
          data: { ...donnees, version: { increment: 1 } },
        })
        if (count === 0) return false
        await tx.journal.create({
          data: {
            type: 'TACHE_MODIFIEE',
            acteurId: acteur.id,
            editionId: tache.editionId,
            perimetreId: tache.perimetreId,
            tacheId: tache.id,
          },
        })
        return true
      })
      if (!ecrite) throw await conflitDeContenu(tache.id)
      // Règle n° 2 : les personnes assignées sont prévenues tout de suite, par mail.
      await notifier(
        prisma,
        {
          type: 'TACHE_MODIFIEE',
          destinataires: autres,
          acteurId: acteur.id,
          tacheId: tache.id,
          perimetreId: tache.perimetreId,
          changement: 'contenu',
        },
        { mailImmediat: true }
      )
      return relire()
    },
  }),

  changerStatutTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    description:
      'Change le statut d’une tâche. Demander le statut qu’elle a déjà ne change rien. Avec `statutAttendu`, le serveur refuse de changer un statut qu’une autre personne a modifié entre-temps (code `CONFLIT_VERSION`).',
    args: {
      id: t.arg.id({ required: true }),
      statut: t.arg({ type: StatutTacheEnum, required: true }),
      realiseeParId: t.arg.id(),
      statutAttendu: t.arg({ type: StatutTacheEnum }),
      confirmer: t.arg.boolean({ defaultValue: false }),
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
      // La tâche a déjà ce statut : rien ne s'écrit. Deux personnes qui cochent la
      // même tâche ne produisent ni second journal ni second mail, et la première
      // garde les points de la réalisation.
      if (tache.statut === args.statut) return relire()
      const statutAttendu = args.statutAttendu ?? null
      if (statutAttendu !== null && statutAttendu !== tache.statut) {
        throw conflitDeStatut(tache.statut)
      }
      const autres = await exigerConfirmation(
        tache,
        acteur.id,
        args.confirmer ?? false
      )
      const faite = args.statut === 'FAITE'
      const realiseeParId =
        faite && args.realiseeParId ? String(args.realiseeParId) : null
      if (realiseeParId !== null) await exigerAffectee(realiseeParId, tache)

      const ecrite = await prisma.$transaction(async tx => {
        // L'écriture porte le statut lu : un changement simultané ne trouve plus la
        // ligne.
        const { count } = await tx.tache.updateMany({
          where: { id: tache.id, statut: tache.statut },
          data: {
            statut: args.statut,
            // Rouvrir une tâche efface qui l'avait cochée et réalisée.
            termineeLe: faite ? new Date() : null,
            clotureeParId: faite ? acteur.id : null,
            realiseeParId,
          },
        })
        if (count === 0) return false
        await tx.journal.create({
          data: {
            type: 'TACHE_STATUT',
            acteurId: acteur.id,
            editionId: tache.editionId,
            perimetreId: tache.perimetreId,
            tacheId: tache.id,
            statut: args.statut,
            realiseeParId,
          },
        })
        return true
      })
      if (!ecrite) {
        // Une autre personne a changé le statut entre la lecture et l'écriture.
        const actuelle = await prisma.tache.findUniqueOrThrow({
          where: { id: tache.id },
          select: { statut: true },
        })
        if (actuelle.statut === args.statut) return relire()
        throw conflitDeStatut(actuelle.statut)
      }
      await notifier(
        prisma,
        {
          type: 'TACHE_MODIFIEE',
          destinataires: autres,
          acteurId: acteur.id,
          tacheId: tache.id,
          perimetreId: tache.perimetreId,
          changement: 'statut',
        },
        { mailImmediat: true }
      )
      return relire()
    },
  }),

  // Une personne s'assigne ou se retire elle-même. Les admins peuvent assigner une
  // autre personne affectée au périmètre.
  assignerTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    args: {
      id: t.arg.id({ required: true }),
      assigne: t.arg.boolean({ required: true }),
      personneId: t.arg.id(),
    },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      const personneId = args.personneId ? String(args.personneId) : acteur.id
      // Assigner une autre personne revient à l'admin de l'activité de la tâche.
      if (
        personneId !== acteur.id &&
        !(await ctx.estAdminDe(await activiteDuPerimetre(tache.perimetreId)))
      ) {
        throw accesRefuse()
      }
      if (args.assigne) await exigerAffectee(personneId, tache)

      const dejaAssignee = tache.assignations.some(a => a.userId === personneId)
      // Deux requêtes simultanées lisent la même assignation absente, ou présente.
      // La seconde ne trouve plus rien à écrire : le résultat est celui demandé, sans
      // second journal ni seconde notification.
      const ecrite =
        dejaAssignee !== args.assigne &&
        (await prisma
          .$transaction(async tx => {
            if (args.assigne) {
              await tx.tacheAssignation.create({
                data: { tacheId: tache.id, userId: personneId },
              })
            } else {
              const { count } = await tx.tacheAssignation.deleteMany({
                where: { tacheId: tache.id, userId: personneId },
              })
              if (count === 0) return false
            }
            await tx.journal.create({
              data: {
                type: args.assigne ? 'TACHE_ASSIGNEE' : 'TACHE_DESASSIGNEE',
                acteurId: acteur.id,
                editionId: tache.editionId,
                perimetreId: tache.perimetreId,
                tacheId: tache.id,
                personneId,
              },
            })
            return true
          })
          .catch((erreur: unknown) => {
            // P2002 : l'assignation existe déjà.
            if ((erreur as { code?: string }).code !== 'P2002') throw erreur
            return false
          }))
      if (ecrite) {
        // Règle n° 3 : les autres référent·es voient qui fait quoi dans leur résumé.
        // La personne assignée par un admin l'apprend aussi.
        await notifier(prisma, {
          type: args.assigne ? 'TACHE_ASSIGNEE' : 'TACHE_DESASSIGNEE',
          destinataires: [
            ...(await referentsSauf(
              prisma,
              tache.perimetreId,
              tache.editionId,
              acteur.id
            )),
            personneId,
          ],
          acteurId: acteur.id,
          tacheId: tache.id,
          perimetreId: tache.perimetreId,
          personneId,
        })
      }
      return prisma.tache.findUniqueOrThrow({
        ...query,
        where: { id: tache.id },
      })
    },
  }),
}))

/** L'activité d'un périmètre, pour les contrôles d'admin d'activité (ADR 0010). */
async function activiteDuPerimetre(perimetreId: string): Promise<string> {
  const perimetre = await prisma.perimetre.findUniqueOrThrow({
    where: { id: perimetreId },
    select: { activiteId: true },
  })
  return perimetre.activiteId
}
