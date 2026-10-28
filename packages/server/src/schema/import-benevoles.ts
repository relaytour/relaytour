import { pairesRapprochees } from '@relaytour/commun'
import { prisma, type Prisma } from '@relaytour/database'
import { z } from 'zod'

import type { AppContext } from '../context.ts'
import { ecritDansLActivite } from '../lib/benevoles.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { fusionnerFiches } from '../lib/fusion-benevoles.ts'
import {
  importerLot,
  type LigneRapport,
  type RapportImport,
} from '../lib/import-benevoles.ts'
import { texteRequis } from '../lib/saisie.ts'

import { AVEC_PLACES, BenevoleRef, lireBenevoles } from './benevoles.ts'
import { builder } from './builder.ts'
import { EtatLigneImportEnum } from './import-commun.ts'
import { PlageInput } from './repartition.ts'
import { i18n } from '../lib/langue.ts'
import { exigerModule } from '../lib/modules.ts'

// Import de listes de bénévoles, correspondances d'import, doublons possibles et
// fusion des fiches (ADR 0042). Les admins de l'activité importent pour le
// programme entier, les personnes qui écrivent dans un périmètre pour ce
// périmètre. Seuls les admins de l'activité voient les doublons et fusionnent.

const ModeImportEnum = builder.enumType('ModeImport', {
  description:
    'A_REPARTIR : chaque personne devient une candidature à traiter. PLACES_DIRECTES : chaque personne reçoit sa fiche et ses places.',
  values: ['A_REPARTIR', 'PLACES_DIRECTES'] as const,
})

const NiveauEnum = builder.enumType('NiveauRapprochement', {
  description:
    'FORT : même adresse. MOYEN : même téléphone. FAIBLE : même nom, ou nom très proche.',
  values: ['FORT', 'MOYEN', 'FAIBLE'] as const,
})

const CoteEnum = builder.enumType('CoteFusion', {
  description: 'La fiche dont une valeur est gardée.',
  values: ['GARDEE', 'AUTRE'] as const,
})

const PersonneImportInput = builder.inputType('PersonneImportInput', {
  description:
    'Une personne du fichier, après l’association des colonnes et la réunion de ses lignes dans le navigateur.',
  fields: t => ({
    cle: t.string({
      required: true,
      description: 'La clé de la personne dans le rapport.',
    }),
    nom: t.string({ required: true }),
    courriel: t.string(),
    telephone: t.string(),
    precisions: t.string(),
    refExterne: t.string({
      description:
        'L’identifiant de la ligne dans l’outil d’origine : rend l’import rejouable.',
    }),
    accordLe: t.field({
      type: 'Date',
      description:
        'La date de l’accord lue dans le fichier. Sans valeur : la date de l’import.',
    }),
    plages: t.field({ type: [PlageInput] }),
    sequenceIds: t.idList(),
    rattachement: t.id({ description: 'La fiche que la personne rejoint.' }),
    nouvelleFiche: t.boolean({
      description:
        'Vrai : crée une fiche même quand une fiche a la même adresse.',
    }),
  }),
})

const RapprochementRef = builder
  .objectRef<NonNullable<LigneRapport['rapprochement']>>('RapprochementImport')
  .implement({
    fields: t => ({
      benevoleId: t.exposeID('benevoleId'),
      nom: t.exposeString('nom'),
      niveau: t.field({ type: NiveauEnum, resolve: r => r.niveau }),
    }),
  })

const LigneRef = builder.objectRef<LigneRapport>('LigneImport').implement({
  fields: t => ({
    cle: t.exposeString('cle'),
    etat: t.field({ type: EtatLigneImportEnum, resolve: l => l.etat }),
    motif: t.exposeString('motif', { nullable: true }),
    rapprochement: t.field({
      type: RapprochementRef,
      nullable: true,
      resolve: l => l.rapprochement,
    }),
    rattacheeA: t.exposeID('rattacheeA', { nullable: true }),
    compte: t.exposeBoolean('compte', {
      description:
        'Vrai si l’adresse est celle d’un compte de l’organisation. Toujours faux hors des admins de l’activité.',
    }),
  }),
})

const DepassementRef = builder
  .objectRef<RapportImport['depassements'][number]>('DepassementImport')
  .implement({
    fields: t => ({
      sequenceId: t.exposeID('sequenceId'),
      titre: t.exposeString('titre'),
      besoin: t.exposeInt('besoin'),
      renforts: t.exposeInt('renforts'),
    }),
  })

