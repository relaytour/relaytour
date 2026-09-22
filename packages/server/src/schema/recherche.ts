import { prisma } from '@relaytour/database'

import { perimetresLisibles } from '../lib/droits.ts'
import { erreurSaisie } from '../lib/erreurs.ts'

import { builder } from './builder.ts'
import { FicheRef } from './fiches.ts'
import { PerimetreRef } from './organisation.ts'
import { TacheRef } from './taches.ts'

// Recherche globale de la barre haute. Chaque liste suit la règle de lecture des
// périmètres : une personne ne trouve que ce qu'elle peut déjà ouvrir.

const RESULTATS_MAX = 8
const LONGUEUR_MIN = 2
const LONGUEUR_MAX = 100

type PerimetreTrouve = Awaited<
  ReturnType<typeof prisma.perimetre.findUniqueOrThrow>
>

interface PersonneTrouvee {
  id: string
  nom: string
  perimetres: PerimetreTrouve[]
}

const PersonneTrouveeRef = builder
  .objectRef<PersonneTrouvee>('PersonneTrouvee')
  .implement({
    description:
      'Une personne trouvée par la recherche, avec les périmètres lisibles où elle est affectée.',
    fields: t => ({
      id: t.exposeID('id'),
      nom: t.exposeString('nom'),
      perimetres: t.field({
        type: [PerimetreRef],
        resolve: p => p.perimetres,
      }),
    }),
  })

interface Resultats {
  texte: string
  editionId: string | null
  lisibles: string[] | null
}

const RechercheRef = builder.objectRef<Resultats>('Recherche').implement({
  fields: t => ({
    taches: t.prismaField({
      type: [TacheRef],
      // Les tâches se cherchent dans une édition. Sans édition, la liste reste
      // vide : la barre haute ne mélange jamais les éditions.
      resolve: (query, r) =>
        r.editionId === null
          ? []
          : prisma.tache.findMany({
              ...query,
              where: {
                titre: { contains: r.texte },
                perimetre: { archivedAt: null },
                editionId: r.editionId,
                ...(r.lisibles === null
                  ? {}
                  : { perimetreId: { in: r.lisibles } }),
              },
              orderBy: [{ echeance: { sort: 'asc', nulls: 'last' } }],
              take: RESULTATS_MAX,
            }),
    }),
    fiches: t.prismaField({
      type: [FicheRef],
      resolve: (query, r) =>
        prisma.fiche.findMany({
          ...query,
          where: {
            archivedAt: null,
            versionCourante: { titre: { contains: r.texte } },
            ...(r.lisibles === null
              ? {}
              : {
                  OR: [
                    { perimetreId: null },
                    { perimetreId: { in: r.lisibles } },
                  ],
                }),
          },
          orderBy: { slug: 'asc' },
          take: RESULTATS_MAX,
        }),
    }),
    // Les admins trouvent tous les comptes actifs. Les autres ne trouvent que les
    // personnes affectées à un périmètre qu'elles peuvent lire et qui n'est pas
    // archivé, comme le rétroplanning : chaque résultat mène à un périmètre ouvert.
    personnes: t.field({
      type: [PersonneTrouveeRef],
      resolve: async r => {
        const personnes = await prisma.user.findMany({
          where: {
            archivedAt: null,
            name: { contains: r.texte },
            ...(r.lisibles === null
              ? {}
              : {
                  affectations: {
                    some: {
                      perimetreId: { in: r.lisibles },
                      perimetre: { archivedAt: null },
                    },
                  },
                }),
          },
          select: {
            id: true,
            name: true,
            affectations: {
              where: {
                perimetre: { archivedAt: null },
                ...(r.lisibles === null
                  ? {}
                  : { perimetreId: { in: r.lisibles } }),
              },
              select: { perimetre: true },
            },
          },
          orderBy: { name: 'asc' },
          take: RESULTATS_MAX,
        })
        return personnes.map(p => ({
          id: p.id,
          nom: p.name,
          perimetres: [
            ...new Map(
              p.affectations.map(a => [a.perimetre.id, a.perimetre])
            ).values(),
          ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
        }))
      },
    }),
  }),
})

builder.queryFields(t => ({
  recherche: t.field({
    type: RechercheRef,
    authScopes: { connecte: true },
    args: {
      texte: t.arg.string({ required: true }),
      editionId: t.arg.id(),
    },
    resolve: async (_root, { texte, editionId }, ctx) => {
      const nettoye = texte.trim()
      if (nettoye.length < LONGUEUR_MIN) {
        throw erreurSaisie(
          `La recherche demande au moins ${LONGUEUR_MIN} caractères.`
        )
      }
      if (nettoye.length > LONGUEUR_MAX) {
        throw erreurSaisie(`La recherche dépasse ${LONGUEUR_MAX} caractères.`)
      }
      return {
        texte: nettoye,
        editionId: editionId ? String(editionId) : null,
        lisibles: await perimetresLisibles(ctx),
      }
    },
  }),
}))
