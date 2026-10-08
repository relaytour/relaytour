import {
  AccordDeclinaison,
  prisma,
  StatutTache,
  type Prisma,
  type TypeJournal,
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
import {
  CIBLES_MAX,
  resumerDeclinaisons,
  TACHES_ACTIVES,
  type ResumeDeclinaisons,
} from '../lib/declinaisons.ts'
import { accesRefuse, conflitDeVersion, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourPerimetre } from '../lib/flux.ts'
import {
  notifier,
  notifierLePerimetre,
  referentsAPrevenir,
} from '../lib/notifications.ts'
import { texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'

export const StatutTacheEnum = builder.enumType(StatutTache, {
  name: 'StatutTache',
})

// Accord d'un périmètre cible sur une déclinaison (ADR 0026).
const AccordDeclinaisonEnum = builder.enumType(AccordDeclinaison, {
  name: 'AccordDeclinaison',
  description:
    'Accord du périmètre cible sur une déclinaison. EN_ATTENTE : la déclinaison est proposée et ne compte pas encore parmi les tâches du périmètre.',
})

// Les étapes de l'accord d'une déclinaison, lues dans le journal par les admins.
const ETAPES_ACCORD = {
  DECLINAISON_PROPOSEE: 'PROPOSEE',
  DECLINAISON_ACCEPTEE: 'ACCEPTEE',
  DECLINAISON_REFUSEE: 'REFUSEE',
  DECLINAISON_IMPOSEE: 'IMPOSEE',
} as const satisfies Partial<Record<TypeJournal, string>>
type TypeAccord = keyof typeof ETAPES_ACCORD

const EtapeAccordEnum = builder.enumType('EtapeAccord', {
  description:
    'Étape de l’accord d’une déclinaison. IMPOSEE : un admin de l’activité l’a ajoutée sans accord du périmètre.',
  values: Object.values(ETAPES_ACCORD),
})

const EtapeAccordRef = builder
  .objectRef<{ type: TypeAccord; createdAt: Date; acteur: User }>(
    'EtapeAccordDeclinaison'
  )
  .implement({
    description:
      'Une étape de l’accord d’une déclinaison : qui l’a proposée, acceptée, refusée ou imposée, et quand.',
    fields: t => ({
      etape: t.field({
        type: EtapeAccordEnum,
        resolve: e => ETAPES_ACCORD[e.type],
      }),
      le: t.field({ type: 'DateTime', resolve: e => e.createdAt }),
      par: t.field({ type: PersonneRef, resolve: e => e.acteur }),
    }),
  })

const ResumeDeclinaisonsRef = builder
  .objectRef<ResumeDeclinaisons>('ResumeDeclinaisons')
  .implement({
    description:
      'L’état des déclinaisons d’une tâche partagée, en nombres. Les nombres `faites` et `abandonnees` se comptent parmi les déclinaisons acceptées.',
    fields: t => ({
      total: t.exposeInt('total'),
      enAttente: t.exposeInt('enAttente'),
      refusees: t.exposeInt('refusees'),
      acceptees: t.exposeInt('acceptees'),
      faites: t.exposeInt('faites'),
      abandonnees: t.exposeInt('abandonnees'),
    }),
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
    // Tâche partagée et déclinaisons (ADR 0026). Les deux tâches appartiennent à la
    // même activité : qui consulte l'une consulte l'autre (ADR 0014).
    origine: t.relation('origine', {
      nullable: true,
      description:
        'La tâche partagée dont cette tâche est la déclinaison, ou null.',
    }),
    declinaisons: t.relation('declinaisons', {
      description:
        'Les déclinaisons de cette tâche partagée, une par périmètre cible, quel que soit leur accord. Vide pour une tâche ordinaire et pour une déclinaison.',
      query: {
        orderBy: [
          { perimetre: { ordre: 'asc' } },
          { perimetre: { nom: 'asc' } },
        ],
      },
    }),
    // Le résumé se charge avec la tâche et coûte peu : une liste de tâches le lit,
    // et garde le détail des déclinaisons pour la requête d'une seule tâche.
    resumeDeclinaisons: t.field({
      type: ResumeDeclinaisonsRef,
      description:
        'L’état des déclinaisons de cette tâche partagée, en nombres. Tous à zéro pour une tâche ordinaire et pour une déclinaison.',
      select: { declinaisons: { select: { statut: true, accord: true } } },
      resolve: tache => resumerDeclinaisons(tache.declinaisons),
    }),
    accord: t.expose('accord', {
      type: AccordDeclinaisonEnum,
      nullable: true,
      description:
        'Pour une déclinaison : l’accord de son périmètre. Null pour une tâche ordinaire et pour une tâche partagée.',
    }),
    // Qui a proposé, accepté, refusé ou imposé une déclinaison : cet historique
    // n'est lisible que par les admins de l'activité. Les autres lisent une liste
    // vide.
    historiqueAccord: t.field({
      type: [EtapeAccordRef],
      select: { perimetre: { select: { activiteId: true } } },
      resolve: async (tache, _args, ctx) => {
        if (tache.origineId === null) return []
        if (!(await ctx.estAdminDe(tache.perimetre.activiteId))) return []
        const lignes = await prisma.journal.findMany({
          where: {
            tacheId: tache.id,
            type: { in: Object.keys(ETAPES_ACCORD) as TypeAccord[] },
          },
          orderBy: { createdAt: 'asc' },
          select: { type: true, createdAt: true, acteur: true },
        })
        return lignes.map(l => ({ ...l, type: l.type as TypeAccord }))
      },
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
  // Une déclinaison qui attend un accord, ou refusée, ne compte pas (ADR 0026).
  const taches = await prisma.tache.findMany({
    where: { AND: [where, TACHES_ACTIVES] },
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
        where: {
          perimetreId: perimetre.id,
          editionId: edition.id,
          AND: [TACHES_ACTIVES],
        },
        orderBy: ORDRE_TACHES,
      })
    },
  }),

  // Les déclinaisons proposées au périmètre, qui attendent son accord (ADR 0026).
  // Elles ne figurent pas encore parmi ses tâches.
  declinaisonsProposees: t.prismaField({
    type: [TacheRef],
    args: { editionId: t.arg.id({ required: true }) },
    description:
      'Les déclinaisons proposées à ce périmètre pour la période, en attente de son accord.',
    resolve: async (query, perimetre, { editionId }, ctx) => {
      await exigerConsultation(ctx, perimetre)
      const edition = await ctx.exigerEdition(editionId)
      return prisma.tache.findMany({
        ...query,
        where: {
          perimetreId: perimetre.id,
          editionId: edition.id,
          accord: 'EN_ATTENTE',
        },
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

  // Une tâche, pour lire ses déclinaisons et leur accord (ADR 0026). Toute personne
  // qui consulte son périmètre la lit (ADR 0014). Une tâche inconnue et une tâche
  // interdite donnent la même réponse.
  tache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, { id }, ctx) => {
      const tache = await prisma.tache.findUnique({
        where: { id: String(id) },
        select: {
          perimetre: {
            select: { id: true, activiteId: true, organisationId: true },
          },
        },
      })
      if (tache === null) throw accesRefuse()
      await exigerConsultation(ctx, tache.perimetre)
      return prisma.tache.findUniqueOrThrow({
        ...query,
        where: { id: String(id) },
      })
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
          AND: [TACHES_ACTIVES],
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
          AND: [TACHES_ACTIVES],
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
          AND: [TACHES_ACTIVES],
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
    origine: { select: { perimetreId: true } }
  }
}>

async function chargerTache(id: string): Promise<TacheChargee> {
  const tache = await prisma.tache.findUnique({
    where: { id },
    include: {
      assignations: { select: { userId: true } },
      perimetre: { select: { nom: true } },
      // Le périmètre de la tâche partagée, pour le prévenir (ADR 0026).
      origine: { select: { perimetreId: true } },
    },
  })
  if (tache === null) throw accesRefuse()
  return tache
}

/**
 * Une déclinaison qui attend un accord, ou refusée, n'est pas encore une tâche de
 * son périmètre : elle ne se modifie pas, ne change pas de statut et ne s'assigne
 * pas (ADR 0026).
 */
function exigerDeclinaisonAcceptee(tache: {
  accord: AccordDeclinaison | null
}) {
  if (tache.accord === 'EN_ATTENTE') {
    throw erreurSaisie(
      'Cette déclinaison attend l’accord de son périmètre : acceptez-la d’abord.'
    )
  }
  if (tache.accord === 'REFUSE') {
    throw erreurSaisie('Cette déclinaison a été refusée par son périmètre.')
  }
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
  // La version et le journal qui l'a produite s'écrivent dans une même transaction.
  // Les deux lectures partagent un même instantané : la fenêtre ne nomme pas
  // l'auteur d'une version et le numéro d'une autre.
  const [tache, derniere] = await prisma.$transaction(
    [
      prisma.tache.findUniqueOrThrow({
        where: { id: tacheId },
        select: { version: true, updatedAt: true },
      }),
      prisma.journal.findFirst({
        where: { tacheId, type: 'TACHE_MODIFIEE' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, acteur: { select: { name: true } } },
      }),
    ],
    { isolationLevel: 'RepeatableRead' }
  )
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

// ── Tâches partagées (ADR 0026) ──────────────────────────────────────────────

const DeclinaisonInput = builder.inputType('DeclinaisonInput', {
  description:
    'Les périmètres où décliner une tâche partagée. Un texte ou une échéance absents reprennent ceux de la tâche partagée.',
  fields: t => ({
    perimetreIds: t.idList({ required: true }),
    titre: t.string(),
    description: t.string(),
    echeance: t.field({ type: 'Date' }),
  }),
})

interface TextesDeclinaison {
  titre?: string | null
  description?: string | null
  echeance?: Date | null
}

interface CibleValide {
  id: string
  /** Vrai quand la déclinaison entre dans le périmètre sans attendre son accord. */
  acceptee: boolean
  /** Vrai quand un admin de l'activité l'ajoute : aucun accord n'est demandé. */
  parAdmin: boolean
}

/**
 * Les périmètres cibles d'une tâche partagée. Ils appartiennent à l'activité de la
 * tâche et ne sont pas archivés. Un périmètre inconnu, d'une autre organisation ou
 * d'une autre activité donne le même refus.
 *
 * Une déclinaison attend l'accord de son périmètre, sauf dans deux cas : un admin de
 * l'activité l'ajoute, ou la personne écrit déjà dans le périmètre cible.
 */
async function ciblesValides(
  ctx: AppContext,
  perimetreIds: readonly (string | number)[],
  origine: { perimetreId: string; editionId: string }
): Promise<CibleValide[]> {
  const ids = [...new Set(perimetreIds.map(String))]
  if (ids.length === 0) {
    throw erreurSaisie('Choisissez au moins un périmètre.')
  }
  if (ids.length > CIBLES_MAX) {
    throw erreurSaisie(
      `Une tâche se décline dans ${CIBLES_MAX} périmètres au plus.`
    )
  }
  if (ids.includes(origine.perimetreId)) {
    throw erreurSaisie('Une tâche ne se décline pas dans son propre périmètre.')
  }
  const activiteId = await activiteDuPerimetre(origine.perimetreId)
  const perimetres = await prisma.perimetre.findMany({
    where: {
      id: { in: ids },
      organisationId: ctx.organisation!.id,
      activiteId,
    },
    select: { id: true, nom: true, archivedAt: true },
  })
  if (perimetres.length !== ids.length) throw accesRefuse()
  const archive = perimetres.find(p => p.archivedAt !== null)
  if (archive !== undefined) {
    throw erreurSaisie(`Le périmètre « ${archive.nom} » est archivé.`)
  }
  const parAdmin = await ctx.estAdminDe(activiteId)
  return Promise.all(
    ids.map(async id => ({
      id,
      parAdmin,
      acceptee:
        parAdmin || (await peutModifierPerimetre(ctx, id, origine.editionId)),
    }))
  )
}

/**
 * Crée une déclinaison par périmètre cible, dans la transaction de l'appelant. Une
 * déclinaison ne cite qu'une fiche commune : celle de la tâche partagée, si elle
 * l'est.
 */
async function creerDeclinaisons(
  tx: Prisma.TransactionClient,
  origine: {
    id: string
    editionId: string
    titre: string
    description: string | null
    echeance: Date | null
    ficheId: string | null
  },
  cibles: readonly CibleValide[],
  textes: TextesDeclinaison,
  acteurId: string
): Promise<(CibleValide & { tacheId: string })[]> {
  const fiche =
    origine.ficheId === null
      ? null
      : await tx.fiche.findUnique({
          where: { id: origine.ficheId },
          select: { id: true, perimetreId: true },
        })
  const titre = textes.titre?.trim()
    ? texteRequis(textes.titre, 'Le titre de la déclinaison', 200)
    : origine.titre
  const description =
    textes.description === undefined || textes.description === null
      ? origine.description
      : textes.description.trim() || null
  const echeance =
    textes.echeance === undefined || textes.echeance === null
      ? origine.echeance
      : textes.echeance
  const creees: (CibleValide & { tacheId: string })[] = []
  for (const cible of cibles) {
    const declinaison = await tx.tache.create({
      data: {
        editionId: origine.editionId,
        perimetreId: cible.id,
        titre,
        description,
        echeance,
        ficheId: fiche !== null && fiche.perimetreId === null ? fiche.id : null,
        creeParId: acteurId,
        origineId: origine.id,
        accord: cible.acceptee ? 'ACCEPTE' : 'EN_ATTENTE',
        ...(cible.acceptee
          ? { accordParId: acteurId, accordLe: new Date() }
          : {}),
      },
      select: { id: true },
    })
    await tx.journal.create({
      data: {
        type: !cible.acceptee
          ? 'DECLINAISON_PROPOSEE'
          : cible.parAdmin
            ? 'DECLINAISON_IMPOSEE'
            : 'DECLINAISON_ACCEPTEE',
        acteurId,
        editionId: origine.editionId,
        perimetreId: cible.id,
        tacheId: declinaison.id,
      },
    })
    creees.push({ ...cible, tacheId: declinaison.id })
  }
  return creees
}

/**
 * Signale les déclinaisons créées et prévient leur périmètre, dans l'application
 * seulement : une déclinaison proposée attend un accord, une déclinaison acceptée
 * entre parmi les tâches du périmètre.
 */
async function annoncerDeclinaisons(
  declinaisons: readonly (CibleValide & { tacheId: string })[],
  editionId: string,
  acteurId: string
) {
  for (const declinaison of declinaisons) {
    publierPourPerimetre('TACHE', declinaison.id, {
      id: declinaison.tacheId,
      editionId,
    })
    await notifier(prisma, {
      type: declinaison.acceptee ? 'TACHE_CREEE' : 'DECLINAISON_PROPOSEE',
      destinataires: await referentsAPrevenir(
        prisma,
        declinaison.id,
        editionId,
        acteurId
      ),
      acteurId,
      tacheId: declinaison.tacheId,
      perimetreId: declinaison.id,
    })
  }
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
      // Avec une déclinaison, la tâche créée est une tâche partagée (ADR 0026).
      declinaison: t.arg({ type: DeclinaisonInput }),
    },
    resolve: async (query, _root, args, ctx) => {
      const perimetreId = String(args.perimetreId)
      const editionId = String(args.editionId)
      const acteur = await exigerEcriture(ctx, perimetreId, editionId)
      const ficheId = await ficheValide(args.ficheId, perimetreId)
      const cibles = args.declinaison
        ? await ciblesValides(ctx, args.declinaison.perimetreIds, {
            perimetreId,
            editionId,
          })
        : []
      let declinaisons: (CibleValide & { tacheId: string })[] = []
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
        if (cibles.length > 0) {
          declinaisons = await creerDeclinaisons(
            tx,
            tache,
            cibles,
            args.declinaison ?? {},
            acteur.id
          )
        }
        return tx.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      })
      publierPourPerimetre('TACHE', perimetreId, { id: creee.id, editionId })
      await annoncerDeclinaisons(declinaisons, editionId, acteur.id)
      // Règle n° 3 : les autres référent·es du périmètre le voient dans leur résumé.
      await notifier(prisma, {
        type: 'TACHE_CREEE',
        destinataires: await referentsAPrevenir(
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
      exigerDeclinaisonAcceptee(tache)
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
      publierPourPerimetre('TACHE', tache.perimetreId, {
        id: tache.id,
        editionId: tache.editionId,
      })
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
      // Les autres référentes et référents l'apprennent dans l'application.
      await notifierLePerimetre(prisma, {
        type: 'TACHE_MODIFIEE',
        perimetreId: tache.perimetreId,
        editionId: tache.editionId,
        acteurId: acteur.id,
        tacheId: tache.id,
        sauf: autres,
      })
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
      exigerDeclinaisonAcceptee(tache)
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
      publierPourPerimetre('TACHE', tache.perimetreId, {
        id: tache.id,
        editionId: tache.editionId,
      })
      // Les personnes assignées sont prévenues tout de suite, par mail. Un passage à
      // « faite » ne leur nomme personne, ni dans l'application ni dans le mail.
      await notifier(
        prisma,
        {
          type: faite ? 'TACHE_STATUT' : 'TACHE_MODIFIEE',
          destinataires: autres,
          acteurId: acteur.id,
          tacheId: tache.id,
          perimetreId: tache.perimetreId,
          changement: 'statut',
          ...(faite ? { statut: 'FAITE' as const } : {}),
        },
        { mailImmediat: true }
      )
      // Les autres référentes et référents l'apprennent dans l'application. Un
      // passage à « faite » ne leur nomme personne.
      await notifierLePerimetre(prisma, {
        type: 'TACHE_STATUT',
        perimetreId: tache.perimetreId,
        editionId: tache.editionId,
        acteurId: acteur.id,
        tacheId: tache.id,
        statut: args.statut,
        sauf: autres,
      })
      // Le périmètre de la tâche partagée suit l'avancement de ses déclinaisons
      // (ADR 0026), dans l'application seulement.
      if (tache.origine !== null) {
        publierPourPerimetre('TACHE', tache.origine.perimetreId, {
          id: tache.origineId ?? undefined,
          editionId: tache.editionId,
        })
        await notifierLePerimetre(prisma, {
          type: 'TACHE_STATUT',
          perimetreId: tache.origine.perimetreId,
          editionId: tache.editionId,
          acteurId: acteur.id,
          tacheId: tache.id,
          statut: args.statut,
          sauf: autres,
        })
      }
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
      exigerDeclinaisonAcceptee(tache)
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
        publierPourPerimetre('TACHE', tache.perimetreId, {
          id: tache.id,
          editionId: tache.editionId,
        })
        // Règle n° 3 : les autres référent·es voient qui fait quoi dans leur résumé.
        // La personne assignée par un admin l'apprend aussi.
        await notifier(prisma, {
          type: args.assigne ? 'TACHE_ASSIGNEE' : 'TACHE_DESASSIGNEE',
          destinataires: [
            ...(await referentsAPrevenir(
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

  // Décline une tâche de son périmètre dans d'autres périmètres de l'activité
  // (ADR 0026). Un périmètre qui porte déjà sa déclinaison est ignoré.
  declinerTache: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    description:
      'Décline une tâche dans d’autres périmètres de son activité : elle devient une tâche partagée. Chaque déclinaison attend l’accord de son périmètre, sauf quand un admin de l’activité l’ajoute. Un périmètre déjà servi est ignoré.',
    args: {
      id: t.arg.id({ required: true }),
      perimetreIds: t.arg.idList({ required: true }),
      titre: t.arg.string(),
      description: t.arg.string(),
      echeance: t.arg({ type: 'Date' }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      if (tache.origineId !== null) {
        throw erreurSaisie('Une déclinaison ne se décline pas.')
      }
      const voulues = await ciblesValides(ctx, args.perimetreIds, tache)
      const relire = () =>
        prisma.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      const servies = new Set(
        (
          await prisma.tache.findMany({
            where: { origineId: tache.id },
            select: { perimetreId: true },
          })
        ).map(d => d.perimetreId)
      )
      const cibles = voulues.filter(c => !servies.has(c.id))
      if (cibles.length === 0) return relire()
      const declinaisons = await prisma
        .$transaction(tx =>
          creerDeclinaisons(tx, tache, cibles, args, acteur.id)
        )
        .catch((erreur: unknown) => {
          // P2002 : une autre requête vient de servir un de ces périmètres. Rien
          // n'est écrit ici : la personne relit la tâche et recommence au besoin.
          if ((erreur as { code?: string }).code !== 'P2002') throw erreur
          return []
        })
      publierPourPerimetre('TACHE', tache.perimetreId, {
        id: tache.id,
        editionId: tache.editionId,
      })
      await annoncerDeclinaisons(declinaisons, tache.editionId, acteur.id)
      return relire()
    },
  }),

  // Le périmètre cible accepte ou refuse une déclinaison proposée (ADR 0026).
  accorderDeclinaison: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    description:
      'Accepte ou refuse une déclinaison proposée à un périmètre. Seule une personne qui écrit dans ce périmètre répond. Une déclinaison acceptée entre parmi ses tâches.',
    args: {
      id: t.arg.id({ required: true }),
      accepter: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      if (tache.origine === null) {
        throw erreurSaisie('Cette tâche n’est pas une déclinaison.')
      }
      const accord = args.accepter ? 'ACCEPTE' : 'REFUSE'
      const relire = () =>
        prisma.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      const dejaRepondu = (actuel: AccordDeclinaison | null) =>
        erreurSaisie(
          actuel === 'ACCEPTE'
            ? 'Cette déclinaison est déjà acceptée. Abandonnez la tâche si elle ne concerne pas votre périmètre.'
            : 'Cette déclinaison a déjà été refusée. Un admin de l’activité peut l’imposer.'
        )
      // La même réponse une seconde fois ne change rien.
      if (tache.accord === accord) return relire()
      if (tache.accord !== 'EN_ATTENTE') throw dejaRepondu(tache.accord)
      const ecrite = await prisma.$transaction(async tx => {
        // L'écriture porte l'accord lu : deux réponses simultanées n'en écrivent
        // qu'une.
        const { count } = await tx.tache.updateMany({
          where: { id: tache.id, accord: 'EN_ATTENTE' },
          data: { accord, accordParId: acteur.id, accordLe: new Date() },
        })
        if (count === 0) return false
        await tx.journal.create({
          data: {
            type: args.accepter
              ? 'DECLINAISON_ACCEPTEE'
              : 'DECLINAISON_REFUSEE',
            acteurId: acteur.id,
            editionId: tache.editionId,
            perimetreId: tache.perimetreId,
            tacheId: tache.id,
          },
        })
        return true
      })
      if (!ecrite) {
        const actuelle = await prisma.tache.findUniqueOrThrow({
          where: { id: tache.id },
          select: { accord: true },
        })
        if (actuelle.accord === accord) return relire()
        throw dejaRepondu(actuelle.accord)
      }
      for (const perimetreId of [
        tache.perimetreId,
        tache.origine.perimetreId,
      ]) {
        publierPourPerimetre('TACHE', perimetreId, {
          id: tache.id,
          editionId: tache.editionId,
        })
      }
      // Le périmètre d'origine apprend la réponse, avec la personne qui a proposé.
      await notifier(prisma, {
        type: args.accepter ? 'DECLINAISON_ACCEPTEE' : 'DECLINAISON_REFUSEE',
        destinataires: [
          ...(await referentsAPrevenir(
            prisma,
            tache.origine.perimetreId,
            tache.editionId,
            acteur.id
          )),
          ...(tache.creeParId === null ? [] : [tache.creeParId]),
        ],
        acteurId: acteur.id,
        tacheId: tache.id,
        perimetreId: tache.perimetreId,
      })
      // Acceptée, la tâche entre dans le périmètre : ses autres référentes et
      // référents l'apprennent.
      if (args.accepter) {
        await notifier(prisma, {
          type: 'TACHE_CREEE',
          destinataires: await referentsAPrevenir(
            prisma,
            tache.perimetreId,
            tache.editionId,
            acteur.id
          ),
          acteurId: acteur.id,
          tacheId: tache.id,
          perimetreId: tache.perimetreId,
        })
      }
      return relire()
    },
  }),

  // Un admin de l'activité ajoute une déclinaison sans l'accord de son périmètre,
  // qu'elle attende une réponse ou qu'elle ait été refusée (ADR 0026).
  imposerDeclinaison: t.prismaField({
    type: TacheRef,
    authScopes: { connecte: true },
    description:
      'Ajoute une déclinaison aux tâches de son périmètre sans son accord, même après un refus. Réservé aux admins de l’activité.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      const tache = await chargerTache(String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      if (
        !(await ctx.estAdminDe(await activiteDuPerimetre(tache.perimetreId)))
      ) {
        throw accesRefuse()
      }
      if (tache.origine === null) {
        throw erreurSaisie('Cette tâche n’est pas une déclinaison.')
      }
      const relire = () =>
        prisma.tache.findUniqueOrThrow({ ...query, where: { id: tache.id } })
      if (tache.accord === 'ACCEPTE') return relire()
      const ecrite = await prisma.$transaction(async tx => {
        const { count } = await tx.tache.updateMany({
          where: { id: tache.id, accord: { in: ['EN_ATTENTE', 'REFUSE'] } },
          data: {
            accord: 'ACCEPTE',
            accordParId: acteur.id,
            accordLe: new Date(),
          },
        })
        if (count === 0) return false
        await tx.journal.create({
          data: {
            type: 'DECLINAISON_IMPOSEE',
            acteurId: acteur.id,
            editionId: tache.editionId,
            perimetreId: tache.perimetreId,
            tacheId: tache.id,
          },
        })
        return true
      })
      // Une autre personne vient de l'accepter : le résultat est celui demandé.
      if (!ecrite) return relire()
      for (const perimetreId of [
        tache.perimetreId,
        tache.origine.perimetreId,
      ]) {
        publierPourPerimetre('TACHE', perimetreId, {
          id: tache.id,
          editionId: tache.editionId,
        })
      }
      await notifier(prisma, {
        type: 'TACHE_CREEE',
        destinataires: await referentsAPrevenir(
          prisma,
          tache.perimetreId,
          tache.editionId,
          acteur.id
        ),
        acteurId: acteur.id,
        tacheId: tache.id,
        perimetreId: tache.perimetreId,
      })
      return relire()
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
