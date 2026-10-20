import {
  EtatConnexionFichiers,
  FournisseurFichiers,
  Prisma,
  prisma,
} from '@relaytour/database'

import { cheminValide, formatApercu } from '../espace-fichiers/chemin.ts'
import { dossierLisible } from '../espace-fichiers/droits.ts'
import {
  lancerExportFiches,
  NOM_DOSSIER_EXPORT,
  type RapportExport,
} from '../espace-fichiers/export.ts'
import {
  commencerConnexion,
  configurationMicrosoft,
  erreurEspace,
  fournisseursDisponibles,
  oublierJetonAcces,
  ouvrirEspace,
} from '../espace-fichiers/index.ts'
import { adresseAutorisation } from '../espace-fichiers/sharepoint.ts'
import type { ElementEspace, EspaceFichiers } from '../espace-fichiers/types.ts'
import type { AppContext } from '../context.ts'
import { peutLireFiche } from '../lib/fiches.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierChangement, publierPourActivite } from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'

import { builder } from './builder.ts'
import { PerimetreRef } from './organisation.ts'

// Espace de fichiers d'une organisation (ADR 0038). Un admin de l'organisation le
// connecte et lie ses dossiers aux périmètres. Une personne lit un dossier lié
// comme les fiches du même périmètre. Relaytour ne copie aucun document.

export const FournisseurFichiersEnum = builder.enumType(FournisseurFichiers, {
  name: 'FournisseurFichiers',
})

const EtatConnexionFichiersEnum = builder.enumType(EtatConnexionFichiers, {
  name: 'EtatConnexionFichiers',
})

export const FormatApercuEnum = builder.enumType('FormatApercu', {
  description:
    'Ce que la liseuse affiche : un PDF, une image, un texte, du Markdown, un document bureautique converti en PDF par le fournisseur, ou rien (téléchargement).',
  values: [
    'PDF',
    'IMAGE',
    'TEXTE',
    'MARKDOWN',
    'PDF_CONVERTI',
    'AUCUN',
  ] as const,
})

// ── Types ────────────────────────────────────────────────────────────────────

const RefusExportRef = builder
  .objectRef<{ fiche: string; raison: string }>('RefusExport')
  .implement({
    fields: t => ({
      fiche: t.exposeString('fiche'),
      raison: t.exposeString('raison'),
    }),
  })

const RapportExportRef = builder
  .objectRef<RapportExport>('RapportExport')
  .implement({
    description:
      'Résultat du dernier export des fiches vers l’espace de fichiers.',
    fields: t => ({
      exporteLe: t.field({
        type: 'DateTime',
        resolve: r => new Date(r.exporteLe),
      }),
      ecrites: t.exposeInt('ecrites'),
      inchangees: t.exposeInt('inchangees'),
      supprimees: t.exposeInt('supprimees'),
      refusees: t.field({ type: [RefusExportRef], resolve: r => r.refusees }),
      modifieesALaMain: t.exposeStringList('modifieesALaMain'),
      erreur: t.exposeString('erreur', { nullable: true }),
    }),
  })

const ConnexionFichiersRef = builder.prismaObject('ConnexionFichiers', {
  description:
    'Connexion de l’organisation à son espace de fichiers. Le jeton ne sort jamais du serveur.',
  fields: t => ({
    fournisseur: t.expose('fournisseur', { type: FournisseurFichiersEnum }),
    compte: t.exposeString('compte'),
    etat: t.expose('etat', { type: EtatConnexionFichiersEnum }),
    connecteeLe: t.expose('updatedAt', { type: 'DateTime' }),
    connecteePar: t.string({
      nullable: true,
      select: { connectePar: { select: { name: true } } },
      resolve: c => c.connectePar?.name ?? null,
    }),
    exportDossier: t.exposeString('exportNom', {
      nullable: true,
      description:
        'Chemin du dossier où Relaytour exporte les fiches. Null : aucun export.',
    }),
    exportRapport: t.field({
      type: RapportExportRef,
      nullable: true,
      resolve: c => (c.exportRapport as RapportExport | null) ?? null,
    }),
  }),
})

/**
 * Identifiants de la racine d'une bibliothèque et de chaque dossier du chemin,
 * jusqu'au dernier compris. Un dossier absent n'a pas d'identifiant.
 */
async function idsDuChemin(
  espace: EspaceFichiers,
  emplacement: string,
  chemin: readonly string[]
): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i <= chemin.length; i++) {
    const element = await espace.element({
      emplacement,
      base: null,
      chemin: chemin.slice(0, i),
    })
    if (element !== null) ids.push(element.id)
  }
  return ids
}

