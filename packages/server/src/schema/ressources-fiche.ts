import { createHash } from 'node:crypto'

import { prisma, TypeRessource, type RessourceFiche } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { cheminValide, formatApercu } from '../espace-fichiers/chemin.ts'
import { dossierCompatible } from '../espace-fichiers/droits.ts'
import {
  cheminDeLExportSous,
  dansLExport,
} from '../espace-fichiers/isolement.ts'
import {
  convertitEnPdf,
  documentNatif,
  erreurEspace,
  ouvrirEspace,
} from '../espace-fichiers/index.ts'
import type { ElementEspace } from '../espace-fichiers/types.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { peutLireFiche, peutRedigerFiche } from '../lib/fiches.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'

import { builder } from './builder.ts'
import { DossierLieRef, FormatApercuEnum } from './espace-fichiers.ts'
import { FicheRef } from './fiches.ts'

// Ressources liées à une fiche (ADR 0038). Une personne qui rédige une fiche y lie
// un dossier ou un fichier d'un dossier lié du même périmètre, ou de toute
// l'activité. Les lecteurs de la fiche lisent donc la ressource. Elle vit en base
// et n'entre pas dans le Markdown de la fiche. Une personne qui lit une fiche
// connexe (ADR 0039) sans lire le dossier lié voit la ressource, sans l'ouvrir :
// le serveur ne lui donne alors rien de ce que le fournisseur sait d'elle.

/** Une fiche porte trente ressources au plus. */
export const RESSOURCES_MAX = 30

const TypeRessourceEnum = builder.enumType(TypeRessource, {
  name: 'TypeRessource',
})

function lireChemin(valeur: unknown): string[] {
  return Array.isArray(valeur) && valeur.every(s => typeof s === 'string')
    ? valeur
    : []
}

const empreinteChemin = (chemin: readonly string[]) =>
  createHash('sha256').update(JSON.stringify(chemin)).digest('hex')

interface DossierDeRessource {
  id: string
  organisationId: string
  activiteId: string
  perimetreId: string | null
  emplacement: string
  element: string
  fournisseur: string
}

const SELECTION_DOSSIER = {
  dossierLie: {
    select: {
      id: true,
      organisationId: true,
      activiteId: true,
      perimetreId: true,
      emplacement: true,
      element: true,
      fournisseur: true,
    },
  },
} as const

// L'état d'une ressource chez le fournisseur, lu une fois par requête : null quand
// le fournisseur ne répond pas, que l'espace n'est pas connecté, ou que la
// personne ne lit pas le dossier lié.
const ouvertures = new WeakMap<AppContext, Map<string, Promise<boolean>>>()

/**
 * Vrai quand la personne lit le dossier lié de la ressource, comme `dossierLisible`.
 * Lu une fois par dossier et par requête.
 */
function ouvrable(
  ctx: AppContext,
  dossier: {
    id: string
    organisationId: string
    activiteId: string
    perimetreId: string | null
  }
): Promise<boolean> {
  let parDossier = ouvertures.get(ctx)
  if (parDossier === undefined) {
    parDossier = new Map()
    ouvertures.set(ctx, parDossier)
  }
  let lu = parDossier.get(dossier.id)
  if (lu === undefined) {
    // Sans l'identifiant d'une fiche : un partage de fiche n'ouvre pas le dossier.
    lu = peutLireFiche(ctx, {
      organisationId: dossier.organisationId,
      activiteId: dossier.activiteId,
      perimetreId: dossier.perimetreId,
    })
    parDossier.set(dossier.id, lu)
  }
  return lu
}

const etats = new WeakMap<
  AppContext,
  Map<string, Promise<ElementEspace | 'absent' | null>>
>()

function etatChezLeFournisseur(
  ctx: AppContext,
  r: RessourceFiche & { dossierLie: DossierDeRessource }
): Promise<ElementEspace | 'absent' | null> {
  let parRessource = etats.get(ctx)
  if (parRessource === undefined) {
    parRessource = new Map()
    etats.set(ctx, parRessource)
  }
  let etat = parRessource.get(r.id)
  if (etat === undefined) {
    etat = (async () => {
      if (!(await ouvrable(ctx, r.dossierLie))) return null
      try {
        const { espace } = await ouvrirEspace(r.organisationId)
        if (espace.fournisseur !== r.dossierLie.fournisseur) return null
        const element = await espace.element({
          emplacement: r.dossierLie.emplacement,
          base: r.dossierLie.element,
          chemin: lireChemin(r.chemin),
        })
        return element ?? 'absent'
      } catch {
        return null
      }
    })()
    parRessource.set(r.id, etat)
  }
  return etat
}

