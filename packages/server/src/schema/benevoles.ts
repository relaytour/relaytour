import { prisma, type Benevole } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import {
  BENEVOLES_MAX,
  coordonneesLisibles,
  courrielValide,
  ecritDansLActivite,
  NOM_BENEVOLE_MAX,
  NOTE_BENEVOLE_MAX,
  telephoneValide,
} from '../lib/benevoles.ts'
import { PRECISIONS_MAX } from '../lib/appels.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { jetonEspace, lienEspace } from '../lib/espace-benevole.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { configurationOrganisation } from '../lib/organisation.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'
import { texteFacultatif, texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { i18n } from '../lib/langue.ts'

// Fiches bénévoles (ADR 0040). Les admins de l'activité et les personnes qui
// écrivent dans un de ses périmètres lisent la liste des fiches et en créent. Les
// coordonnées d'une fiche ne se lisent que par les admins de l'activité, par la
// personne qui l'a créée, et par les personnes qui écrivent dans un périmètre où
// la fiche est placée. Aucune fiche n'existe sans l'accord de la personne.

interface BenevoleLu {
  benevole: Benevole & { _count: { places: number } }
  coordonnees: boolean
  peutModifier: boolean
}

export const BenevoleRef = builder.objectRef<BenevoleLu>('Benevole').implement({
  description: 'Une fiche bénévole : une personne qui aide sans compte.',
  fields: t => ({
    id: t.id({ resolve: l => l.benevole.id }),
    nom: t.string({ resolve: l => l.benevole.nom }),
    coordonneesVisibles: t.boolean({
      description:
        'Vrai si la personne connectée lit l’adresse, le téléphone et la note.',
      resolve: l => l.coordonnees,
    }),
    courriel: t.string({
      nullable: true,
      resolve: l => (l.coordonnees ? l.benevole.courriel : null),
    }),
    telephone: t.string({
      nullable: true,
      resolve: l => (l.coordonnees ? l.benevole.telephone : null),
    }),
    note: t.string({
      nullable: true,
      resolve: l => (l.coordonnees ? l.benevole.note : null),
    }),
    accordLe: t.field({ type: 'DateTime', resolve: l => l.benevole.accordLe }),
    precisionsDisponibilite: t.string({
      nullable: true,
      description:
        'Les précisions de disponibilité de la personne, distinctes de la note (ADR 0042). Elles se lisent comme ses plages.',
      resolve: l => l.benevole.precisionsDisponibilite,
    }),
    sourceImport: t.string({
      nullable: true,
      description: 'La source de l’import qui a créé la fiche.',
      resolve: l => l.benevole.sourceImport,
    }),
    places: t.int({
      description: 'Le nombre de séquences où la fiche est placée.',
      resolve: l => l.benevole._count.places,
    }),
    origine: t.string({
      description:
        'SAISIE : saisie par l’équipe. CANDIDATURE : née d’une candidature (ADR 0041). IMPORT : née d’un import de liste (ADR 0042).',
      resolve: l => l.benevole.origine,
    }),
    confirmeeLe: t.field({
      type: 'DateTime',
      nullable: true,
      description:
        'La date à laquelle la personne a confirmé sa participation depuis son lien.',
      resolve: l => l.benevole.courrielConfirmeLe,
    }),
    lienEnvoyeLe: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: l => l.benevole.lienEnvoyeLe,
    }),
    prevenirParMail: t.boolean({
      description:
        'L’option « Prévenir par mail ». Avec une adresse, la fiche est joignable : sa première place envoie le lien (ADR 0041).',
      resolve: l => l.benevole.prevenirParMail,
    }),
    lienRenvoyable: t.boolean({
      description:
        'Vrai quand la personne connectée peut renvoyer le lien par mail, vers une fiche joignable : le lien est parti une fois sans relance, ou la fiche placée n’a pas pu recevoir son premier mail.',
      resolve: l =>
        l.coordonnees &&
        l.benevole.prevenirParMail &&
        l.benevole.courriel !== null &&
        (l.benevole.lienEnvoyeLe === null
          ? l.benevole._count.places > 0
          : l.benevole.relanceLe === null),
    }),
    lienEspace: t.string({
      nullable: true,
      description:
        'Le lien personnel, à copier, pour une personne qui lit les coordonnées ; null sans lien ou sans ce droit.',
      resolve: async l => {
        if (!l.coordonnees || l.benevole.espaceSel === null) return null
        const { origineOrga } = await configurationOrganisation(
          l.benevole.organisationId
        )
        // Le calcul réaligne l'empreinte gardée après un changement du secret :
        // le lien copié répond aussitôt.
        return lienEspace(origineOrga, await jetonEspace(prisma, l.benevole.id))
      },
    }),
    peutModifier: t.boolean({ resolve: l => l.peutModifier }),
  }),
})