interface EspaceFichiersVue {
  fournisseursDisponibles: FournisseurFichiers[]
  organisationId: string
}

const EspaceFichiersRef = builder
  .objectRef<EspaceFichiersVue>('EspaceFichiers')
  .implement({
    fields: t => ({
      fournisseursDisponibles: t.field({
        type: [FournisseurFichiersEnum],
        description:
          'Fournisseurs ouverts par l’exploitant de l’installation. Vide : l’espace de fichiers n’est pas proposé.',
        resolve: v => v.fournisseursDisponibles,
      }),
      connexion: t.prismaField({
        type: ConnexionFichiersRef,
        nullable: true,
        resolve: (query, v) =>
          prisma.connexionFichiers.findUnique({
            ...query,
            where: { organisationId: v.organisationId },
          }),
      }),
    }),
  })

const EmplacementFichiersRef = builder
  .objectRef<{ id: string; nom: string; site: string | null }>(
    'EmplacementFichiers'
  )
  .implement({
    description:
      'Bibliothèque de documents visible par le compte connecté : son OneDrive, ou la bibliothèque d’un site.',
    fields: t => ({
      id: t.exposeString('id'),
      nom: t.exposeString('nom'),
      site: t.exposeString('site', { nullable: true }),
    }),
  })

type ElementVue = ElementEspace & {
  apercu: ReturnType<typeof formatApercu>
}

const ElementFichiersRef = builder
  .objectRef<ElementVue>('ElementFichiers')
  .implement({
    description: 'Dossier ou fichier de l’espace de fichiers.',
    fields: t => ({
      // Pas de champ `id` : le cache du navigateur fusionnerait un même fichier
      // lu depuis deux dossiers liés.
      elementId: t.exposeString('id'),
      nom: t.exposeString('nom'),
      dossier: t.exposeBoolean('dossier'),
      taille: t.exposeFloat('taille', { nullable: true }),
      modifieLe: t.expose('modifieLe', { type: 'DateTime', nullable: true }),
      lienWeb: t.exposeString('lienWeb', { nullable: true }),
      apercu: t.expose('apercu', { type: FormatApercuEnum }),
    }),
  })

const ListeElementsFichiersRef = builder
  .objectRef<{ elements: ElementVue[]; complet: boolean }>(
    'ListeElementsFichiers'
  )
  .implement({
    description:
      'Contenu d’un dossier. `complet` est faux quand le dossier compte plus d’éléments que Relaytour n’en lit en une fois.',
    fields: t => ({
      elements: t.field({
        type: [ElementFichiersRef],
        resolve: l => l.elements,
      }),
      complet: t.exposeBoolean('complet'),
    }),
  })

export const DossierLieRef = builder.prismaObject('DossierLie', {
  description:
    'Dossier de l’espace de fichiers lié à un périmètre, ou à toute l’activité quand le périmètre est nul.',
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('nom'),
    activiteId: t.exposeID('activiteId'),
    perimetre: t.relation('perimetre', { type: PerimetreRef, nullable: true }),
    fournisseur: t.expose('fournisseur', { type: FournisseurFichiersEnum }),
    disponible: t.boolean({
      description:
        'Vrai quand l’espace connecté est actif et vient du même fournisseur que le dossier.',
      resolve: async d => {
        const connexion = await prisma.connexionFichiers.findUnique({
          where: { organisationId: d.organisationId },
          select: { fournisseur: true, etat: true },
        })
        return (
          connexion?.etat === 'ACTIVE' &&
          connexion.fournisseur === d.fournisseur
        )
      },
    }),
  }),
})

// ── Aides ────────────────────────────────────────────────────────────────────

function vue(espace: EspaceFichiers, e: ElementEspace): ElementVue {
  return {
    ...e,
    apercu: e.dossier
      ? 'AUCUN'
      : formatApercu(e.nom, nom => espace.convertitEnPdf(nom)),
  }
}

/** Dossiers d'abord, puis fichiers, chacun par ordre alphabétique. */
function trier(elements: ElementVue[]): ElementVue[] {
  return [...elements].sort(
    (a, b) =>
      Number(b.dossier) - Number(a.dossier) ||
      a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })
  )
}

function exigerChemin(chemin: readonly string[]): void {
  if (!cheminValide(chemin)) throw erreurSaisie('Chemin de dossier invalide.')
}

async function espaceDe(ctx: AppContext): Promise<EspaceFichiers> {
  try {
    return (await ouvrirEspace(ctx.organisation!.id)).espace
  } catch (erreur) {
    throw erreurEspace(erreur)
  }
}