const RapportRef = builder
  .objectRef<RapportImport>('RapportImportBenevoles')
  .implement({
    fields: t => ({
      simulation: t.exposeBoolean('simulation'),
      personnes: t.exposeInt('personnes'),
      aImporter: t.exposeInt('aImporter'),
      dejaImportees: t.exposeInt('dejaImportees'),
      ecartees: t.exposeInt('ecartees'),
      fichesCreees: t.exposeInt('fichesCreees'),
      fichesRattachees: t.exposeInt('fichesRattachees'),
      places: t.exposeInt('places'),
      fichesRestantes: t.exposeInt('fichesRestantes'),
      depassements: t.field({
        type: [DepassementRef],
        complexity: { field: 1, multiplier: 2 },
        resolve: r => r.depassements,
      }),
      lignes: t.field({
        type: [LigneRef],
        complexity: { field: 1, multiplier: 5 },
        resolve: r => r.lignes,
      }),
    }),
  })

const ARGUMENTS_IMPORT = builder.args(t => ({
  editionId: t.id({ required: true }),
  perimetreId: t.id({
    description:
      'Le périmètre d’un import de périmètre. Sans valeur : le programme entier.',
  }),
  source: t.string({ required: true }),
  mode: t.field({ type: ModeImportEnum, required: true }),
  prevenirParMail: t.boolean({ defaultValue: true }),
  accepterTout: t.boolean({ defaultValue: false }),
  accord: t.boolean({
    required: true,
    description: 'Vrai : les personnes du fichier ont donné leur accord.',
  }),
  personnes: t.field({ type: [PersonneImportInput], required: true }),
}))

// ── Correspondances d'import ─────────────────────────────────────────────────

const ENTETES_MAX = 200
const JSON_MAX = 50_000
const NOM_CORRESPONDANCE_MAX = 120

const Entetes = z.array(z.string().max(200)).max(ENTETES_MAX)

interface CorrespondanceLue {
  correspondance: Prisma.CorrespondanceImportGetPayload<object>
  peutSupprimer: boolean
}

const CorrespondanceRef = builder
  .objectRef<CorrespondanceLue>('CorrespondanceImport')
  .implement({
    description:
      'Une association enregistrée des colonnes d’un fichier aux champs de Relaytour. Elle ne contient aucune donnée personnelle.',
    fields: t => ({
      id: t.id({ resolve: c => c.correspondance.id }),
      nom: t.string({ resolve: c => c.correspondance.nom }),
      entetes: t.stringList({
        resolve: c => Entetes.parse(c.correspondance.entetes),
      }),
      associations: t.field({
        type: 'JSONObject',
        resolve: c => c.correspondance.associations as Record<string, unknown>,
      }),
      reglages: t.field({
        type: 'JSONObject',
        resolve: c => c.correspondance.reglages as Record<string, unknown>,
      }),
      modifieeLe: t.field({
        type: 'DateTime',
        resolve: c => c.correspondance.updatedAt,
      }),
      peutSupprimer: t.boolean({ resolve: c => c.peutSupprimer }),
    }),
  })

/** L'activité, si la personne y importe : admin, ou affectée à un périmètre. */
async function activiteImportable(ctx: AppContext, id: string | number) {
  const activiteId = await ctx.exigerActivite(id)
  await exigerModule(activiteId, 'BENEVOLES')
  if (!(await ecritDansLActivite(ctx, activiteId))) throw accesRefuse()
  return activiteId
}

function objetBorne(
  valeur: unknown,
  quoi: 'associations' | 'reglages'
): Prisma.InputJsonObject {
  if (
    valeur === null ||
    typeof valeur !== 'object' ||
    Array.isArray(valeur) ||
    JSON.stringify(valeur).length > JSON_MAX
  ) {
    throw erreurSaisie(
      quoi === 'associations'
        ? i18n._('Les associations dépassent la taille permise.')
        : i18n._('Les réglages dépassent la taille permise.')
    )
  }
  return valeur
}

// ── Doublons possibles ───────────────────────────────────────────────────────

interface Doublon {
  a: Parameters<typeof lireBenevoles>[2][number]
  b: Parameters<typeof lireBenevoles>[2][number]
  niveau: 'FORT' | 'MOYEN' | 'FAIBLE'
}

/** Les doublons possibles d'une activité affichés au plus. */
const DOUBLONS_MAX = 200

