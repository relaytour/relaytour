import {
  prisma,
  type Affectation,
  type Perimetre,
  type Souhait,
} from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { lireGroupes, type GroupePerimetres } from '../lib/activites.ts'
import { configurationActivite } from '../lib/organisation.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
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

/**
 * Postes de chaque périmètre non archivé de l'activité d'une édition, dans l'ordre
 * d'affichage. L'édition appartient à l'organisation active.
 */
async function chargerPostes(
  ctx: AppContext,
  editionIdBrut: string | number
): Promise<{
  annee: number
  postes: PostesPerimetre[]
  activite: {
    id: string
    nom: string
    sigle: string | null
    groupes: GroupePerimetres[]
  }
}> {
  const edition = await ctx.exigerEdition(editionIdBrut)
  const editionId = edition.id
  const ligneActivite = await prisma.activite.findUniqueOrThrow({
    where: { id: edition.activiteId },
    select: { id: true, nom: true, sigle: true, groupes: true },
  })
  const activite = {
    ...ligneActivite,
    groupes: lireGroupes(ligneActivite.groupes),
  }

  const [perimetres, affectations, effectifs, souhaits] = await Promise.all([
    prisma.perimetre.findMany({
      where: { activiteId: edition.activiteId, archivedAt: null },
    }),
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
  return {
    annee: edition.annee,
    postes: trierPostes(
      postes,
      activite.groupes.map(g => g.cle)
    ),
    activite,
  }
}

builder.queryFields(t => ({
  postesAPourvoir: t.field({
    type: [PostesPerimetreRef],
    authScopes: { admin: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }, ctx) =>
      (await chargerPostes(ctx, editionId)).postes,
  }),

  appelPostes: t.string({
    nullable: true,
    description:
      'Message à diffuser pour trouver des référentes et des référents. Vaut null quand aucun périmètre n’est à pourvoir.',
    authScopes: { admin: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }, ctx) => {
      const { annee, postes, activite } = await chargerPostes(ctx, editionId)
      // Les contacts de l'activité l'emportent sur ceux de l'organisation (ADR 0009).
      const configuration = await configurationActivite(activite.id)
      // L'appel porte le nom court de l'activité (ADR 0008) : pour l'activité
      // implicite d'un dépôt plat, c'est celui de l'organisation.
      return texteAppel(
        annee,
        postes.filter(p => p.aPourvoir > 0).map(p => p.perimetre),
        {
          nom: activite.sigle ?? activite.nom,
          contact: configuration.contactRecrutement,
          pageEquipe: configuration.pageEquipe,
        },
        activite.groupes
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
      const edition = await ctx.exigerEdition(args.editionId)
      const editionId = edition.id
      const perimetre = await prisma.perimetre.findFirst({
        where: { id: perimetreId, activiteId: edition.activiteId },
        select: { id: true },
      })
      if (perimetre === null) throw accesRefuse()
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