async function avecEspace<T>(
  ctx: AppContext,
  action: (espace: EspaceFichiers) => Promise<T>
): Promise<T> {
  const espace = await espaceDe(ctx)
  try {
    return await action(espace)
  } catch (erreur) {
    throw erreurEspace(erreur)
  }
}

// ── Requêtes ─────────────────────────────────────────────────────────────────

builder.queryFields(t => ({
  espaceFichiers: t.field({
    type: EspaceFichiersRef,
    authScopes: { admin: true },
    resolve: async (_root, _args, ctx) => ({
      fournisseursDisponibles: await fournisseursDisponibles(),
      organisationId: ctx.organisation!.id,
    }),
  }),

  emplacementsFichiers: t.field({
    type: [EmplacementFichiersRef],
    authScopes: { admin: true },
    description:
      'Bibliothèques de documents du compte connecté, pour choisir un dossier à lier.',
    resolve: (_root, _args, ctx) =>
      avecEspace(ctx, espace => espace.emplacements()),
  }),

  parcourirEspaceFichiers: t.field({
    type: ListeElementsFichiersRef,
    authScopes: { admin: true },
    description:
      'Sous-dossiers d’un dossier de l’espace connecté, pour choisir un dossier à lier. Les fichiers ne s’y listent pas.',
    args: {
      emplacement: t.arg.string({ required: true }),
      chemin: t.arg.stringList({ required: true }),
    },
    resolve: async (_root, { emplacement, chemin }, ctx) => {
      exigerChemin(chemin)
      return avecEspace(ctx, async espace => {
        const liste = await espace.lister({
          emplacement,
          base: null,
          chemin,
        })
        if (liste === null) throw erreurSaisie('Dossier introuvable.')
        return {
          elements: trier(
            liste.elements.filter(e => e.dossier).map(e => vue(espace, e))
          ),
          complet: liste.complet,
        }
      })
    },
  }),

  dossiersLies: t.prismaField({
    type: [DossierLieRef],
    authScopes: { connecte: true },
    description:
      'Dossiers liés que la personne lit dans une activité. Avec un périmètre : ceux de ce périmètre et ceux de toute l’activité.',
    args: {
      activiteId: t.arg.id(),
      perimetreId: t.arg.id(),
    },
    resolve: async (query, _root, { activiteId, perimetreId }, ctx) => {
      const activite = await ctx.exigerActivite(activiteId)
      const dossiers = await prisma.dossierLie.findMany({
        ...query,
        where: {
          organisationId: ctx.organisation!.id,
          activiteId: activite,
          ...(perimetreId === null || perimetreId === undefined
            ? {}
            : {
                OR: [
                  { perimetreId: String(perimetreId) },
                  { perimetreId: null },
                ],
              }),
        },
        orderBy: [{ perimetreId: 'asc' }, { nom: 'asc' }],
      })
      const lisibles = await Promise.all(
        dossiers.map(d =>
          peutLireFiche(ctx, {
            organisationId: d.organisationId,
            activiteId: d.activiteId,
            perimetreId: d.perimetreId,
          })
        )
      )
      return dossiers.filter((_d, i) => lisibles[i])
    },
  }),

  contenuDossierLie: t.field({
    type: ListeElementsFichiersRef,
    authScopes: { connecte: true },
    description:
      'Dossiers et fichiers d’un dossier lié, ou d’un de ses sous-dossiers désigné par un chemin de noms.',
    args: {
      id: t.arg.id({ required: true }),
      chemin: t.arg.stringList({ required: true }),
    },
    resolve: async (_root, { id, chemin }, ctx) => {
      const dossier = await dossierLisible(ctx, String(id))
      if (dossier === null) throw accesRefuse()
      exigerChemin(chemin)
      return avecEspace(ctx, async espace => {
        if (espace.fournisseur !== dossier.fournisseur) {
          throw erreurEspace(new Error('Fournisseur différent.'))
        }
        const liste = await espace.lister({
          emplacement: dossier.emplacement,
          base: dossier.element,
          chemin,
        })
        if (liste === null) throw erreurSaisie('Dossier introuvable.')
        return {
          elements: trier(liste.elements.map(e => vue(espace, e))),
          complet: liste.complet,
        }
      })
    },
  }),
}))

// ── Mutations ────────────────────────────────────────────────────────────────

