import { prisma, type User } from '@relaytour/database'

import { BAREME, calculerScores, type Score } from '../lib/score.ts'

import { builder } from './builder.ts'
import { PersonneRef } from './personnes.ts'

const ScoreRef = builder.objectRef<Score>('Score').implement({
  fields: t => ({
    points: t.exposeInt('points'),
    tachesRealisees: t.exposeInt('tachesRealisees'),
    tachesATemps: t.exposeInt('tachesATemps'),
    tachesCreees: t.exposeInt('tachesCreees'),
    fichesCreees: t.exposeInt('fichesCreees'),
    fichesModifiees: t.exposeInt('fichesModifiees'),
  }),
})

const LigneClassementRef = builder
  .objectRef<{
    rang: number
    score: Score
    personne: User
  }>('LigneClassement')
  .implement({
    fields: t => ({
      rang: t.exposeInt('rang'),
      score: t.field({ type: ScoreRef, resolve: l => l.score }),
      personne: t.field({ type: PersonneRef, resolve: l => l.personne }),
    }),
  })

const BaremeRef = builder.objectRef<typeof BAREME>('BaremeScore').implement({
  fields: t => ({
    tacheRealisee: t.exposeInt('tacheRealisee'),
    bonusATemps: t.exposeInt('bonusATemps'),
    tacheCreee: t.exposeInt('tacheCreee'),
    ficheCreee: t.exposeInt('ficheCreee'),
    ficheModifiee: t.exposeInt('ficheModifiee'),
  }),
})

// Le score d'une personne n'est visible que par elle et par les admins.
// `monScore` ne prend aucun identifiant de personne : il lit la session.

builder.queryFields(t => ({
  monScore: t.field({
    type: ScoreRef,
    authScopes: { connecte: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      const scores = await calculerScores(
        prisma,
        edition.id,
        ctx.organisation!.fuseauHoraire
      )
      return (
        scores.get(ctx.personne!.id) ?? {
          userId: ctx.personne!.id,
          points: 0,
          tachesRealisees: 0,
          tachesATemps: 0,
          tachesCreees: 0,
          fichesCreees: 0,
          fichesModifiees: 0,
        }
      )
    },
  }),

  baremeScore: t.field({
    type: BaremeRef,
    authScopes: { connecte: true },
    resolve: () => BAREME,
  }),

  classement: t.field({
    type: [LigneClassementRef],
    authScopes: { gestion: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (_root, { editionId }, ctx) => {
      const edition = await ctx.exigerEdition(editionId)
      await ctx.exigerAdminDe(edition.activiteId)
      const scores = [
        ...(
          await calculerScores(
            prisma,
            edition.id,
            ctx.organisation!.fuseauHoraire
          )
        ).values(),
      ]
        .filter(s => s.points > 0)
        .sort((a, b) => b.points - a.points)
      // Les personnes se chargent en une seule requête, pas une par ligne.
      const personnes = new Map(
        (
          await prisma.user.findMany({
            where: { id: { in: scores.map(s => s.userId) } },
          })
        ).map(p => [p.id, p])
      )
      // Rang partagé en cas d'égalité : 1, 1, 3.
      return scores.flatMap(score => {
        const personne = personnes.get(score.userId)
        return personne
          ? [
              {
                rang: scores.findIndex(s => s.points === score.points) + 1,
                score,
                personne,
              },
            ]
          : []
      })
    },
  }),
}))