export const AVEC_PLACES = { _count: { select: { places: true } } } as const

export async function lireBenevoles(
  ctx: AppContext,
  activiteId: string,
  benevoles: (Benevole & { _count: { places: number } })[]
): Promise<BenevoleLu[]> {
  const admin = await ctx.estAdminDe(activiteId)
  const lisibles = await coordonneesLisibles(
    ctx,
    activiteId,
    benevoles.map(b => b.id)
  )
  return benevoles.map(benevole => ({
    benevole,
    coordonnees: lisibles.has(benevole.id),
    peutModifier: admin || benevole.creeParId === ctx.personne!.id,
  }))
}

/** L'activité, si la personne y écrit : admin, ou affectée à un périmètre. */
async function activiteEcrite(ctx: AppContext, id: string | number) {
  const activiteId = await ctx.exigerActivite(id)
  if (!(await ecritDansLActivite(ctx, activiteId))) throw accesRefuse()
  return activiteId
}

/** La fiche, si la personne peut la modifier : admin de l'activité ou autrice. */
async function ficheModifiable(ctx: AppContext, id: string) {
  const benevole = await prisma.benevole.findFirst({
    where: { id, organisationId: ctx.organisation!.id },
  })
  if (benevole === null) throw accesRefuse()
  await ctx.exigerActivite(benevole.activiteId)
  if (
    !(await ctx.estAdminDe(benevole.activiteId)) &&
    benevole.creeParId !== ctx.personne!.id
  ) {
    throw accesRefuse()
  }
  return benevole
}

builder.queryFields(t => ({
  benevoles: t.field({
    type: [BenevoleRef],
    authScopes: { connecte: true },
    description:
      'Les fiches bénévoles d’une activité, par nom, pour les personnes qui y écrivent.',
    args: { activiteId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const activiteId = await activiteEcrite(ctx, args.activiteId)
      const benevoles = await prisma.benevole.findMany({
        where: { organisationId: ctx.organisation!.id, activiteId },
        include: AVEC_PLACES,
        orderBy: [{ nom: 'asc' }, { id: 'asc' }],
        take: BENEVOLES_MAX,
      })
      return lireBenevoles(ctx, activiteId, benevoles)
    },
  }),
}))

