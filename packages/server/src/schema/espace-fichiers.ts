import {
  AttendusDossier,
  EtatConnexionFichiers,
  FournisseurFichiers,
  MethodeConnexionFichiers,
  PorteeConnexionFichiers,
  Prisma,
  prisma,
} from '@relaytour/database'

import { cheminValide, formatApercu } from '../espace-fichiers/chemin.ts'
import {
  conditionDossiersLisibles,
  dossierCompatible,
  dossierLisiblePour,
  publierDossierLie,
  SELECTION_LECTEURS,
  type LecteursDossier,
} from '../espace-fichiers/droits.ts'
import {
  ancetresDeLExport,
  cheminDeLExportSous,
  dansLExport,
  lignee,
} from '../espace-fichiers/isolement.ts'
import {
  lancerExportFiches,
  NOM_DOSSIER_EXPORT,
  type RapportExport,
} from '../espace-fichiers/export.ts'
import {
  commencerConnexion,
  configurationMicrosoft,
  erreurEspace,
  configurationDropbox,
  configurationGoogle,
  configurationNextcloud,
  connexionsPossibles,
  documentNatif,
  enregistrerConnexion,
  espaceDeTest,
  garderConnexionNextcloud,
  lireConnexionNextcloud,
  memoriserJetonAcces,
  oublierConnexionNextcloud,
  oublierJetonAcces,
  ouvrirEspace,
} from '../espace-fichiers/index.ts'
import {
  baseAdmise,
  commencerLoginNextcloud,
  compteNextcloud,
  sonderLoginNextcloud,
  type SecretNextcloud,
} from '../espace-fichiers/nextcloud.ts'
import {
  adresseAutorisationGoogle,
  jetonCompteService,
  lireCleCompteService,
  MON_DRIVE,
  PARTAGES,
} from '../espace-fichiers/google.ts'
import { adresseAutorisation } from '../espace-fichiers/sharepoint.ts'
import { adresseAutorisationDropbox } from '../espace-fichiers/dropbox.ts'
import {
  FournisseurIndisponible,
  type ElementEspace,
  type EspaceFichiers,
} from '../espace-fichiers/types.ts'
import type { AppContext } from '../context.ts'
import { planifierVerificationAcces } from '../espace-fichiers/acces.ts'
import { lireGroupes } from '../lib/activites.ts'
import { perimetresLisibles } from '../lib/droits.ts'
import { perimetresLisiblesActifs } from '../lib/fiches-connexes.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { publierChangement } from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
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

export const PorteeConnexionFichiersEnum = builder.enumType(
  PorteeConnexionFichiers,
  {
    name: 'PorteeConnexionFichiers',
    description:
      'Ce que la connexion permet en plus des fichiers : lire l’annuaire et les droits, puis appliquer les propositions d’accès (ADR 0044).',
  }
)

