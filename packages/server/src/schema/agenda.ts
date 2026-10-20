import { prisma, type Edition } from '@relaytour/database'

import {
  bornesDesPhases,
  DATES_CLES_MAX,
  exigerEcritureGlobale,
  jourISO,
  joursDeDateCle,
} from '../lib/agenda.ts'
import { TACHES_ACTIVES } from '../lib/declinaisons.ts'
import { accesAuPerimetre, aujourdhui } from '../lib/droits.ts'
import { accesRefuse, conflitDeVersion, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'
import { lirePhases } from '../lib/phases.ts'
import { texteFacultatif, texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { EditionRef } from './organisation.ts'

// Agenda d'une activité (ADR 0037) : pour une période, ses phases, son premier et
// son dernier jour, ses dates clés et, en option, les échéances des tâches. Toute
// personne qui voit l'activité lit son agenda global. Les admins de l'activité et
// de l'organisation écrivent les dates clés, tant que la période n'est pas
// archivée.

export const TITRE_DATE_CLE_MAX = 120
export const DESCRIPTION_DATE_CLE_MAX = 2000
/** Un agenda renvoie 500 échéances au plus. */
export const ECHEANCES_MAX = 500

type SorteElement =
  'PHASE' | 'DEBUT_PERIODE' | 'FIN_PERIODE' | 'DATE_CLE' | 'ECHEANCE'

interface ElementAgenda {
  cle: string
  sorte: SorteElement
  titre: string
  jour: string
  jourFin: string | null
  description: string | null
  dateCleId: string | null
  version: number | null
  tacheId: string | null
  perimetreId: string | null
  faite: boolean
}

interface Agenda {
  edition: Edition
  peutGerer: boolean
  elements: ElementAgenda[]
}

const SorteElementAgendaEnum = builder.enumType('SorteElementAgenda', {
  values: {
    PHASE: {
      description:
        'Une phase de l’activité, de son premier à son dernier jour.',
    },
    DEBUT_PERIODE: { description: 'Le premier jour de la période.' },
    FIN_PERIODE: { description: 'Le dernier jour de la période.' },
    DATE_CLE: {
      description: 'Une date clé placée par un admin de l’activité.',
    },
    ECHEANCE: { description: 'L’échéance d’une tâche.' },
  } as const,
})

const elementBase = (
  partiel: Pick<ElementAgenda, 'cle' | 'sorte' | 'titre' | 'jour'> &
    Partial<ElementAgenda>
): ElementAgenda => ({
  jourFin: null,
  description: null,
  dateCleId: null,
  version: null,
  tacheId: null,
  perimetreId: null,
  faite: false,
  ...partiel,
})

const ElementAgendaRef = builder
  .objectRef<ElementAgenda>('ElementAgenda')
  .implement({
    description:
      'Un élément de l’agenda, à champs plats. Les jours s’écrivent au format AAAA-MM-JJ.',
    fields: t => ({
      // Pas de champ `id` : une clé stable suffit, et le cache ne fusionne rien.
      cle: t.exposeString('cle', {
        description: 'Clé stable de l’élément, propre à sa sorte.',
      }),
      sorte: t.expose('sorte', { type: SorteElementAgendaEnum }),
      titre: t.exposeString('titre'),
      jour: t.exposeString('jour', { description: 'Premier jour.' }),
      jourFin: t.exposeString('jourFin', {
        nullable: true,
        description: 'Dernier jour, compris. Nul pour un seul jour.',
      }),
      description: t.exposeString('description', { nullable: true }),
      dateCleId: t.exposeID('dateCleId', { nullable: true }),
      version: t.exposeInt('version', {
        nullable: true,
        description: 'Version d’une date clé, à renvoyer pour la modifier.',
      }),
      tacheId: t.exposeID('tacheId', { nullable: true }),
      perimetreId: t.exposeID('perimetreId', { nullable: true }),
      faite: t.exposeBoolean('faite', {
        description: 'Pour une échéance : vrai si la tâche est faite.',
      }),
    }),
  })

const AgendaRef = builder.objectRef<Agenda>('Agenda').implement({
  fields: t => ({
    edition: t.field({ type: EditionRef, resolve: a => a.edition }),
    peutGerer: t.exposeBoolean('peutGerer', {
      description:
        'Vrai pour un admin de l’activité, tant que la période n’est pas archivée : il écrit les dates clés.',
    }),
    elements: t.field({
      type: [ElementAgendaRef],
      description: 'Les éléments, par premier jour puis par sorte.',
      resolve: a => a.elements,
    }),
  }),
})

export const DateCleRef = builder.prismaObject('DateCle', {
  fields: t => ({
    id: t.exposeID('id'),
    titre: t.exposeString('titre'),
    jour: t.expose('jour', { type: 'Date' }),
    jourFin: t.expose('jourFin', { type: 'Date', nullable: true }),
    description: t.exposeString('description', { nullable: true }),
    version: t.exposeInt('version'),
  }),
})

const ORDRE_SORTES: Record<SorteElement, number> = {
  PHASE: 0,
  DEBUT_PERIODE: 1,
  FIN_PERIODE: 2,
  DATE_CLE: 3,
  ECHEANCE: 4,
}

/**
 * Les périmètres dont l'agenda montre les échéances : ceux demandés, que la
 * personne lit ou consulte, sinon ses périmètres de la période.
 */
async function perimetresDesEcheances(
  ctx: Parameters<typeof accesAuPerimetre>[0],
  edition: { id: string; activiteId: string },
  demandes: readonly (string | number)[] | null | undefined
): Promise<string[]> {
  if (demandes === null || demandes === undefined) {
    return [...(await ctx.perimetresAffectes(edition.id))]
  }
  const ids = [...new Set(demandes.map(String))]
  if (ids.length > 60) throw erreurSaisie('Choisissez 60 périmètres au plus.')
  const perimetres = await prisma.perimetre.findMany({
    where: {
      id: { in: ids },
      activiteId: edition.activiteId,
      organisationId: ctx.organisation!.id,
    },
    select: { id: true, organisationId: true, activiteId: true },
  })
  if (perimetres.length !== ids.length) throw accesRefuse()
  for (const perimetre of perimetres) {
    if ((await accesAuPerimetre(ctx, perimetre)) === 'AUCUN')
      throw accesRefuse()
  }
  return ids
}

builder.queryFields(t => ({
  agenda: t.field({
    type: AgendaRef,
    authScopes: { connecte: true },
    description:
      'L’agenda global d’une période, pour toute personne qui voit son activité.',
    args: {
      editionId: t.arg.id({ required: true }),
      echeances: t.arg.boolean({
        defaultValue: false,
        description: 'Ajoute les échéances des tâches.',
      }),
      perimetreIds: t.arg.idList({
        description:
          'Les périmètres des échéances. Sans valeur : les périmètres de la personne pour la période.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const lue = await ctx.exigerEdition(args.editionId)
      const [edition, activite, datesCles] = await Promise.all([
        prisma.edition.findUniqueOrThrow({ where: { id: lue.id } }),
        prisma.activite.findUniqueOrThrow({
          where: { id: lue.activiteId },
          select: { phases: true },
        }),
        prisma.dateCle.findMany({
          where: { editionId: lue.id, organisationId: ctx.organisation!.id },
          orderBy: [{ jour: 'asc' }, { titre: 'asc' }],
        }),
      ])
      const debut = jourISO(edition.debut)
      const fin = jourISO(edition.fin)
      const fuseau = ctx.organisation!.fuseauHoraire
      const elements: ElementAgenda[] = []
      for (const phase of bornesDesPhases(lirePhases(activite.phases), {
        debut,
        fin,
        ouverture: aujourdhui(edition.createdAt, fuseau),
      })) {
        elements.push(
          elementBase({
            cle: `phase-${phase.cle}`,
            sorte: 'PHASE',
            titre: phase.libelle,
            jour: phase.du,
            jourFin: phase.au === phase.du ? null : phase.au,
          })
        )
      }
      elements.push(
        elementBase({
          cle: 'debut',
          sorte: 'DEBUT_PERIODE',
          titre: `Premier jour · ${edition.nom}`,
          jour: debut,
        }),
        elementBase({
          cle: 'fin',
          sorte: 'FIN_PERIODE',
          titre: `Dernier jour · ${edition.nom}`,
          jour: fin,
        })
      )
      for (const d of datesCles) {
        elements.push(
          elementBase({
            cle: `date-cle-${d.id}`,
            sorte: 'DATE_CLE',
            titre: d.titre,
            jour: jourISO(d.jour),
            jourFin: d.jourFin === null ? null : jourISO(d.jourFin),
            description: d.description,
            dateCleId: d.id,
            version: d.version,
          })
        )
      }
      if (args.echeances) {
        const perimetreIds = await perimetresDesEcheances(
          ctx,
          lue,
          args.perimetreIds
        )
        const taches =
          perimetreIds.length === 0
            ? []
            : await prisma.tache.findMany({
                where: {
                  editionId: lue.id,
                  perimetreId: { in: perimetreIds },
                  echeance: { not: null },
                  statut: { not: 'ABANDONNEE' },
                  ...TACHES_ACTIVES,
                },
                select: {
                  id: true,
                  titre: true,
                  echeance: true,
                  statut: true,
                  perimetreId: true,
                },
                orderBy: [{ echeance: 'asc' }, { id: 'asc' }],
                take: ECHEANCES_MAX,
              })
        for (const tache of taches) {
          elements.push(
            elementBase({
              cle: `tache-${tache.id}`,
              sorte: 'ECHEANCE',
              titre: tache.titre,
              jour: jourISO(tache.echeance!),
              tacheId: tache.id,
              perimetreId: tache.perimetreId,
              faite: tache.statut === 'FAITE',
            })
          )
        }
      }
      elements.sort(
        (a, b) =>
          a.jour.localeCompare(b.jour) ||
          ORDRE_SORTES[a.sorte] - ORDRE_SORTES[b.sorte] ||
          a.titre.localeCompare(b.titre, 'fr')
      )
      return {
        edition,
        peutGerer:
          edition.statut !== 'ARCHIVEE' &&
          (await ctx.estAdminDe(edition.activiteId)),
        elements,
      }
    },
  }),
}))

/** La période et la date clé, si la personne écrit dans l'agenda global. */
async function dateCleModifiable(
  ctx: Parameters<typeof exigerEcritureGlobale>[0],
  id: string
) {
  const dateCle = await prisma.dateCle.findFirst({
    where: { id, organisationId: ctx.organisation!.id },
  })
  if (dateCle === null) throw accesRefuse()
  await exigerEcritureGlobale(ctx, dateCle.editionId)
  return dateCle
}

async function periodeDe(editionId: string) {
  const edition = await prisma.edition.findUniqueOrThrow({
    where: { id: editionId },
    select: { debut: true, fin: true },
  })
  return { debut: jourISO(edition.debut), fin: jourISO(edition.fin) }
}

function joursSaisis(jour: Date, jourFin: Date | null | undefined) {
  return {
    jour: jourISO(jour),
    jourFin:
      jourFin === null || jourFin === undefined ? null : jourISO(jourFin),
  }
}

const enDate = (jour: string | null) =>
  jour === null ? null : new Date(`${jour}T00:00:00.000Z`)

builder.mutationFields(t => ({
  creerDateCle: t.prismaField({
    type: DateCleRef,
    authScopes: { gestion: true },
    args: {
      editionId: t.arg.id({ required: true }),
      titre: t.arg.string({ required: true }),
      jour: t.arg({ type: 'Date', required: true }),
      jourFin: t.arg({ type: 'Date' }),
      description: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const edition = await exigerEcritureGlobale(ctx, String(args.editionId))
      const saisis = joursSaisis(args.jour, args.jourFin)
      const jours = joursDeDateCle(
        saisis.jour,
        saisis.jourFin,
        await periodeDe(edition.id)
      )
      // Le comptage et la création se font sous le verrou de l'organisation :
      // deux créations simultanées ne dépassent pas le plafond.
      const creee = await sousVerrouOrganisation(
        ctx.organisation!.id,
        async tx => {
          const nombre = await tx.dateCle.count({
            where: { editionId: edition.id },
          })
          if (nombre >= DATES_CLES_MAX) {
            throw erreurSaisie(
              `Une période compte ${DATES_CLES_MAX} dates clés au plus.`
            )
          }
          return tx.dateCle.create({
            ...query,
            data: {
              organisationId: ctx.organisation!.id,
              activiteId: edition.activiteId,
              editionId: edition.id,
              titre: texteRequis(args.titre, 'Le titre', TITRE_DATE_CLE_MAX),
              jour: enDate(jours.jour)!,
              jourFin: enDate(jours.jourFin),
              description: texteFacultatif(
                args.description,
                'La description',
                DESCRIPTION_DATE_CLE_MAX
              ),
              creeParId: ctx.personne!.id,
            },
          })
        }
      )
      publierPourActivite('AGENDA', ctx.organisation!.id, edition.activiteId, {
        id: creee.id,
        editionId: edition.id,
      })
      return creee
    },
  }),

  modifierDateCle: t.prismaField({
    type: DateCleRef,
    authScopes: { gestion: true },
    args: {
      id: t.arg.id({ required: true }),
      titre: t.arg.string({ required: true }),
      jour: t.arg({ type: 'Date', required: true }),
      jourFin: t.arg({ type: 'Date' }),
      description: t.arg.string(),
      versionAttendue: t.arg.int({
        required: true,
        description:
          'La version lue : le serveur refuse d’écraser une modification faite depuis.',
      }),
    },
    resolve: async (query, _root, args, ctx) => {
      const actuelle = await dateCleModifiable(ctx, String(args.id))
      const saisis = joursSaisis(args.jour, args.jourFin)
      const jours = joursDeDateCle(
        saisis.jour,
        saisis.jourFin,
        await periodeDe(actuelle.editionId)
      )
      const { count } = await prisma.dateCle.updateMany({
        where: { id: actuelle.id, version: args.versionAttendue },
        data: {
          version: { increment: 1 },
          titre: texteRequis(args.titre, 'Le titre', TITRE_DATE_CLE_MAX),
          jour: enDate(jours.jour)!,
          jourFin: enDate(jours.jourFin),
          description: texteFacultatif(
            args.description,
            'La description',
            DESCRIPTION_DATE_CLE_MAX
          ),
        },
      })
      if (count === 0) {
        const { version, updatedAt } = await prisma.dateCle.findUniqueOrThrow({
          where: { id: actuelle.id },
          select: { version: true, updatedAt: true },
        })
        throw conflitDeVersion(
          'Cette date clé a été modifiée depuis votre lecture.',
          { versionCourante: version, modifieeLe: updatedAt.toISOString() }
        )
      }
      publierPourActivite('AGENDA', ctx.organisation!.id, actuelle.activiteId, {
        id: actuelle.id,
        editionId: actuelle.editionId,
      })
      return prisma.dateCle.findUniqueOrThrow({
        ...query,
        where: { id: actuelle.id },
      })
    },
  }),

  supprimerDateCle: t.boolean({
    authScopes: { gestion: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const actuelle = await dateCleModifiable(ctx, String(args.id))
      await prisma.dateCle.delete({ where: { id: actuelle.id } })
      publierPourActivite('AGENDA', ctx.organisation!.id, actuelle.activiteId, {
        id: actuelle.id,
        editionId: actuelle.editionId,
      })
      return true
    },
  }),
}))