builder.queryFields(t => ({
  simulerImportBenevoles: t.field({
    type: RapportRef,
    authScopes: { connecte: true },
    description:
      'Simule l’import d’un lot de 500 personnes au plus, sans rien écrire : lignes écartées, déjà importées, rapprochements et dépassements.',
    args: ARGUMENTS_IMPORT,
    resolve: (_root, args, ctx) =>
      importerLot(
        ctx,
        {
          ...args,
          prevenirParMail: args.prevenirParMail ?? true,
          accepterTout: args.accepterTout ?? false,
        },
        false
      ),
  }),

  correspondancesImport: t.field({
    type: [CorrespondanceRef],
    authScopes: { connecte: true },
    description:
      'Les correspondances d’import d’une activité, pour les personnes qui y importent.',
    args: { activiteId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const activiteId = await activiteImportable(ctx, args.activiteId)
      const admin = await ctx.estAdminDe(activiteId)
      const liste = await prisma.correspondanceImport.findMany({
        where: { organisationId: ctx.organisation!.id, activiteId },
        orderBy: [{ nom: 'asc' }, { id: 'asc' }],
      })
      return liste.map(correspondance => ({
        correspondance,
        peutSupprimer: admin || correspondance.creeParId === ctx.personne!.id,
      }))
    },
  }),

  doublonsBenevoles: t.field({
    type: [
      builder
        .objectRef<
          Doublon & { lus: Awaited<ReturnType<typeof lireBenevoles>> }
        >('DoublonBenevoles')
        .implement({
          description: 'Deux fiches qui désignent peut-être la même personne.',
          fields: f => ({
            a: f.field({ type: BenevoleRef, resolve: d => d.lus[0]! }),
            b: f.field({ type: BenevoleRef, resolve: d => d.lus[1]! }),
            niveau: f.field({ type: NiveauEnum, resolve: d => d.niveau }),
          }),
        }),
    ],
    authScopes: { connecte: true },
    description:
      'Les doublons possibles parmi les fiches d’une activité, les plus forts d’abord. Réservé aux admins de l’activité.',
    args: { activiteId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const activiteId = await ctx.exigerActivite(args.activiteId)
      await exigerModule(activiteId, 'BENEVOLES')
      await ctx.exigerAdminDe(activiteId)
      const [fiches, distinctes] = await Promise.all([
        prisma.benevole.findMany({
          where: { organisationId: ctx.organisation!.id, activiteId },
          include: AVEC_PLACES,
          orderBy: [{ nom: 'asc' }, { id: 'asc' }],
        }),
        prisma.paireDistincte.findMany({
          where: { activiteId },
          select: { benevoleAId: true, benevoleBId: true },
        }),
      ])
      const ecartees = new Set(
        distinctes.map(p => `${p.benevoleAId}:${p.benevoleBId}`)
      )
      const paires = pairesRapprochees(fiches)
        .map(p => {
          const [a, b] = [p.a, p.b].sort((x, y) => x.id.localeCompare(y.id))
          return { a: a!, b: b!, niveau: p.niveau }
        })
        .filter(p => !ecartees.has(`${p.a.id}:${p.b.id}`))
        .slice(0, DOUBLONS_MAX)
      return Promise.all(
        paires.map(async p => ({
          ...p,
          lus: await lireBenevoles(ctx, activiteId, [p.a, p.b]),
        }))
      )
    },
  }),
}))

