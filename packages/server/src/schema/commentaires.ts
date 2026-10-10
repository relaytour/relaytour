import {
  prisma,
  type AccordDeclinaison,
  type StatutTache,
  type User,
} from '@relaytour/database'

import type { AppContext, PersonneConnectee } from '../context.ts'
import {
  exigerEcriture,
  peutLirePerimetre,
  peutModifierPerimetre,
  perimetresLisibles,
} from '../lib/droits.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourPerimetre } from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'
import { notifier, notifierLePerimetre } from '../lib/notifications.ts'
import { texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { PersonneRef } from './personnes.ts'
import { StatutTacheEnum } from './taches.ts'

// Commentaires d'une tâche (ADR 0029).
//
// Lecture du fil : toute personne qui lit le périmètre de la tâche. Une personne en
// consultation (ADR 0014) lit la tâche sans son fil. Écriture : toute personne qui
// écrit dans le périmètre. Un commentaire se modifie par son auteur, et se supprime
// par son auteur ou par un admin de l'activité.

/** Longueur maximale d'un commentaire. */
export const COMMENTAIRE_MAX = 4000
/** Le fil rend au plus ce nombre de commentaires, et autant d'événements. */
export const FIL_MAX = 200

// Les événements du journal que le fil reprend. Les étapes de l'accord d'une
// déclinaison restent réservées aux admins (`historiqueAccord`).
const EVENEMENTS = {
  TACHE_CREEE: 'CREEE',
  TACHE_MODIFIEE: 'MODIFIEE',
  TACHE_ASSIGNEE: 'ASSIGNEE',
  TACHE_DESASSIGNEE: 'RETIREE',
  TACHE_STATUT: 'STATUT',
} as const
type TypeEvenement = keyof typeof EVENEMENTS

interface CommentaireDuFil {
  id: string
  texte: string
  createdAt: Date
  modifieLe: Date | null
  auteur: User | null
  peutModifier: boolean
  peutSupprimer: boolean
}

interface EvenementDuFil {
  id: string
  type: TypeEvenement
  createdAt: Date
  acteur: User | null
  personne: User | null
  statut: StatutTache | null
}

interface Fil {
  tacheId: string
  nombreCommentaires: number
  peutCommenter: boolean
  commentaires: CommentaireDuFil[]
  evenements: EvenementDuFil[]
}

const CommentaireRef = builder
  .objectRef<CommentaireDuFil>('CommentaireTache')
  .implement({
    description:
      'Un commentaire écrit sur une tâche : un texte simple, daté et signé (ADR 0029).',
    fields: t => ({
      id: t.exposeID('id'),
      texte: t.exposeString('texte'),
      creeLe: t.field({ type: 'DateTime', resolve: c => c.createdAt }),
      modifieLe: t.field({
        type: 'DateTime',
        nullable: true,
        description:
          'Le moment de la dernière modification du texte par son auteur, ou null.',
        resolve: c => c.modifieLe,
      }),
      auteur: t.field({
        type: PersonneRef,
        nullable: true,
        description: 'Null quand le compte de l’auteur n’existe plus.',
        resolve: c => c.auteur,
      }),
      peutModifier: t.exposeBoolean('peutModifier', {
        description: 'Vrai pour l’auteur, tant qu’il écrit dans le périmètre.',
      }),
      peutSupprimer: t.exposeBoolean('peutSupprimer', {
        description:
          'Vrai pour l’auteur et pour les admins de l’activité, tant que la période n’est pas archivée.',
      }),
    }),
  })

const TypeEvenementEnum = builder.enumType('TypeEvenementTache', {
  description:
    'Un événement du journal d’une tâche, repris dans son fil. STATUT : le champ `statut` porte le nouveau statut.',
  values: Object.values(EVENEMENTS),
})

const EvenementRef = builder
  .objectRef<EvenementDuFil>('EvenementTache')
  .implement({
    description:
      'Un événement du journal d’une tâche : création, modification, assignation, retrait ou changement de statut.',
    fields: t => ({
      id: t.exposeID('id'),
      type: t.field({
        type: TypeEvenementEnum,
        resolve: e => EVENEMENTS[e.type],
      }),
      le: t.field({ type: 'DateTime', resolve: e => e.createdAt }),
      acteur: t.field({
        type: PersonneRef,
        nullable: true,
        description:
          'La personne qui a agi. Null pour un passage à « faite », sauf pour la personne qui a coché et pour les admins de l’activité.',
        resolve: e => e.acteur,
      }),
      personne: t.field({
        type: PersonneRef,
        nullable: true,
        description:
          'Pour une assignation ou un retrait : la personne concernée.',
        resolve: e => e.personne,
      }),
      statut: t.field({
        type: StatutTacheEnum,
        nullable: true,
        resolve: e => e.statut,
      }),
    }),
  })

const FilRef = builder.objectRef<Fil>('FilTache').implement({
  description:
    'Le fil d’une tâche : ses commentaires et les événements de son journal, du plus ancien au plus récent. Chaque liste rend au plus ses 200 derniers éléments.',
  fields: t => ({
    tacheId: t.exposeID('tacheId'),
    nombreCommentaires: t.exposeInt('nombreCommentaires', {
      description: 'Le nombre total de commentaires de la tâche.',
    }),
    peutCommenter: t.exposeBoolean('peutCommenter'),
    commentaires: t.field({
      type: [CommentaireRef],
      resolve: f => f.commentaires,
    }),
    evenements: t.field({ type: [EvenementRef], resolve: f => f.evenements }),
  }),
})

const NombreCommentairesRef = builder
  .objectRef<{ tacheId: string; nombre: number }>('NombreCommentaires')
  .implement({
    description: 'Le nombre de commentaires d’une tâche.',
    fields: t => ({
      tacheId: t.exposeID('tacheId'),
      nombre: t.exposeInt('nombre'),
    }),
  })

// ── Accès ────────────────────────────────────────────────────────────────────

interface TacheSituee {
  id: string
  editionId: string
  perimetreId: string
  accord: AccordDeclinaison | null
  perimetre: { activiteId: string }
  assignations: { userId: string }[]
}

const SELECTION_TACHE = {
  id: true,
  editionId: true,
  perimetreId: true,
  accord: true,
  perimetre: { select: { activiteId: true } },
  assignations: { select: { userId: true } },
} as const

/**
 * La tâche, si la personne lit son périmètre. Une tâche inconnue, d'une autre
 * organisation ou d'un périmètre non lu donne le même refus.
 */
async function exigerLectureDeLaTache(
  ctx: AppContext,
  tacheId: string
): Promise<{ tache: TacheSituee; personne: PersonneConnectee }> {
  if (ctx.personne === null) throw accesRefuse()
  const tache = await prisma.tache.findUnique({
    where: { id: tacheId },
    select: SELECTION_TACHE,
  })
  if (tache === null || !(await peutLirePerimetre(ctx, tache.perimetreId))) {
    throw accesRefuse()
  }
  return { tache, personne: ctx.personne }
}

/** Une déclinaison qui n'est pas acceptée n'est pas encore une tâche du périmètre. */
function exigerTacheDuPerimetre(tache: { accord: AccordDeclinaison | null }) {
  if (tache.accord === 'EN_ATTENTE' || tache.accord === 'REFUSE') {
    throw erreurSaisie(
      'Cette déclinaison n’est pas acceptée par son périmètre : elle ne reçoit aucun commentaire.'
    )
  }
}

function texteValide(brut: string): string {
  return texteRequis(brut, 'Le commentaire', COMMENTAIRE_MAX)
}

async function lireLeFil(ctx: AppContext, tacheId: string): Promise<Fil> {
  const { tache, personne } = await exigerLectureDeLaTache(ctx, tacheId)
  const [ecrit, admin] = await Promise.all([
    peutModifierPerimetre(ctx, tache.perimetreId, tache.editionId),
    ctx.estAdminDe(tache.perimetre.activiteId),
  ])
  const [nombre, commentaires, lignes] = await Promise.all([
    prisma.commentaireTache.count({ where: { tacheId } }),
    prisma.commentaireTache.findMany({
      where: { tacheId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: FIL_MAX,
      include: { auteur: true },
    }),
    prisma.journal.findMany({
      where: {
        tacheId,
        type: { in: Object.keys(EVENEMENTS) as TypeEvenement[] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: FIL_MAX,
      include: { acteur: true },
    }),
  ])
  const concernees = [
    ...new Set(lignes.flatMap(l => (l.personneId ? [l.personneId] : []))),
  ]
  const personnes = new Map(
    (concernees.length === 0
      ? []
      : await prisma.user.findMany({ where: { id: { in: concernees } } })
    ).map(u => [u.id, u])
  )
  const accepte = tache.accord === null || tache.accord === 'ACCEPTE'
  return {
    tacheId,
    nombreCommentaires: nombre,
    peutCommenter: ecrit && accepte,
    commentaires: commentaires.reverse().map(c => ({
      id: c.id,
      texte: c.texte,
      createdAt: c.createdAt,
      modifieLe: c.modifieLe,
      auteur: c.auteur,
      peutModifier: ecrit && c.auteurId === personne.id,
      peutSupprimer: ecrit && (admin || c.auteurId === personne.id),
    })),
    evenements: lignes.reverse().map(l => ({
      id: l.id,
      type: l.type as TypeEvenement,
      createdAt: l.createdAt,
      // Qui a coché une tâche reste réservé à la personne qui a coché et aux admins.
      acteur:
        l.statut === 'FAITE' && !admin && l.acteurId !== personne.id
          ? null
          : l.acteur,
      personne: l.personneId ? (personnes.get(l.personneId) ?? null) : null,
      statut: l.statut,
    })),
  }
}

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryFields(t => ({
  filTache: t.field({
    type: FilRef,
    authScopes: { connecte: true },
    description:
      'Le fil d’une tâche (ADR 0029). Toute personne qui lit le périmètre de la tâche le lit ; une personne en consultation reçoit un refus.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => lireLeFil(ctx, String(id)),
  }),

  nombresCommentaires: t.field({
    type: [NombreCommentairesRef],
    authScopes: { connecte: true },
    description:
      'Le nombre de commentaires de chaque tâche commentée d’une période, dans les périmètres que la personne lit. Une tâche sans commentaire est absente.',
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      const lisibles = await perimetresLisibles(ctx)
      if (lisibles.length === 0) return []
      const groupes = await prisma.commentaireTache.groupBy({
        by: ['tacheId'],
        where: {
          tache: { editionId: edition.id, perimetreId: { in: lisibles } },
        },
        _count: { _all: true },
      })
      return groupes.map(g => ({ tacheId: g.tacheId, nombre: g._count._all }))
    },
  }),
}))

// ── Écriture ─────────────────────────────────────────────────────────────────

/** Le commentaire et sa tâche, si la personne lit le périmètre de la tâche. */
async function chargerCommentaire(ctx: AppContext, id: string) {
  const commentaire = await prisma.commentaireTache.findUnique({
    where: { id },
    select: { id: true, tacheId: true, auteurId: true },
  })
  if (commentaire === null) throw accesRefuse()
  const { tache } = await exigerLectureDeLaTache(ctx, commentaire.tacheId)
  return { commentaire, tache }
}

function signaler(tache: TacheSituee) {
  publierPourPerimetre('TACHE', tache.perimetreId, {
    id: tache.id,
    editionId: tache.editionId,
  })
}

builder.mutationFields(t => ({
  commenterTache: t.field({
    type: FilRef,
    authScopes: { connecte: true },
    description:
      'Écrit un commentaire sur une tâche et rend son fil. Toute personne qui écrit dans le périmètre de la tâche commente.',
    args: {
      id: t.arg.id({ required: true }),
      texte: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { tache } = await exigerLectureDeLaTache(ctx, String(args.id))
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      exigerTacheDuPerimetre(tache)
      const texte = texteValide(args.texte)
      const commentaire = await prisma.commentaireTache.create({
        data: { tacheId: tache.id, auteurId: acteur.id, texte },
        select: { id: true },
      })
      // Le journal du serveur ne porte jamais le texte d'un commentaire.
      journal.info(
        {
          evenement: 'commentaire-ecrit',
          commentaireId: commentaire.id,
          tacheId: tache.id,
          par: acteur.id,
        },
        'Un commentaire a été écrit.'
      )
      signaler(tache)
      // Les personnes assignées sont prévenues à chaque commentaire, dans
      // l'application et en push. Les autres référentes et référents l'apprennent
      // dans l'application, une fois par tranche de dix minutes.
      const assignees = tache.assignations.map(a => a.userId)
      await notifier(prisma, {
        type: 'TACHE_COMMENTEE',
        destinataires: assignees,
        acteurId: acteur.id,
        tacheId: tache.id,
        perimetreId: tache.perimetreId,
      })
      await notifierLePerimetre(prisma, {
        type: 'TACHE_COMMENTEE',
        perimetreId: tache.perimetreId,
        editionId: tache.editionId,
        acteurId: acteur.id,
        tacheId: tache.id,
        sauf: assignees,
      })
      return lireLeFil(ctx, tache.id)
    },
  }),

  modifierCommentaire: t.field({
    type: FilRef,
    authScopes: { connecte: true },
    description:
      'Modifie le texte d’un commentaire et rend le fil de sa tâche. Seul son auteur le modifie.',
    args: {
      id: t.arg.id({ required: true }),
      texte: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { commentaire, tache } = await chargerCommentaire(
        ctx,
        String(args.id)
      )
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      if (commentaire.auteurId !== acteur.id) throw accesRefuse()
      const texte = texteValide(args.texte)
      await prisma.commentaireTache.update({
        where: { id: commentaire.id },
        data: { texte, modifieLe: new Date() },
      })
      signaler(tache)
      return lireLeFil(ctx, tache.id)
    },
  }),

  supprimerCommentaire: t.field({
    type: FilRef,
    authScopes: { connecte: true },
    description:
      'Supprime un commentaire, définitivement, et rend le fil de sa tâche. Son auteur le supprime, ainsi qu’un admin de l’activité.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { commentaire, tache } = await chargerCommentaire(
        ctx,
        String(args.id)
      )
      const acteur = await exigerEcriture(
        ctx,
        tache.perimetreId,
        tache.editionId
      )
      if (
        commentaire.auteurId !== acteur.id &&
        !(await ctx.estAdminDe(tache.perimetre.activiteId))
      ) {
        throw accesRefuse()
      }
      // Une suppression simultanée a déjà fait le travail : le résultat est le même.
      await prisma.commentaireTache.deleteMany({
        where: { id: commentaire.id },
      })
      journal.info(
        {
          evenement: 'commentaire-supprime',
          commentaireId: commentaire.id,
          tacheId: tache.id,
          par: acteur.id,
        },
        'Un commentaire a été supprimé.'
      )
      signaler(tache)
      return lireLeFil(ctx, tache.id)
    },
  }),
}))