export const AttendusDossierEnum = builder.enumType(AttendusDossier, {
  name: 'AttendusDossier',
  description:
    'Les personnes qu’un dossier lié attend chez le fournisseur : tous les membres de la période, ou les contacts principaux seulement (ADR 0044).',
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

const DebutConnexionNextcloudRef = builder
  .objectRef<{ connexion: string; etat: string }>('DebutConnexionNextcloud')
  .implement({
    description:
      'Connexion à Nextcloud commencée : la page où l’admin accorde l’accès, et l’état à présenter ensuite.',
    fields: t => ({
      connexion: t.exposeString('connexion'),
      etat: t.exposeString('etat'),
    }),
  })

/** Une erreur d'adresse ou de réponse de Nextcloud, que l'admin peut corriger. */
function erreurNextcloud(erreur: unknown): Error {
  return erreur instanceof FournisseurIndisponible
    ? erreurSaisie(erreur.message)
    : erreurEspace(erreur)
}

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

const MethodeConnexionEnum = builder.enumType(MethodeConnexionFichiers, {
  name: 'MethodeConnexionFichiers',
})

const ConnexionPossibleRef = builder
  .objectRef<{
    fournisseur: FournisseurFichiers
    methode: MethodeConnexionFichiers
  }>('ConnexionPossible')
  .implement({
    description:
      'Une façon de connecter l’espace de fichiers, ouverte par l’exploitant.',
    fields: t => ({
      fournisseur: t.expose('fournisseur', { type: FournisseurFichiersEnum }),
      methode: t.expose('methode', { type: MethodeConnexionEnum }),
    }),
  })

const ConnexionFichiersRef = builder.prismaObject('ConnexionFichiers', {
  description:
    'Connexion de l’organisation à son espace de fichiers. Le jeton ne sort jamais du serveur.',
  fields: t => ({
    fournisseur: t.expose('fournisseur', { type: FournisseurFichiersEnum }),
    methode: t.expose('methode', { type: MethodeConnexionEnum }),
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
    portee: t.expose('portee', { type: PorteeConnexionFichiersEnum }),
    accesVerifieLe: t.expose('accesVerifieLe', {
      type: 'DateTime',
      nullable: true,
      description: 'Dernière vérification des accès chez le fournisseur.',
    }),
    accesErreur: t.exposeString('accesErreur', { nullable: true }),
  }),
})

interface EspaceFichiersVue {
  connexionsPossibles: {
    fournisseur: FournisseurFichiers
    methode: MethodeConnexionFichiers
  }[]
  organisationId: string
}

const EspaceFichiersRef = builder
  .objectRef<EspaceFichiersVue>('EspaceFichiers')
  .implement({
    fields: t => ({
      connexionsPossibles: t.field({
        type: [ConnexionPossibleRef],
        description:
          'Connexions ouvertes par l’exploitant de l’installation. Vide : l’espace de fichiers n’est pas proposé.',
        resolve: v => v.connexionsPossibles,
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

interface LecteursLus {
  touteActivite: boolean
  perimetres: Prisma.PerimetreGetPayload<object>[]
  groupes: string[]
}

const LecteursLusRef = builder
  .objectRef<LecteursLus>('LecteursLusDossier')
  .implement({
    description:
      'Les lecteurs d’un dossier lié par lesquels la personne le lit : toute l’activité, des périmètres de la liste, des groupes de la liste.',
    fields: t => ({
      touteActivite: t.exposeBoolean('touteActivite'),
      perimetres: t.field({
        type: [PerimetreRef],
        resolve: l => l.perimetres,
      }),
      groupes: t.exposeStringList('groupes'),
    }),
  })

export const DossierLieRef = builder.prismaObject('DossierLie', {
  description:
    'Dossier du fournisseur cloud lié à une activité. Il sert toute l’activité, ou une liste de périmètres et de groupes (ADR 0043).',
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('nom'),
    activiteId: t.exposeID('activiteId'),
    perimetre: t.relation('perimetre', {
      type: PerimetreRef,
      nullable: true,
      deprecationReason:
        'Un dossier lié a plusieurs lecteurs : lire touteActivite, perimetres et groupes.',
    }),
    touteActivite: t.exposeBoolean('touteActivite', {
      description: 'Vrai : le dossier sert toute l’activité.',
    }),
    attendus: t.expose('attendus', { type: AttendusDossierEnum }),
    perimetres: t.field({
      type: [PerimetreRef],
      complexity: { field: 1, multiplier: 2 },
      description: 'Les périmètres nommés dans la liste des lecteurs.',
      select: {
        perimetres: { select: { perimetre: true } },
      },
      resolve: d =>
        d.perimetres
          .map(p => p.perimetre)
          .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    }),
    groupes: t.stringList({
      description:
        'Les clés des groupes de la liste. Un groupe vaut pour ses périmètres non archivés.',
      select: { groupes: { select: { groupe: true } } },
      resolve: d => d.groupes.map(g => g.groupe).sort(),
    }),
    lecteursLus: t.field({
      type: LecteursLusRef,
      description:
        'Les lecteurs par lesquels la personne lit ce dossier. La vue « Documents » range le dossier sous chacun.',
      select: { activiteId: true, ...SELECTION_LECTEURS },
      resolve: async (d, _args, ctx) => {
        if (d.touteActivite) {
          return { touteActivite: true, perimetres: [], groupes: [] }
        }
        const [lisibles, actifs] = await Promise.all([
          perimetresLisibles(ctx),
          perimetresLisiblesActifs(ctx),
        ])
        const lus = new Set(lisibles)
        const groupesLus = new Set(
          actifs.filter(p => p.activiteId === d.activiteId).map(p => p.groupe)
        )
        const ids = d.perimetres
          .map(p => p.perimetreId)
          .filter(id => lus.has(id))
        return {
          touteActivite: false,
          perimetres:
            ids.length === 0
              ? []
              : await prisma.perimetre.findMany({
                  where: { id: { in: ids } },
                  orderBy: [{ nom: 'asc' }, { id: 'asc' }],
                }),
          groupes: d.groupes
            .map(g => g.groupe)
            .filter(g => groupesLus.has(g))
            .sort(),
        }
      },
    }),
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

const LecteursDossierInput = builder.inputType('LecteursDossierInput', {
  description:
    'Les lecteurs d’un dossier lié : toute l’activité, ou une liste de périmètres et de groupes de l’activité.',
  fields: t => ({
    touteActivite: t.boolean({ required: true }),
    perimetreIds: t.idList({ required: true }),
    groupes: t.stringList({ required: true }),
  }),
})

interface FicheTouchee {
  id: string
  titre: string
}

const FicheToucheeRef = builder
  .objectRef<FicheTouchee>('FicheToucheeParLecteurs')
  .implement({
    fields: t => ({
      id: t.exposeID('id'),
      titre: t.exposeString('titre'),
    }),
  })

interface EffetsLecteurs {
  documentsMasques: number
  fiches: FicheTouchee[]
}

const EffetsLecteursRef = builder
  .objectRef<EffetsLecteurs>('EffetsLecteursDossier')
  .implement({
    description:
      'Ce que de nouveaux lecteurs changeraient aux documents liés des fiches.',
    fields: t => ({
      documentsMasques: t.exposeInt('documentsMasques', {
        description:
          'Documents liés que les lecteurs de leur fiche ne liraient plus : la fiche les masquerait.',
      }),
      fiches: t.field({
        type: [FicheToucheeRef],
        description: 'Les fiches qui portent ces documents.',
        resolve: e => e.fiches,
      }),
    }),
  })

// ── Aides ────────────────────────────────────────────────────────────────────

function vue(espace: EspaceFichiers, e: ElementEspace): ElementVue {
  return {
    ...e,
    apercu: e.dossier
      ? 'AUCUN'
      : formatApercu(
          e.nom,
          nom => espace.convertitEnPdf(nom, e.typeMime),
          documentNatif(espace.fournisseur, e.typeMime)
        ),
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
  if (!cheminValide(chemin))
    throw erreurSaisie(i18n._('Chemin de dossier invalide.'))
}

/** Les lecteurs actuels d'un dossier lié, sous la forme que lit `validerLecteurs`. */
const lecteursExistants = (d: LecteursDossier) => ({
  perimetreIds: d.perimetres.map(p => p.perimetreId),
  groupes: d.groupes.map(g => g.groupe),
})

/** Une liste de lecteurs compte au plus cent périmètres et groupes. */
const LECTEURS_MAX = 100

interface LecteursValides {
  touteActivite: boolean
  perimetreIds: string[]
  groupes: string[]
  /**
   * Les périmètres que la liste désigne aujourd'hui, dans l'ordre de la saisie :
   * l'ancienne colonne `perimetreId` prend le premier qui convient.
   */
  designes: string[]
}

/**
 * Vérifie les lecteurs saisis pour un dossier de cette activité. Un périmètre d'une
 * autre activité ou d'une autre organisation vaut un périmètre inconnu. Un groupe
 * doit être déclaré par l'activité et compter au moins un périmètre non archivé.
 */
async function validerLecteurs(
  organisationId: string,
  activiteId: string,
  saisie: {
    touteActivite: boolean
    perimetreIds: readonly (string | number)[]
    groupes: readonly string[]
  },
  /**
   * Les lecteurs actuels d'un lien qu'un admin modifie : un périmètre archivé ou
   * un groupe vide qu'ils nomment déjà reste admis, pour ne pas perdre sa lecture.
   */
  existants: { perimetreIds: string[]; groupes: string[] } = {
    perimetreIds: [],
    groupes: [],
  }
): Promise<LecteursValides> {
  const perimetreIds = [...new Set(saisie.perimetreIds.map(String))]
  const groupes = [...new Set(saisie.groupes.map(g => g.trim()))]
  if (saisie.touteActivite) {
    if (perimetreIds.length + groupes.length > 0) {
      throw erreurSaisie(
        i18n._(
          'Choisissez toute l’activité, ou une liste de périmètres et de groupes.'
        )
      )
    }
    return { touteActivite: true, perimetreIds: [], groupes: [], designes: [] }
  }
  if (perimetreIds.length + groupes.length === 0) {
    throw erreurSaisie(i18n._('Choisissez au moins un périmètre ou un groupe.'))
  }
  if (perimetreIds.length + groupes.length > LECTEURS_MAX) {
    throw erreurSaisie(
      i18n._('Un dossier lié compte au plus {max} périmètres et groupes.', {
        max: LECTEURS_MAX,
      })
    )
  }
  const trouves = await prisma.perimetre.count({
    where: {
      id: { in: perimetreIds },
      organisationId,
      activiteId,
      OR: [{ archivedAt: null }, { id: { in: existants.perimetreIds } }],
    },
  })
  if (trouves !== perimetreIds.length) throw accesRefuse()
  const activite = await prisma.activite.findUniqueOrThrow({
    where: { id: activiteId },
    select: { groupes: true },
  })
  const declares = new Set(lireGroupes(activite.groupes).map(g => g.cle))
  const inconnu = groupes.find(g => !declares.has(g))
  if (inconnu !== undefined) {
    throw erreurSaisie(
      i18n._('L’activité ne déclare pas le groupe « {groupe} ».', {
        groupe: inconnu,
      })
    )
  }
  const membres =
    groupes.length === 0
      ? []
      : await prisma.perimetre.findMany({
          where: { activiteId, groupe: { in: groupes }, archivedAt: null },
          select: { id: true, groupe: true },
          orderBy: [{ nom: 'asc' }, { id: 'asc' }],
        })
  const vide = groupes.find(
    g => !existants.groupes.includes(g) && !membres.some(m => m.groupe === g)
  )
  if (vide !== undefined) {
    throw erreurSaisie(
      i18n._('Le groupe « {groupe} » ne compte aucun périmètre.', {
        groupe: vide,
      })
    )
  }
  const parGroupe = groupes.flatMap(g =>
    membres.filter(m => m.groupe === g).map(m => m.id)
  )
  return {
    touteActivite: false,
    perimetreIds,
    groupes,
    designes: [...new Set([...perimetreIds, ...parGroupe])],
  }
}

/**
 * Le périmètre qu'écrit l'ancienne colonne `perimetreId` : le premier périmètre
 * désigné qu'aucun autre lien du même dossier ne porte, ou null pour toute
 * l'activité. Une version antérieure lit ainsi moins de personnes, jamais plus.
 */
async function perimetreHistorique(
  tx: Prisma.TransactionClient,
  cle: {
    organisationId: string
    activiteId: string
    emplacement: string
    element: string
  },
  lecteurs: LecteursValides,
  sauf?: string
): Promise<string | null> {
  if (lecteurs.touteActivite) return null
  const pris = new Set(
    (
      await tx.dossierLie.findMany({
        where: { ...cle, ...(sauf === undefined ? {} : { id: { not: sauf } }) },
        select: { perimetreId: true },
      })
    ).map(d => d.perimetreId)
  )
  const libre = lecteurs.designes.find(id => !pris.has(id))
  if (libre === undefined) {
    throw erreurSaisie(
      i18n._(
        'Ce dossier est aussi lié à ces périmètres par un autre lien. Retirez l’autre lien, puis recommencez.'
      )
    )
  }
  return libre
}

/** Les listes de lecteurs à écrire pour un dossier lié. */
function listesDeLecteurs(dossierLieId: string, lecteurs: LecteursValides) {
  return {
    perimetres: lecteurs.perimetreIds.map(perimetreId => ({
      dossierLieId,
      perimetreId,
    })),
    groupes: lecteurs.groupes.map(groupe => ({ dossierLieId, groupe })),
  }
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
      connexionsPossibles: await connexionsPossibles(),
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
        if (liste === null) throw erreurSaisie(i18n._('Dossier introuvable.'))
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
      'Dossiers liés que la personne lit dans une activité. Avec un périmètre : ceux qui servent ce périmètre, directement, par son groupe ou pour toute l’activité.',
    args: {
      activiteId: t.arg.id(),
      perimetreId: t.arg.id(),
    },
    resolve: async (query, _root, { activiteId, perimetreId }, ctx) => {
      const activite = await ctx.exigerActivite(activiteId)
      const lisibles = await conditionDossiersLisibles(ctx, activite)
      if (lisibles === null) return []
      let servi: Prisma.DossierLieWhereInput = {}
      if (perimetreId !== null && perimetreId !== undefined) {
        const perimetre = await prisma.perimetre.findFirst({
          where: {
            id: String(perimetreId),
            organisationId: ctx.organisation!.id,
            activiteId: activite,
          },
          select: { id: true, groupe: true, archivedAt: true },
        })
        if (perimetre === null) return []
        servi = {
          OR: [
            { touteActivite: true },
            { perimetres: { some: { perimetreId: perimetre.id } } },
            // Un groupe ne couvre que ses périmètres non archivés.
            ...(perimetre.archivedAt === null
              ? [{ groupes: { some: { groupe: perimetre.groupe } } }]
              : []),
          ],
        }
      }
      return prisma.dossierLie.findMany({
        ...query,
        where: { AND: [lisibles, servi] },
        orderBy: [{ touteActivite: 'desc' }, { nom: 'asc' }, { id: 'asc' }],
      })
    },
  }),

  contenuDossierLie: t.field({
    type: ListeElementsFichiersRef,
    authScopes: { connecte: true },
    description:
      'Dossiers et fichiers d’un dossier lié, ou d’un de ses sous-dossiers désigné par un chemin de noms. Avec `ressource`, un document lié ouvert aux lecteurs de sa fiche se lit sans ouvrir le reste du dossier.',
    args: {
      id: t.arg.id({ required: true }),
      chemin: t.arg.stringList({ required: true }),
      ressource: t.arg.id(),
    },
    resolve: async (_root, { id, chemin, ressource }, ctx) => {
      const dossier = await dossierLisiblePour(
        ctx,
        String(id),
        chemin,
        ressource === null || ressource === undefined ? null : String(ressource)
      )
      if (dossier === null) throw accesRefuse()
      exigerChemin(chemin)
      return avecEspace(ctx, async espace => {
        if (espace.fournisseur !== dossier.fournisseur) {
          throw erreurEspace(new Error('Fournisseur différent.'))
        }
        // Le dossier d'export, s'il se trouve sous ce dossier lié, ne s'y lit pas.
        const exportation = await cheminDeLExportSous(
          espace,
          dossier.organisationId,
          dossier
        )
        if (dansLExport(chemin, exportation)) throw accesRefuse()
        const liste = await espace.lister({
          emplacement: dossier.emplacement,
          base: dossier.element,
          chemin,
        })
        if (liste === null) throw erreurSaisie(i18n._('Dossier introuvable.'))
        return {
          elements: trier(
            liste.elements
              .filter(e => e.id !== exportation?.id)
              .map(e => vue(espace, e))
          ),
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
      portee: t.arg({
        type: PorteeConnexionFichiersEnum,
        description:
          'Les autorisations demandées au-delà des fichiers (ADR 0044). SharePoint et Dropbox les demandent à la connexion.',
      }),
    },
    resolve: async (_root, { fournisseur, portee: demandee }, ctx) => {
      const portee = demandee ?? 'FICHIERS'
      const fermee = () =>
        erreurSaisie(
          i18n._('Ce fournisseur n’est pas ouvert sur cette installation.')
        )
      const microsoft =
        fournisseur === 'SHAREPOINT' ? await configurationMicrosoft() : null
      const google =
        fournisseur === 'GOOGLE_DRIVE' ? await configurationGoogle() : null
      const dropbox =
        fournisseur === 'DROPBOX' ? await configurationDropbox() : null
      if (microsoft === null && google === null && dropbox === null)
        throw fermee()
      const { etat, defi } = await commencerConnexion({
        organisationId: ctx.organisation!.id,
        userId: ctx.personne!.id,
        fournisseur,
        portee,
      })
      if (microsoft !== null)
        return adresseAutorisation(microsoft, etat, defi, portee)
      if (google !== null) return adresseAutorisationGoogle(google, etat, defi)
      // Google garde la même portée : la vérification s'y règle sans
      // reconnexion (`reglerPorteeConnexion`).
      return adresseAutorisationDropbox(dropbox!, etat, defi, portee)
    },
  }),

  reglerPorteeConnexion: t.prismaField({
    type: ConnexionFichiersRef,
    authScopes: { admin: true },
    description:
      'Active ou coupe la vérification et la gestion des accès sans reconnexion, pour un fournisseur dont l’accès accordé les couvre déjà : Google Drive et Nextcloud (ADR 0044).',
    args: {
      portee: t.arg({ type: PorteeConnexionFichiersEnum, required: true }),
    },
    resolve: async (query, _root, { portee }, ctx) => {
      const organisationId = ctx.organisation!.id
      const connexion = await prisma.connexionFichiers.findUnique({
        where: { organisationId },
        select: { fournisseur: true },
      })
      if (connexion === null) {
        throw erreurSaisie(i18n._('Aucun fournisseur cloud n’est connecté.'))
      }
      if (
        connexion.fournisseur !== 'GOOGLE_DRIVE' &&
        connexion.fournisseur !== 'NEXTCLOUD'
      ) {
        throw erreurSaisie(
          i18n._(
            'Ce fournisseur demande une reconnexion pour changer ses autorisations.'
          )
        )
      }
      void publierChangement({ entite: 'FICHIERS', organisationId })
      return prisma.connexionFichiers.update({
        ...query,
        where: { organisationId },
        data: { portee },
      })
    },
  }),

  connecterCompteServiceGoogle: t.prismaField({
    type: ConnexionFichiersRef,
    authScopes: { admin: true },
    description:
      'Connecte Google Drive par un compte de service : la clé JSON du compte, que l’organisation a créée. L’organisation partage ensuite ses dossiers avec l’adresse du compte.',
    args: { cle: t.arg.string({ required: true }) },
    resolve: async (query, _root, { cle }, ctx) => {
      const organisationId = ctx.organisation!.id
      const possible = (await connexionsPossibles()).some(
        c => c.fournisseur === 'GOOGLE_DRIVE' && c.methode === 'COMPTE_SERVICE'
      )
      if (!possible) {
        throw erreurSaisie(
          i18n._(
            'Le compte de service n’est pas ouvert sur cette installation.'
          )
        )
      }
      if (cle.length > 10_000)
        throw erreurSaisie(i18n._('Cette clé est trop longue.'))
      let compteService
      try {
        compteService = lireCleCompteService(cle)
      } catch (erreur) {
        throw erreurSaisie((erreur as Error).message)
      }
      // Google accepte-t-il la clé ? Un essai l'établit avant l'enregistrement.
      let premier: { acces: string; expireLe: number } | null = null
      if (!espaceDeTest()) {
        try {
          premier = await jetonCompteService(compteService)
        } catch {
          throw erreurSaisie(
            i18n._(
              'Google refuse cette clé. Vérifiez que le compte de service existe et que l’API Google Drive est activée dans son projet.'
            )
          )
        }
      }
      const connexion = await enregistrerConnexion({
        organisationId,
        fournisseur: 'GOOGLE_DRIVE',
        methode: 'COMPTE_SERVICE',
        compte: compteService.client_email,
        secret: JSON.stringify(compteService),
        connecteParId: ctx.personne!.id,
      })
      if (premier !== null) {
        memoriserJetonAcces(connexion.jeton, premier.acces, premier.expireLe)
      }
      journal.info(
        {
          evenement: 'espace-fichiers-connecte',
          organisationId,
          acteurId: ctx.personne!.id,
          fournisseur: 'GOOGLE_DRIVE',
          methode: 'COMPTE_SERVICE',
        },
        'Un espace de fichiers a été connecté.'
      )
      void publierChangement({ entite: 'FICHIERS', organisationId })
      return prisma.connexionFichiers.findUniqueOrThrow({
        ...query,
        where: { organisationId },
      })
    },
  }),

  commencerConnexionNextcloud: t.field({
    type: DebutConnexionNextcloudRef,
    authScopes: { admin: true },
    description:
      'Commence la connexion au Nextcloud de l’association, à l’adresse donnée. L’admin ouvre ensuite la page rendue et y accorde l’accès ; Nextcloud crée un mot de passe d’application pour Relaytour.',
    args: { adresse: t.arg.string({ required: true }) },
    resolve: async (_root, { adresse }, ctx) => {
      const configuration = await configurationNextcloud()
      if (configuration === null) {
        throw erreurSaisie(
          i18n._('Nextcloud n’est pas ouvert sur cette installation.')
        )
      }
      if (adresse.length > 500)
        throw erreurSaisie(i18n._('Cette adresse est trop longue.'))
      const base = baseAdmise(adresse, configuration)
      if (base === null) {
        throw erreurSaisie(
          configuration.tous
            ? i18n._(
                'Saisissez l’adresse https de votre Nextcloud, sans port, par exemple https://cloud.exemple.org.'
              )
            : i18n._(
                'L’hébergeur de cette installation n’admet pas cette adresse. Demandez-lui d’ajouter votre Nextcloud.'
              )
        )
      }
      let debut
      try {
        debut = await commencerLoginNextcloud(configuration, base)
      } catch (erreur) {
        throw erreurNextcloud(erreur)
      }
      const etat = await garderConnexionNextcloud({
        organisationId: ctx.organisation!.id,
        userId: ctx.personne!.id,
        base,
        sondage: debut.sondage,
        jeton: debut.jeton,
      })
      return { connexion: debut.connexion, etat }
    },
  }),

  terminerConnexionNextcloud: t.boolean({
    authScopes: { admin: true },
    description:
      'Demande à Nextcloud si l’admin a accordé l’accès. Vrai une fois la connexion enregistrée ; faux tant qu’il n’a pas terminé.',
    args: { etat: t.arg.string({ required: true }) },
    resolve: async (_root, { etat }, ctx) => {
      const organisationId = ctx.organisation!.id
      const configuration = await configurationNextcloud()
      if (configuration === null) {
        throw erreurSaisie(
          i18n._('Nextcloud n’est pas ouvert sur cette installation.')
        )
      }
      // L'état appartient à la personne qui a commencé, dans cette organisation.
      const enCours = await lireConnexionNextcloud(etat)
      if (
        enCours === null ||
        enCours.organisationId !== organisationId ||
        enCours.userId !== ctx.personne!.id
      ) {
        throw erreurSaisie(i18n._('Cette connexion a expiré. Recommencez.'))
      }
      let accorde
      try {
        accorde = await sonderLoginNextcloud(
          configuration,
          enCours.base,
          enCours.sondage,
          enCours.jeton
        )
      } catch (erreur) {
        throw erreurNextcloud(erreur)
      }
      if (accorde === null) return false
      // Deux sondages simultanés : un seul enregistre la connexion.
      if (!(await oublierConnexionNextcloud(etat))) return false
      let compte
      try {
        compte = await compteNextcloud(
          configuration,
          enCours.base,
          accorde.identifiant,
          accorde.motDePasse
        )
      } catch (erreur) {
        throw erreurNextcloud(erreur)
      }
      const secret = JSON.stringify({
        base: enCours.base,
        utilisateur: compte.utilisateur,
        identifiant: accorde.identifiant,
        motDePasse: accorde.motDePasse,
      } satisfies SecretNextcloud)
      const connexion = await enregistrerConnexion({
        organisationId,
        fournisseur: 'NEXTCLOUD',
        methode: 'COMPTE',
        compte: `${compte.nom} (${new URL(enCours.base).host})`,
        secret,
        connecteParId: ctx.personne!.id,
      })
      memoriserJetonAcces(connexion.jeton, secret, Date.now() + 60 * 60_000)
      journal.info(
        {
          evenement: 'espace-fichiers-connecte',
          organisationId,
          acteurId: ctx.personne!.id,
          fournisseur: 'NEXTCLOUD',
          methode: 'COMPTE',
        },
        'Un espace de fichiers a été connecté.'
      )
      void publierChangement({ entite: 'FICHIERS', organisationId })
      return true
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
      await sousVerrouOrganisation(organisationId, async tx => {
        await tx.ficheExportee.deleteMany({ where: { organisationId } })
        await tx.connexionFichiers.delete({ where: { id: connexion.id } })
      })
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
      'Lie un dossier du fournisseur connecté à une activité, avec ses lecteurs. Un dossier se lie une seule fois par activité.',
    args: {
      activiteId: t.arg.id({ required: true }),
      lecteurs: t.arg({ type: LecteursDossierInput, required: true }),
      emplacement: t.arg.string({ required: true }),
      chemin: t.arg.stringList({ required: true }),
    },
    resolve: async (
      query,
      _root,
      { activiteId, lecteurs: saisie, emplacement, chemin },
      ctx
    ) => {
      const organisationId = ctx.organisation!.id
      exigerChemin(chemin)
      // Une bibliothèque entière ne se lie pas : l'admin choisit un dossier.
      if (chemin.length === 0)
        throw erreurSaisie(i18n._('Choisissez un dossier.'))
      const activite = await prisma.activite.findFirst({
        where: { id: String(activiteId), organisationId },
        select: { id: true },
      })
      if (activite === null) throw accesRefuse()
      const lecteurs = await validerLecteurs(
        organisationId,
        activite.id,
        saisie
      )
      const { espace, element } = await avecEspace(ctx, async espace => ({
        espace,
        element: await espace.element({ emplacement, base: null, chemin }),
      }))
      if (element === null || !element.dossier) {
        throw erreurSaisie(
          i18n._('Ce dossier n’existe pas chez le fournisseur cloud.')
        )
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
      // Sa place se relit chez le fournisseur : un admin a pu le déplacer. Le
      // contrôle vaut quel que soit l'emplacement par lequel l'admin le voit.
      if (exportation?.exportElement != null) {
        const exportElement = exportation.exportElement
        const { ancetres, parcours } = await avecEspace(ctx, async e => ({
          ancetres: await ancetresDeLExport(e, exportation),
          parcours: await lignee(e, emplacement, chemin),
        }))
        if (
          ancetres.some(a => a.id === element.id) ||
          parcours.includes(exportElement)
        ) {
          throw erreurSaisie(
            i18n._(
              'Ce dossier contient le dossier d’export des fiches, ou s’y trouve. Choisissez un autre dossier.'
            )
          )
        }
      }
      const cle = {
        organisationId,
        activiteId: activite.id,
        emplacement,
        element: element.id,
      }
      // Sous le verrou de l'organisation : deux liens simultanés du même dossier
      // n'en créent qu'un, et un dossier déjà lié à l'activité se modifie au lieu
      // de se lier une seconde fois (ADR 0043).
      // Le choix du dossier d'export prend le même verrou : un dossier d'export
      // choisi entre le contrôle et le lien fait recommencer.
      const dossier = await sousVerrouOrganisation(organisationId, async tx => {
        const export_ = await tx.connexionFichiers.findUnique({
          where: { organisationId },
          select: { exportElement: true },
        })
        if (
          (export_?.exportElement ?? null) !==
          (exportation?.exportElement ?? null)
        ) {
          throw erreurSaisie(
            i18n._('Le dossier d’export vient de changer. Recommencez le lien.')
          )
        }
        if ((await tx.dossierLie.findFirst({ where: cle })) !== null) {
          throw erreurSaisie(
            i18n._(
              'Ce dossier est déjà lié à cette activité. Modifiez ses lecteurs.'
            )
          )
        }
        const cree = await tx.dossierLie.create({
          data: {
            ...cle,
            perimetreId: await perimetreHistorique(tx, cle, lecteurs),
            touteActivite: lecteurs.touteActivite,
            fournisseur: espace.fournisseur,
            nom: element.nom,
            creeParId: ctx.personne!.id,
          },
        })
        const listes = listesDeLecteurs(cree.id, lecteurs)
        await tx.dossierLiePerimetre.createMany({ data: listes.perimetres })
        await tx.dossierLieGroupe.createMany({ data: listes.groupes })
        return tx.dossierLie.findUniqueOrThrow({
          where: { id: cree.id },
          select: {
            id: true,
            organisationId: true,
            activiteId: true,
            ...SELECTION_LECTEURS,
          },
        })
      })
      publierDossierLie(dossier)
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
        ids: await lignee(espace, emplacement, chemin),
      }))
      if (parent === null || !parent.dossier) {
        throw erreurSaisie(
          i18n._('Ce dossier n’existe pas chez le fournisseur cloud.')
        )
      }
      // Un compte de service Google n'a pas d'espace de stockage : il n'écrit que
      // dans un Drive partagé.
      const methode = await prisma.connexionFichiers.findUnique({
        where: { organisationId },
        select: { fournisseur: true, methode: true },
      })
      if (
        methode?.fournisseur === 'GOOGLE_DRIVE' &&
        methode.methode === 'COMPTE_SERVICE' &&
        (emplacement === MON_DRIVE || emplacement === PARTAGES)
      ) {
        throw erreurSaisie(
          i18n._(
            'Un compte de service n’écrit que dans un Drive partagé. Choisissez un dossier d’un Drive partagé dont il est membre.'
          )
        )
      }
      const refus = () =>
        erreurSaisie(
          i18n._(
            'Ce dossier est lié à une activité, ou se trouve dans un dossier lié. Les membres y liraient les fiches de tous les périmètres : choisissez un autre dossier.'
          )
        )
      const lies = (tx: Prisma.TransactionClient | typeof prisma) =>
        tx.dossierLie.count({
          where: { organisationId, element: { in: ids } },
        })
      if ((await lies(prisma)) > 0) throw refus()
      const cree = await avecEspace(ctx, () =>
        espace.creerDossier(
          { emplacement, base: null, chemin },
          NOM_DOSSIER_EXPORT,
          { renommer: true }
        )
      )
      // Le lien d'un dossier prend le même verrou : un dossier lié entre le
      // premier contrôle et l'écriture fait échouer le choix.
      const accepte = await sousVerrouOrganisation(organisationId, async tx => {
        if ((await lies(tx)) > 0) return false
        await tx.ficheExportee.deleteMany({ where: { organisationId } })
        await tx.connexionFichiers.update({
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
        return true
      })
      if (!accepte) {
        await espace
          .supprimer({
            emplacement,
            base: null,
            chemin: [...chemin, cree.nom],
          })
          .catch(() => undefined)
        throw refus()
      }
      await lancerExportFiches(organisationId).catch(() => undefined)
      void publierChangement({ entite: 'FICHIERS', organisationId })
      return prisma.connexionFichiers.findUniqueOrThrow({
        ...query,
        where: { organisationId },
      })
    },
  }),

  retirerDossierExport: t.boolean({
    authScopes: { admin: true },
    description:
      'Arrête l’export des fiches. Les fichiers déjà écrits restent dans l’espace de fichiers.',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      // Sous le verrou de l'organisation : un export en cours ne réécrit plus
      // son suivi une fois l'export arrêté.
      const count = await sousVerrouOrganisation(organisationId, async tx => {
        const { count } = await tx.connexionFichiers.updateMany({
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
        await tx.ficheExportee.deleteMany({ where: { organisationId } })
        return count
      })
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
        throw erreurSaisie(i18n._('Aucun dossier d’export n’est choisi.'))
      }
      try {
        await lancerExportFiches(organisationId)
      } catch {
        throw erreurSaisie(
          i18n._(
            'L’export n’a pas pu être lancé. Réessayez dans quelques instants.'
          )
        )
      }
      return true
    },
  }),

  delierDossier: t.boolean({
    authScopes: { admin: true },
    description:
      'Retire un dossier lié. Quand Relaytour a créé des accès pour ce dossier chez le fournisseur, le retrait exige `oublierAcces` : ces accès restent chez le fournisseur et ne sont plus suivis (ADR 0044).',
    args: {
      id: t.arg.id({ required: true }),
      oublierAcces: t.arg.boolean(),
    },
    resolve: async (_root, { id, oublierAcces }, ctx) => {
      const organisationId = ctx.organisation!.id
      const dossier = await prisma.dossierLie.findFirst({
        where: { id: String(id), organisationId },
        select: {
          id: true,
          organisationId: true,
          activiteId: true,
          ...SELECTION_LECTEURS,
        },
      })
      if (dossier === null) throw accesRefuse()
      const crees = await prisma.permissionCreee.count({
        where: { dossierLieId: dossier.id },
      })
      if (crees > 0 && oublierAcces !== true) {
        throw erreurSaisie(
          i18n._(
            '{crees, plural, one {Relaytour a créé un accès chez le fournisseur pour ce dossier. Retirez-les d’abord, ou confirmez qu’ils restent sans suivi.} other {Relaytour a créé # accès chez le fournisseur pour ce dossier. Retirez-les d’abord, ou confirmez qu’ils restent sans suivi.}}',
            { crees }
          )
        )
      }
      await prisma.dossierLie.delete({ where: { id: dossier.id } })
      publierDossierLie(dossier)
      return true
    },
  }),

  modifierDossierLie: t.prismaField({
    type: DossierLieRef,
    authScopes: { admin: true },
    description:
      'Modifie les lecteurs et le nom affiché d’un dossier lié. Le dossier chez le fournisseur ne change pas, et ses documents liés gardent leur chemin (ADR 0043).',
    args: {
      id: t.arg.id({ required: true }),
      lecteurs: t.arg({ type: LecteursDossierInput, required: true }),
      nom: t.arg.string(),
      attendus: t.arg({
        type: AttendusDossierEnum,
        description:
          'Les personnes que le dossier attend chez le fournisseur (ADR 0044). Absent : inchangé.',
      }),
    },
    resolve: async (
      query,
      _root,
      { id, lecteurs: saisie, nom, attendus },
      ctx
    ) => {
      const organisationId = ctx.organisation!.id
      const avant = await prisma.dossierLie.findFirst({
        where: { id: String(id), organisationId },
        select: {
          id: true,
          organisationId: true,
          activiteId: true,
          emplacement: true,
          element: true,
          ...SELECTION_LECTEURS,
        },
      })
      if (avant === null) throw accesRefuse()
      const lecteurs = await validerLecteurs(
        organisationId,
        avant.activiteId,
        saisie,
        lecteursExistants(avant)
      )
      const nomAffiche = nom?.trim()
      if (
        nomAffiche !== undefined &&
        (nomAffiche.length === 0 || nomAffiche.length > 255)
      ) {
        throw erreurSaisie(
          i18n._('Le nom d’un dossier lié compte de 1 à 255 caractères.')
        )
      }
      const apres = await sousVerrouOrganisation(organisationId, async tx => {
        const cle = {
          organisationId,
          activiteId: avant.activiteId,
          emplacement: avant.emplacement,
          element: avant.element,
        }
        await tx.dossierLie.update({
          where: { id: avant.id },
          data: {
            touteActivite: lecteurs.touteActivite,
            perimetreId: await perimetreHistorique(tx, cle, lecteurs, avant.id),
            ...(nomAffiche === undefined ? {} : { nom: nomAffiche }),
            ...(attendus === null || attendus === undefined
              ? {}
              : { attendus }),
          },
        })
        const listes = listesDeLecteurs(avant.id, lecteurs)
        await tx.dossierLiePerimetre.deleteMany({
          where: { dossierLieId: avant.id },
        })
        await tx.dossierLieGroupe.deleteMany({
          where: { dossierLieId: avant.id },
        })
        await tx.dossierLiePerimetre.createMany({ data: listes.perimetres })
        await tx.dossierLieGroupe.createMany({ data: listes.groupes })
        return tx.dossierLie.findUniqueOrThrow({
          where: { id: avant.id },
          select: {
            id: true,
            organisationId: true,
            activiteId: true,
            ...SELECTION_LECTEURS,
          },
        })
      })
      publierDossierLie(apres, avant)
      // Les personnes attendues changent avec les lecteurs (ADR 0044).
      planifierVerificationAcces(organisationId)
      journal.info(
        {
          evenement: 'dossier-lie-modifie',
          organisationId,
          dossierLieId: avant.id,
        },
        'Les lecteurs d’un dossier lié ont changé.'
      )
      return prisma.dossierLie.findUniqueOrThrow({
        ...query,
        where: { id: avant.id },
      })
    },
  }),
}))

/** Les lecteurs validés, sous la forme que lit `dossierCompatible`. */
function enLecteurs(lecteurs: LecteursValides): LecteursDossier {
  return {
    touteActivite: lecteurs.touteActivite,
    perimetres: lecteurs.perimetreIds.map(perimetreId => ({ perimetreId })),
    groupes: lecteurs.groupes.map(groupe => ({ groupe })),
  }
}

builder.queryField('effetsLecteursDossier', t =>
  t.field({
    type: EffetsLecteursRef,
    authScopes: { admin: true },
    description:
      'Annonce, avant une modification, les documents liés que les lecteurs de leur fiche ne liraient plus.',
    args: {
      id: t.arg.id({ required: true }),
      lecteurs: t.arg({ type: LecteursDossierInput, required: true }),
    },
    resolve: async (_root, { id, lecteurs: saisie }, ctx) => {
      const organisationId = ctx.organisation!.id
      const dossier = await prisma.dossierLie.findFirst({
        where: { id: String(id), organisationId },
        select: {
          organisationId: true,
          activiteId: true,
          ...SELECTION_LECTEURS,
          ressources: {
            where: { fiche: { archivedAt: null } },
            select: {
              fiche: {
                select: {
                  id: true,
                  slug: true,
                  organisationId: true,
                  activiteId: true,
                  perimetreId: true,
                  perimetre: { select: { groupe: true, archivedAt: true } },
                  versionCourante: { select: { titre: true } },
                },
              },
            },
          },
        },
      })
      if (dossier === null) throw accesRefuse()
      const nouveaux = {
        ...dossier,
        ...enLecteurs(
          await validerLecteurs(
            organisationId,
            dossier.activiteId,
            saisie,
            lecteursExistants(dossier)
          )
        ),
      }
      let documentsMasques = 0
      const fiches = new Map<string, FicheTouchee>()
      for (const { fiche } of dossier.ressources) {
        const situee = {
          ...fiche,
          groupe:
            fiche.perimetre !== null && fiche.perimetre.archivedAt === null
              ? fiche.perimetre.groupe
              : null,
        }
        if (
          dossierCompatible(situee, dossier) &&
          !dossierCompatible(situee, nouveaux)
        ) {
          documentsMasques += 1
          fiches.set(fiche.id, {
            id: fiche.id,
            titre: fiche.versionCourante?.titre ?? fiche.slug,
          })
        }
      }
      return {
        documentsMasques,
        fiches: [...fiches.values()].sort((a, b) =>
          a.titre.localeCompare(b.titre, 'fr')
        ),
      }
    },
  })
)