builder.mutationFields(t => ({
  importerBenevoles: t.field({
    type: RapportRef,
    authScopes: { connecte: true },
    description:
      'Importe un lot de 500 personnes au plus dans l’appel d’import de sa source. Aucun mail ne part à l’import ; la première place d’une fiche joignable envoie son lien.',
    args: ARGUMENTS_IMPORT,
    resolve: (_root, args, ctx) =>
      importerLot(
        ctx,
        {
          ...args,
          prevenirParMail: args.prevenirParMail ?? true,
          accepterTout: args.accepterTout ?? false,
        },
        true
      ),
  }),

  enregistrerCorrespondanceImport: t.field({
    type: CorrespondanceRef,
    authScopes: { connecte: true },
    description:
      'Enregistre une correspondance d’import, ou remplace celle qui porte le même nom dans l’activité.',
    args: {
      activiteId: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      entetes: t.arg.stringList({ required: true }),
      associations: t.arg({ type: 'JSONObject', required: true }),
      reglages: t.arg({ type: 'JSONObject', required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const activiteId = await activiteImportable(ctx, args.activiteId)
      const entetes = Entetes.safeParse(args.entetes)
      if (!entetes.success) {
        throw erreurSaisie(
          i18n._('Une correspondance compte {max} colonnes au plus.', {
            max: ENTETES_MAX,
          })
        )
      }
      const donnees = {
        entetes: entetes.data,
        associations: objetBorne(args.associations, 'associations'),
        reglages: objetBorne(args.reglages, 'reglages'),
      }
      const nom = texteRequis(
        args.nom,
        i18n._('Le nom'),
        NOM_CORRESPONDANCE_MAX
      )
      const existante = await prisma.correspondanceImport.findUnique({
        where: { activiteId_nom: { activiteId, nom } },
      })
      const admin = await ctx.estAdminDe(activiteId)
      if (
        existante !== null &&
        !admin &&
        existante.creeParId !== ctx.personne!.id
      ) {
        throw erreurSaisie(
          i18n._(
            'Une correspondance porte déjà ce nom. Choisissez un autre nom.'
          )
        )
      }
      const correspondance = await prisma.correspondanceImport.upsert({
        where: { activiteId_nom: { activiteId, nom } },
        create: {
          organisationId: ctx.organisation!.id,
          activiteId,
          nom,
          creeParId: ctx.personne!.id,
          ...donnees,
        },
        update: donnees,
      })
      return { correspondance, peutSupprimer: true }
    },
  }),

  supprimerCorrespondanceImport: t.boolean({
    authScopes: { connecte: true },
    description:
      'Supprime une correspondance d’import. Réservé à la personne qui l’a créée et aux admins de l’activité.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const correspondance = await prisma.correspondanceImport.findFirst({
        where: { id: String(args.id), organisationId: ctx.organisation!.id },
      })
      if (correspondance === null) throw accesRefuse()
      await ctx.exigerActivite(correspondance.activiteId)
      await exigerModule(correspondance.activiteId, 'BENEVOLES')
      if (
        !(await ctx.estAdminDe(correspondance.activiteId)) &&
        correspondance.creeParId !== ctx.personne!.id
      ) {
        throw accesRefuse()
      }
      await prisma.correspondanceImport.delete({
        where: { id: correspondance.id },
      })
      return true
    },
  }),

  fusionnerBenevoles: t.field({
    type: BenevoleRef,
    authScopes: { connecte: true },
    description:
      'Fusionne deux fiches de la même activité : la fiche gardée reçoit les places, les plages et les candidatures de l’autre, qui disparaît. Réservé aux admins de l’activité.',
    args: {
      gardeeId: t.arg.id({ required: true }),
      autreId: t.arg.id({ required: true }),
      nomDe: t.arg({ type: CoteEnum, required: true }),
      courrielDe: t.arg({ type: CoteEnum, required: true }),
      telephoneDe: t.arg({ type: CoteEnum, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const fiches = await prisma.benevole.findMany({
        where: {
          id: { in: [String(args.gardeeId), String(args.autreId)] },
          organisationId: ctx.organisation!.id,
        },
        select: { id: true, activiteId: true },
      })
      const gardee = fiches.find(f => f.id === String(args.gardeeId))
      const autre = fiches.find(f => f.id === String(args.autreId))
      if (!gardee || !autre || gardee.activiteId !== autre.activiteId) {
        throw accesRefuse()
      }
      await ctx.exigerActivite(gardee.activiteId)
      await exigerModule(gardee.activiteId, 'BENEVOLES')
      await ctx.exigerAdminDe(gardee.activiteId)
      await fusionnerFiches({
        organisationId: ctx.organisation!.id,
        activiteId: gardee.activiteId,
        gardeeId: gardee.id,
        autreId: autre.id,
        choix: {
          nom: args.nomDe,
          courriel: args.courrielDe,
          telephone: args.telephoneDe,
        },
        acteurId: ctx.personne!.id,
      })
      publierPourActivite('PROGRAMME', ctx.organisation!.id, gardee.activiteId)
      publierPourActivite(
        'CANDIDATURE',
        ctx.organisation!.id,
        gardee.activiteId
      )
      const relue = await prisma.benevole.findUniqueOrThrow({
        where: { id: gardee.id },
        include: AVEC_PLACES,
      })
      const [lue] = await lireBenevoles(ctx, gardee.activiteId, [relue])
      return lue!
    },
  }),

  marquerBenevolesDistincts: t.boolean({
    authScopes: { connecte: true },
    description:
      'Déclare deux fiches distinctes : leur fusion ne se propose plus. Réservé aux admins de l’activité.',
    args: {
      aId: t.arg.id({ required: true }),
      bId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const [premiere, seconde] = [String(args.aId), String(args.bId)].sort()
      if (premiere === seconde) {
        throw erreurSaisie(i18n._('Choisissez deux fiches différentes.'))
      }
      const fiches = await prisma.benevole.findMany({
        where: {
          id: { in: [premiere!, seconde!] },
          organisationId: ctx.organisation!.id,
        },
        select: { activiteId: true },
      })
      if (
        fiches.length !== 2 ||
        fiches[0]!.activiteId !== fiches[1]!.activiteId
      ) {
        throw accesRefuse()
      }
      const activiteId = fiches[0]!.activiteId
      await ctx.exigerActivite(activiteId)
      await exigerModule(activiteId, 'BENEVOLES')
      await ctx.exigerAdminDe(activiteId)
      await prisma.paireDistincte.upsert({
        where: {
          activiteId_benevoleAId_benevoleBId: {
            activiteId,
            benevoleAId: premiere!,
            benevoleBId: seconde!,
          },
        },
        create: {
          organisationId: ctx.organisation!.id,
          activiteId,
          benevoleAId: premiere!,
          benevoleBId: seconde!,
          creeParId: ctx.personne!.id,
        },
        update: {},
      })
      return true
    },
  }),
}))