const RessourceFicheRef = builder.prismaObject('RessourceFiche', {
  description:
    'Dossier ou fichier de l’espace de fichiers lié à une fiche, adressé depuis un dossier lié.',
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('nom'),
    type: t.expose('type', { type: TypeRessourceEnum }),
    chemin: t.stringList({ resolve: r => lireChemin(r.chemin) }),
    dossierLie: t.relation('dossierLie', { type: DossierLieRef }),
    ouvrable: t.boolean({
      description:
        'Vrai quand la personne lit le dossier lié de la ressource, et peut donc l’ouvrir. Faux pour une ressource d’un autre périmètre, lue dans une fiche connexe.',
      select: SELECTION_DOSSIER,
      resolve: (r, _args, ctx) => ouvrable(ctx, r.dossierLie),
    }),
    apercu: t.field({
      type: FormatApercuEnum,
      select: SELECTION_DOSSIER,
      resolve: async (r, _args, ctx) => {
        if (r.type === 'DOSSIER') return 'AUCUN'
        const fournisseur = r.dossierLie.fournisseur
        // Le type d'un document Google natif ne se lit que chez le fournisseur.
        const etat =
          fournisseur === 'GOOGLE_DRIVE'
            ? await etatChezLeFournisseur(ctx, r)
            : null
        const typeMime =
          etat === null || etat === 'absent' ? null : etat.typeMime
        return formatApercu(
          r.nom,
          nom => convertitEnPdf(fournisseur, nom, typeMime),
          documentNatif(fournisseur, typeMime)
        )
      },
    }),
    existe: t.boolean({
      nullable: true,
      description:
        'Faux quand la ressource n’existe plus chez le fournisseur. Null quand le fournisseur ne répond pas, ou quand la ressource n’est pas ouvrable.',
      select: SELECTION_DOSSIER,
      resolve: async (r, _args, ctx) => {
        const etat = await etatChezLeFournisseur(ctx, r)
        return etat === null ? null : etat !== 'absent'
      },
    }),
    lienWeb: t.string({
      nullable: true,
      description:
        'Adresse de la ressource chez le fournisseur. Null quand la ressource n’est pas ouvrable.',
      select: SELECTION_DOSSIER,
      resolve: async (r, _args, ctx) => {
        const etat = await etatChezLeFournisseur(ctx, r)
        return etat === null || etat === 'absent' ? null : etat.lienWeb
      },
    }),
  }),
})