builder.mutationFields(t => ({
  commencerConnexionEspaceFichiers: t.string({
    authScopes: { admin: true },
    description:
      'Adresse où l’admin se connecte chez le fournisseur pour accorder l’accès à Relaytour. Elle vaut dix minutes, une seule fois.',
    args: {
      fournisseur: t.arg({ type: FournisseurFichiersEnum, required: true }),
    },
    resolve: async (_root, { fournisseur }, ctx) => {
      const configuration = await configurationMicrosoft()
      if (fournisseur !== 'SHAREPOINT' || configuration === null) {
        throw erreurSaisie(
          'Ce fournisseur n’est pas ouvert sur cette installation.'
        )
      }
      const { etat, defi } = await commencerConnexion({
        organisationId: ctx.organisation!.id,
        userId: ctx.personne!.id,
        fournisseur,
      })
      return adresseAutorisation(configuration, etat, defi)
    },
  }),

  deconnecterEspaceFichiers: t.boolean({
    authScopes: { admin: true },
    description:
      'Efface le jeton de l’espace de fichiers. Les dossiers liés restent, indisponibles jusqu’à une nouvelle connexion.',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const connexion = await prisma.connexionFichiers.findUnique({
        where: { organisationId },
        select: { id: true, jeton: true },
      })
      if (connexion === null) return false
      await prisma.ficheExportee.deleteMany({ where: { organisationId } })
      await prisma.connexionFichiers.delete({ where: { id: connexion.id } })
      oublierJetonAcces(connexion.jeton)
      journal.info(
        {
          evenement: 'espace-fichiers-deconnecte',
          organisationId,
          acteurId: ctx.personne!.id,
        },
        'Un espace de fichiers a été déconnecté.'
      )
      void publierChangement({ entite: 'FICHIERS', organisationId })
      return true
    },
  }),

  lierDossier: t.prismaField({
    type: DossierLieRef,
    authScopes: { admin: true },
    description:
      'Lie un dossier de l’espace connecté à un périmètre, ou à toute l’activité sans périmètre.',
    args: {
      activiteId: t.arg.id({ required: true }),
      perimetreId: t.arg.id(),
      emplacement: t.arg.string({ required: true }),
      chemin: t.arg.stringList({ required: true }),
    },
    resolve: async (
      query,
      _root,
      { activiteId, perimetreId, emplacement, chemin },
      ctx
    ) => {
      const organisationId = ctx.organisation!.id
      exigerChemin(chemin)
      // Une bibliothèque entière ne se lie pas : l'admin choisit un dossier.
      if (chemin.length === 0) throw erreurSaisie('Choisissez un dossier.')
      const activite = await prisma.activite.findFirst({
        where: { id: String(activiteId), organisationId },
        select: { id: true },
      })
      if (activite === null) throw accesRefuse()
      const perimetre =
        perimetreId === null || perimetreId === undefined
          ? null
          : await prisma.perimetre.findFirst({
              where: {
                id: String(perimetreId),
                organisationId,
                activiteId: activite.id,
              },
              select: { id: true },
            })
      if (perimetreId != null && perimetre === null) throw accesRefuse()
      const { espace, element } = await avecEspace(ctx, async espace => ({
        espace,
        element: await espace.element({ emplacement, base: null, chemin }),
      }))
      if (element === null || !element.dossier) {
        throw erreurSaisie('Ce dossier n’existe pas dans l’espace de fichiers.')
      }
      // Le dossier d'export contient les fiches de tous les périmètres : ni lui,
      // ni un dossier qui le contient, ni un de ses sous-dossiers ne se lie.
      const exportation = await prisma.connexionFichiers.findUnique({
        where: { organisationId },
        select: {
          exportEmplacement: true,
          exportElement: true,
          exportAncetres: true,
        },
      })
      if (
        exportation?.exportElement != null &&
        exportation.exportEmplacement === emplacement
      ) {
        const ancetres = (exportation.exportAncetres as string[] | null) ?? []
        const parcours = await avecEspace(ctx, e =>
          idsDuChemin(e, emplacement, chemin)
        )
        if (
          ancetres.includes(element.id) ||
          parcours.includes(exportation.exportElement)
        ) {
          throw erreurSaisie(
            'Ce dossier contient le dossier d’export des fiches, ou s’y trouve. Choisissez un autre dossier.'
          )
        }
      }
      const cle = {
        organisationId,
        activiteId: activite.id,
        perimetreId: perimetre?.id ?? null,
        emplacement,
        element: element.id,
      }
      // Sous le verrou de l'organisation : deux liens simultanés du même dossier
      // n'en créent qu'un. Sans périmètre, la contrainte d'unicité ne l'empêche
      // pas, car MariaDB admet plusieurs valeurs nulles.
      const dossier = await sousVerrouOrganisation(
        organisationId,
        async tx =>
          (await tx.dossierLie.findFirst({ where: cle })) ??
          tx.dossierLie.create({
            data: {
              ...cle,
              fournisseur: espace.fournisseur,
              nom: element.nom,
              creeParId: ctx.personne!.id,
            },
          })
      )
      publierPourActivite('FICHIERS', organisationId, activite.id, {
        id: dossier.id,
        perimetreId: dossier.perimetreId,
      })
      return prisma.dossierLie.findUniqueOrThrow({
        ...query,
        where: { id: dossier.id },
      })
    },
  }),

  choisirDossierExport: t.prismaField({
    type: ConnexionFichiersRef,
    authScopes: { admin: true },
    description:
      'Crée le dossier d’export des fiches dans le dossier choisi, puis lance un premier export. Le dossier choisi ne doit être ni lié, ni dans un dossier lié.',
    args: {
      emplacement: t.arg.string({ required: true }),
      chemin: t.arg.stringList({ required: true }),
    },
    resolve: async (query, _root, { emplacement, chemin }, ctx) => {
      const organisationId = ctx.organisation!.id
      exigerChemin(chemin)
      const { parent, ids, espace } = await avecEspace(ctx, async espace => ({
        espace,
        parent: await espace.element({ emplacement, base: null, chemin }),
        ids: await idsDuChemin(espace, emplacement, chemin),
      }))
      if (parent === null || !parent.dossier) {
        throw erreurSaisie('Ce dossier n’existe pas dans l’espace de fichiers.')
      }
      const lies = await prisma.dossierLie.count({
        where: { organisationId, emplacement, element: { in: ids } },
      })
      if (lies > 0) {
        throw erreurSaisie(
          'Ce dossier est lié à une activité, ou se trouve dans un dossier lié. Les membres y liraient les fiches de tous les périmètres : choisissez un autre dossier.'
        )
      }
      const cree = await avecEspace(ctx, () =>
        espace.creerDossier(
          { emplacement, base: null, chemin },
          NOM_DOSSIER_EXPORT,
          { renommer: true }
        )
      )
      await prisma.ficheExportee.deleteMany({ where: { organisationId } })
      const connexion = await prisma.connexionFichiers.update({
        ...query,
        where: { organisationId },
        data: {
          exportEmplacement: emplacement,
          exportElement: cree.id,
          exportNom: [...chemin, cree.nom].join(' / '),
          exportAncetres: [...ids, cree.id],
          exportRapport: Prisma.DbNull,
          exportLe: null,
        },
      })
      await lancerExportFiches(organisationId).catch(() => undefined)
      void publierChangement({ entite: 'FICHIERS', organisationId })
      return connexion
    },
  }),

  retirerDossierExport: t.boolean({
    authScopes: { admin: true },
    description:
      'Arrête l’export des fiches. Les fichiers déjà écrits restent dans l’espace de fichiers.',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const { count } = await prisma.connexionFichiers.updateMany({
        where: { organisationId },
        data: {
          exportEmplacement: null,
          exportElement: null,
          exportNom: null,
          exportAncetres: Prisma.DbNull,
          exportRapport: Prisma.DbNull,
          exportLe: null,
        },
      })
      await prisma.ficheExportee.deleteMany({ where: { organisationId } })
      void publierChangement({ entite: 'FICHIERS', organisationId })
      return count > 0
    },
  }),

  exporterFichesMaintenant: t.boolean({
    authScopes: { admin: true },
    description:
      'Lance tout de suite l’export des fiches vers l’espace de fichiers. Le résultat arrive dans le rapport d’export.',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const connexion = await prisma.connexionFichiers.findUnique({
        where: { organisationId },
        select: { exportElement: true, etat: true },
      })
      if (connexion?.exportElement == null || connexion.etat !== 'ACTIVE') {
        throw erreurSaisie('Aucun dossier d’export n’est choisi.')
      }
      try {
        await lancerExportFiches(organisationId)
      } catch {
        throw erreurSaisie(
          'L’export n’a pas pu être lancé. Réessayez dans quelques instants.'
        )
      }
      return true
    },
  }),

  delierDossier: t.boolean({
    authScopes: { admin: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const organisationId = ctx.organisation!.id
      const dossier = await prisma.dossierLie.findFirst({
        where: { id: String(id), organisationId },
        select: { id: true, activiteId: true, perimetreId: true },
      })
      if (dossier === null) throw accesRefuse()
      await prisma.dossierLie.delete({ where: { id: dossier.id } })
      publierPourActivite('FICHIERS', organisationId, dossier.activiteId, {
        id: dossier.id,
        perimetreId: dossier.perimetreId,
      })
      return true
    },
  }),
}))