builder.mutationFields(t => ({
  creerBenevole: t.field({
    type: BenevoleRef,
    authScopes: { connecte: true },
    description:
      'Crée une fiche bénévole. La personne qui la crée déclare l’accord de la ou du bénévole.',
    args: {
      activiteId: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      courriel: t.arg.string(),
      telephone: t.arg.string(),
      note: t.arg.string(),
      prevenirParMail: t.arg.boolean({
        defaultValue: true,
        description:
          'Vrai : la fiche reçoit son lien par mail à sa première place, si elle a une adresse.',
      }),
      accord: t.arg.boolean({
        required: true,
        description:
          'Vrai : la personne accepte que ses coordonnées soient enregistrées.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const activiteId = await activiteEcrite(ctx, args.activiteId)
      if (!args.accord) {
        throw erreurSaisie(
          i18n._('Une fiche ne s’enregistre qu’avec l’accord de la personne.')
        )
      }
      const donnees = {
        organisationId: ctx.organisation!.id,
        activiteId,
        nom: texteRequis(args.nom, i18n._('Le nom'), NOM_BENEVOLE_MAX),
        courriel: courrielValide(args.courriel),
        telephone: telephoneValide(args.telephone),
        note: texteFacultatif(args.note, i18n._('La note'), NOTE_BENEVOLE_MAX),
        prevenirParMail: args.prevenirParMail ?? true,
        accordLe: new Date(),
        creeParId: ctx.personne!.id,
      }
      // Le comptage et la création se font sous le verrou de l'organisation :
      // deux créations simultanées ne dépassent pas le plafond.
      const creee = await sousVerrouOrganisation(
        ctx.organisation!.id,
        async tx => {
          const nombre = await tx.benevole.count({ where: { activiteId } })
          if (nombre >= BENEVOLES_MAX) {
            throw erreurSaisie(
              i18n._('Une activité compte {max} fiches bénévoles au plus.', {
                max: BENEVOLES_MAX,
              })
            )
          }
          return tx.benevole.create({ data: donnees, include: AVEC_PLACES })
        }
      )
      publierPourActivite('PROGRAMME', ctx.organisation!.id, activiteId)
      const [lue] = await lireBenevoles(ctx, activiteId, [creee])
      return lue!
    },
  }),

  modifierBenevole: t.field({
    type: BenevoleRef,
    authScopes: { connecte: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      courriel: t.arg.string(),
      telephone: t.arg.string(),
      note: t.arg.string(),
      precisionsDisponibilite: t.arg.string({
        description: 'Sans valeur, les précisions restent telles quelles.',
      }),
      prevenirParMail: t.arg.boolean({
        description: 'Sans valeur, l’option reste telle quelle.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const actuelle = await ficheModifiable(ctx, String(args.id))
      const courriel = courrielValide(args.courriel)
      // Une nouvelle adresse n'est pas confirmée : elle repart du premier lien,
      // et l'ancien lien, envoyé à l'ancienne adresse, cesse de répondre
      // (ADR 0041).
      const autreAdresse = courriel !== actuelle.courriel
      const modifiee = await prisma.benevole.update({
        where: { id: actuelle.id },
        data: {
          nom: texteRequis(args.nom, i18n._('Le nom'), NOM_BENEVOLE_MAX),
          courriel,
          ...(autreAdresse
            ? {
                courrielConfirmeLe: null,
                lienEnvoyeLe: null,
                relanceLe: null,
                espaceSel: null,
                espaceEmpreinte: null,
              }
            : {}),
          telephone: telephoneValide(args.telephone),
          note: texteFacultatif(
            args.note,
            i18n._('La note'),
            NOTE_BENEVOLE_MAX
          ),
          ...(args.precisionsDisponibilite === null ||
          args.precisionsDisponibilite === undefined
            ? {}
            : {
                precisionsDisponibilite: texteFacultatif(
                  args.precisionsDisponibilite,
                  i18n._('Les précisions'),
                  PRECISIONS_MAX
                ),
              }),
          ...(args.prevenirParMail === null ||
          args.prevenirParMail === undefined
            ? {}
            : { prevenirParMail: args.prevenirParMail }),
        },
        include: AVEC_PLACES,
      })
      publierPourActivite(
        'PROGRAMME',
        ctx.organisation!.id,
        actuelle.activiteId
      )
      const [lue] = await lireBenevoles(ctx, actuelle.activiteId, [modifiee])
      return lue!
    },
  }),

  supprimerBenevole: t.boolean({
    authScopes: { connecte: true },
    description:
      'Supprime une fiche et la retire de toutes les séquences. Réservé aux admins de l’activité.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const benevole = await prisma.benevole.findFirst({
        where: { id: String(args.id), organisationId: ctx.organisation!.id },
      })
      if (benevole === null) throw accesRefuse()
      await ctx.exigerActivite(benevole.activiteId)
      await ctx.exigerAdminDe(benevole.activiteId)
      await prisma.benevole.delete({ where: { id: benevole.id } })
      publierPourActivite(
        'PROGRAMME',
        ctx.organisation!.id,
        benevole.activiteId
      )
      return true
    },
  }),
}))
