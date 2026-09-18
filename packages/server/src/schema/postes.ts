import {
  prisma,
  type Affectation,
  type Perimetre,
  type Souhait,
} from '@relaytour/database'

import { erreurSaisie } from '../lib/erreurs.ts'
import { journal } from '../lib/journal.ts'
import {
  EFFECTIF_MAX,
  etatPostes,
  texteAppel,
  trierPostes,
  type EtatPostes,
} from '../lib/postes.ts'

import { builder } from './builder.ts'
import { PerimetreRef } from './organisation.ts'
import { AffectationRef } from './personnes.ts'
import { SouhaitRef } from './souhaits.ts'

// Postes à pourvoir : les admins voient quels périmètres manquent de référentes et
// de référents pour une édition, fixent l'effectif souhaité et préparent un appel.

interface PostesPerimetre {
  perimetre: Perimetre
  affectations: Affectation[]
  /** Souhaits non satisfaits de personnes non archivées. */
  souhaits: Souhait[]
  /** null : l'effectif n'a été ni importé ni défini pour cette édition. */
  effectif: number | null
  aPourvoir: number
  etat: EtatPostes
}

const EtatPostesEnum = builder.enumType('EtatPostes', {
  values: ['COMPLET', 'INCOMPLET', 'SANS_PERSONNE'] as const,
})

const PostesPerimetreRef = builder
  .objectRef<PostesPerimetre>('PostesPerimetre')
  .implement({
    fields: t => ({
      perimetre: t.field({ type: PerimetreRef, resolve: p => p.perimetre }),
      affectations: t.field({
        type: [AffectationRef],
        resolve: p => p.affectations,
      }),
      souhaits: t.field({
        type: [SouhaitRef],
        description:
          'Souhaits en attente : la personne n’est pas encore affectée à ce périmètre. Les comptes archivés sont exclus.',
        resolve: p => p.souhaits,
      }),
      effectif: t.exposeInt('effectif', {
        nullable: true,
        description:
          'Vaut null tant que l’effectif n’a été ni importé ni défini pour cette édition.',
      }),
      aPourvoir: t.exposeInt('aPourvoir'),
      etat: t.field({ type: EtatPostesEnum, resolve: p => p.etat }),
    }),
  })

/** Postes de chaque périmètre non archivé d'une édition, dans l'ordre d'affichage. */
async function chargerPostes(
  editionId: string
): Promise<{ annee: number; postes: PostesPerimetre[] }> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { annee: true },
  })
  if (edition === null) throw erreurSaisie('Cette édition est introuvable.')

  const [perimetres, affectations, effectifs, souhaits] = await Promise.all([
    prisma.perimetre.findMany({ where: { archivedAt: null } }),
    // Un compte archivé ne tient plus son périmètre : il ne compte pas comme poste pourvu.
    prisma.affectation.findMany({
      where: { editionId, user: { archivedAt: null } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.effectifPerimetre.findMany({ where: { editionId } }),
    prisma.souhait.findMany({
      where: { editionId, user: { archivedAt: null } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const effectifParPerimetre = new Map(
    effectifs.map(e => [e.perimetreId, e.effectif])
  )
  // Un souhait est satisfait dès que l'affectation du même triplet existe.
  const affectes = new Set(
    affectations.map(a => `${a.userId}|${a.perimetreId}`)
  )
  const postes = perimetres.map(perimetre => {
    const duPerimetre = affectations.filter(a => a.perimetreId === perimetre.id)
    const effectif = effectifParPerimetre.get(perimetre.id) ?? null
    return {
      perimetre,
      affectations: duPerimetre,
      souhaits: souhaits.filter(
        souhait =>
          souhait.perimetreId === perimetre.id &&
          !affectes.has(`${souhait.userId}|${souhait.perimetreId}`)
      ),
      effectif,
      ...etatPostes(effectif, duPerimetre.length),
    }
  })
  return { annee: edition.annee, postes: trierPostes(postes) }
}

builder.queryFields(t => ({
  postesAPourvoir: t.field({
    type: [PostesPerimetreRef],
    authScopes: { admin: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }) =>
      (await chargerPostes(String(editionId))).postes,
  }),

  appelPostes: t.string({
    nullable: true,
    description:
      'Message à diffuser pour trouver des référentes et des référents. Vaut null quand aucun périmètre n’est à pourvoir.',
    authScopes: { admin: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }) => {
      const { annee, postes } = await chargerPostes(String(editionId))
      // Import paresseux : le schéma ne charge pas env.ts (invariant 12).
      const { env } = await import('../env.ts')
      return texteAppel(
        annee,
        postes.filter(p => p.aPourvoir > 0).map(p => p.perimetre),
        {
          nom: env.ORGANISATION_NOM,
          contact: env.CONTACT_RECRUTEMENT,
          pageEquipe: env.PAGE_EQUIPE,
        }
      )
    },
  }),
}))

builder.mutationFields(t => ({
  definirEffectif: t.int({
    authScopes: { admin: true },
    args: {
      perimetreId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
      effectif: t.arg.int({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (
        !Number.isInteger(args.effectif) ||
        args.effectif < 0 ||
        args.effectif > EFFECTIF_MAX
      ) {
        throw erreurSaisie(
          `L’effectif est un nombre entier entre 0 et ${EFFECTIF_MAX}.`
        )
      }
      const perimetreId = String(args.perimetreId)
      const editionId = String(args.editionId)
      const [perimetre, edition] = await Promise.all([
        prisma.perimetre.findUnique({
          where: { id: perimetreId },
          select: { id: true },
        }),
        prisma.edition.findUnique({
          where: { id: editionId },
          select: { statut: true },
        }),
      ])
      if (perimetre === null || edition === null) {
        throw erreurSaisie('Ce périmètre ou cette édition est introuvable.')
      }
      if (edition.statut === 'ARCHIVEE') {
        throw erreurSaisie(
          'Cette édition est archivée : ses effectifs ne se modifient plus.'
        )
      }
      const ligne = await prisma.effectifPerimetre.upsert({
        where: { perimetreId_editionId: { perimetreId, editionId } },
        create: { perimetreId, editionId, effectif: args.effectif },
        update: { effectif: args.effectif },
      })
      journal.info(
        {
          evenement: 'effectif-defini',
          perimetreId,
          editionId,
          par: ctx.personne?.id,
        },
        'Un effectif a été défini.'
      )
      return ligne.effectif
    },
  }),
}))