builder.prismaObjectField(FicheRef, 'ressources', t =>
  t.prismaField({
    type: [RessourceFicheRef],
    description:
      'Ressources de l’espace de fichiers liées à la fiche, dans l’ordre du lien.',
    select: {
      id: true,
      organisationId: true,
      activiteId: true,
      perimetreId: true,
    },
    resolve: async (query, fiche) => {
      // Une fiche déplacée vers un autre périmètre ne montre plus les
      // ressources d'un dossier que ses nouveaux lecteurs ne lisent pas.
      const toutes = await prisma.ressourceFiche.findMany({
        where: { ficheId: fiche.id },
        select: {
          id: true,
          dossierLie: {
            select: {
              organisationId: true,
              activiteId: true,
              perimetreId: true,
            },
          },
        },
      })
      const lisibles = toutes
        .filter(r => dossierCompatible(fiche, r.dossierLie))
        .map(r => r.id)
      return prisma.ressourceFiche.findMany({
        ...query,
        where: { id: { in: lisibles } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    },
  })
)

/** La fiche si la personne peut la rédiger, sinon un refus. */
async function ficheRedigeable(ctx: AppContext, ficheId: string) {
  const fiche = await prisma.fiche.findFirst({
    where: { id: ficheId, organisationId: ctx.organisation!.id },
    select: {
      id: true,
      organisationId: true,
      activiteId: true,
      perimetreId: true,
      archivedAt: true,
    },
  })
  if (
    fiche === null ||
    !(await peutLireFiche(ctx, fiche)) ||
    !(await peutRedigerFiche(ctx, fiche.perimetreId, fiche.activiteId))
  ) {
    throw accesRefuse()
  }
  return fiche
}

builder.mutationFields(t => ({
  lierRessourceFiche: t.prismaField({
    type: RessourceFicheRef,
    authScopes: { connecte: true },
    description:
      'Lie à une fiche un dossier ou un fichier d’un dossier lié de son périmètre, ou de toute son activité.',
    args: {
      ficheId: t.arg.id({ required: true }),
      dossierLieId: t.arg.id({ required: true }),
      chemin: t.arg.stringList({ required: true }),
    },
    resolve: async (query, _root, { ficheId, dossierLieId, chemin }, ctx) => {
      const fiche = await ficheRedigeable(ctx, String(ficheId))
      if (fiche.archivedAt !== null) {
        throw erreurSaisie('Cette fiche est archivée.')
      }
      const dossier = await prisma.dossierLie.findFirst({
        where: {
          id: String(dossierLieId),
          organisationId: fiche.organisationId,
        },
      })
      if (dossier === null || !dossierCompatible(fiche, dossier)) {
        throw accesRefuse()
      }
      if (!cheminValide(chemin)) throw erreurSaisie('Chemin invalide.')
      const empreinte = empreinteChemin(chemin)
      // La lecture chez le fournisseur se fait hors du verrou.
      let element: ElementEspace | null
      try {
        const { espace } = await ouvrirEspace(fiche.organisationId)
        if (espace.fournisseur !== dossier.fournisseur) {
          throw erreurEspace(new Error('Fournisseur différent.'))
        }
        if (
          dansLExport(
            chemin,
            await cheminDeLExportSous(espace, fiche.organisationId, dossier)
          )
        ) {
          throw accesRefuse()
        }
        element = await espace.element({
          emplacement: dossier.emplacement,
          base: dossier.element,
          chemin,
        })
      } catch (erreur) {
        throw erreurEspace(erreur)
      }
      if (element === null) {
        throw erreurSaisie(
          'Cet élément n’existe pas dans l’espace de fichiers.'
        )
      }
      const trouve = element
      // Sous le verrou de l'organisation : deux liens simultanés de la même
      // ressource n'en créent qu'un, et la borne de trente tient.
      const ressourceId = await sousVerrouOrganisation(
        fiche.organisationId,
        async tx => {
          const existante = await tx.ressourceFiche.findUnique({
            where: {
              ficheId_dossierLieId_empreinteChemin: {
                ficheId: fiche.id,
                dossierLieId: dossier.id,
                empreinteChemin: empreinte,
              },
            },
            select: { id: true },
          })
          if (existante !== null) return existante.id
          const nombre = await tx.ressourceFiche.count({
            where: { ficheId: fiche.id },
          })
          if (nombre >= RESSOURCES_MAX) {
            throw erreurSaisie(
              `Une fiche porte ${RESSOURCES_MAX} ressources au plus. Retirez-en une avant d’en lier une autre.`
            )
          }
          const creee = await tx.ressourceFiche.create({
            data: {
              organisationId: fiche.organisationId,
              ficheId: fiche.id,
              dossierLieId: dossier.id,
              chemin,
              empreinteChemin: empreinte,
              type: trouve.dossier ? 'DOSSIER' : 'FICHIER',
              nom: chemin.length === 0 ? dossier.nom : trouve.nom,
              creeParId: ctx.personne!.id,
            },
            select: { id: true },
          })
          return creee.id
        }
      )
      publierPourActivite('FICHE', fiche.organisationId, fiche.activiteId, {
        id: fiche.id,
        perimetreId: fiche.perimetreId,
      })
      return prisma.ressourceFiche.findUniqueOrThrow({
        ...query,
        where: { id: ressourceId },
      })
    },
  }),

  delierRessourceFiche: t.boolean({
    authScopes: { connecte: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const ressource = await prisma.ressourceFiche.findFirst({
        where: { id: String(id), organisationId: ctx.organisation!.id },
        select: { id: true, ficheId: true },
      })
      if (ressource === null) throw accesRefuse()
      const fiche = await ficheRedigeable(ctx, ressource.ficheId)
      await prisma.ressourceFiche.delete({ where: { id: ressource.id } })
      publierPourActivite('FICHE', fiche.organisationId, fiche.activiteId, {
        id: fiche.id,
        perimetreId: fiche.perimetreId,
      })
      return true
    },
  }),
}))
