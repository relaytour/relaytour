import { prisma, type DossierLie, type Prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { perimetresLisibles } from '../lib/droits.ts'
import { peutLireFiche } from '../lib/fiches.ts'
import { perimetresLisiblesActifs } from '../lib/fiches-connexes.ts'
import { publierPourActivite } from '../lib/flux.ts'

// Droits du fournisseur cloud (ADR 0038, 0043). Un dossier lié sert toute son
// activité, ou une liste de périmètres et de groupes. Une personne le lit quand elle
// lit les fiches d'un périmètre de la liste, ou d'un périmètre non archivé d'un
// groupe de la liste. Un dossier de toute l'activité se lit comme les fiches
// communes. Un partage de fiche (ADR 0039) n'ouvre jamais un dossier lié.

/** Ce qu'une requête doit lire d'un dossier lié pour juger de ses lecteurs. */
export const SELECTION_LECTEURS = {
  touteActivite: true,
  perimetres: { select: { perimetreId: true } },
  groupes: { select: { groupe: true } },
} as const satisfies Prisma.DossierLieSelect

/** Les lecteurs d'un dossier lié, tels que les lit `SELECTION_LECTEURS`. */
export interface LecteursDossier {
  touteActivite: boolean
  perimetres: { perimetreId: string }[]
  groupes: { groupe: string }[]
}

/**
 * La condition Prisma des dossiers liés d'une activité que la personne lit, ou null
 * quand elle ne lit aucun dossier de cette activité.
 */
export async function conditionDossiersLisibles(
  ctx: AppContext,
  activiteId: string
): Promise<Prisma.DossierLieWhereInput | null> {
  if (ctx.personne === null || ctx.organisation === null) return null
  if (!(await ctx.activitesVisibles()).has(activiteId)) return null
  const [lisibles, actifs] = await Promise.all([
    perimetresLisibles(ctx),
    perimetresLisiblesActifs(ctx),
  ])
  // Une clé de groupe se lit dans l'activité du dossier : la même clé peut
  // désigner un autre groupe dans une autre activité.
  const groupes = [
    ...new Set(
      actifs.filter(p => p.activiteId === activiteId).map(p => p.groupe)
    ),
  ]
  return {
    organisationId: ctx.organisation.id,
    activiteId,
    OR: [
      { touteActivite: true },
      { perimetres: { some: { perimetreId: { in: lisibles } } } },
      { groupes: { some: { groupe: { in: groupes } } } },
    ],
  }
}

/** Vrai quand la personne lit ce dossier lié. */
export async function peutLireDossier(
  ctx: AppContext,
  dossier: { id: string; organisationId: string; activiteId: string }
): Promise<boolean> {
  if (ctx.organisation === null) return false
  if (dossier.organisationId !== ctx.organisation.id) return false
  const condition = await conditionDossiersLisibles(ctx, dossier.activiteId)
  if (condition === null) return false
  return (
    (await prisma.dossierLie.count({
      where: { ...condition, id: dossier.id },
    })) > 0
  )
}

/** Le dossier lié s'il appartient à l'organisation active et si la personne le lit, sinon null. */
export async function dossierLisible(
  ctx: AppContext,
  id: string
): Promise<DossierLie | null> {
  if (ctx.personne === null || ctx.organisation === null) return null
  const dossier = await prisma.dossierLie.findFirst({
    where: { id, organisationId: ctx.organisation.id },
  })
  if (dossier === null) return null
  return (await peutLireDossier(ctx, dossier)) ? dossier : null
}

/**
 * Le dossier lié par lequel la personne lit ce chemin, sinon null. Elle lit le
 * dossier lui-même, ou elle lit la fiche d'un document lié ouvert à ses lecteurs
 * (ADR 0043) : le chemin reste alors sous le document, et un fichier ne se lit que
 * lui-même. `ressourceId` désigne ce document.
 */
export async function dossierLisiblePour(
  ctx: AppContext,
  dossierId: string,
  chemin: readonly string[],
  ressourceId: string | null | undefined
): Promise<DossierLie | null> {
  const dossier = await dossierLisible(ctx, dossierId)
  if (dossier !== null || ressourceId === null || ressourceId === undefined) {
    return dossier
  }
  if (ctx.organisation === null) return null
  const ressource = await prisma.ressourceFiche.findFirst({
    where: {
      id: ressourceId,
      organisationId: ctx.organisation.id,
      dossierLieId: dossierId,
      ouverteAuxLecteurs: true,
    },
    include: {
      dossierLie: {
        include: {
          perimetres: SELECTION_LECTEURS.perimetres,
          groupes: SELECTION_LECTEURS.groupes,
        },
      },
      fiche: {
        select: {
          id: true,
          organisationId: true,
          activiteId: true,
          perimetreId: true,
          perimetre: { select: { groupe: true, archivedAt: true } },
        },
      },
    },
  })
  if (ressource === null || !(await peutLireFiche(ctx, ressource.fiche))) {
    return null
  }
  // Un document que la fiche ne montre plus, parce que son dossier ne la sert
  // plus, ne se lit plus non plus.
  const fiche = ressource.fiche
  const groupe =
    fiche.perimetre !== null && fiche.perimetre.archivedAt === null
      ? fiche.perimetre.groupe
      : null
  if (!dossierCompatible({ ...fiche, groupe }, ressource.dossierLie)) {
    return null
  }
  const base = Array.isArray(ressource.chemin)
    ? ressource.chemin.filter((n): n is string => typeof n === 'string')
    : []
  const dessous =
    chemin.length >= base.length && base.every((nom, i) => chemin[i] === nom)
  const admis =
    ressource.type === 'FICHIER'
      ? dessous && chemin.length === base.length
      : dessous
  return admis ? ressource.dossierLie : null
}

/**
 * Vrai quand une ressource de ce dossier lié peut s'attacher à cette fiche : même
 * activité, et un dossier qui sert tous les lecteurs du périmètre de la fiche. Le
 * dossier sert toute l'activité, ou sa liste nomme ce périmètre, directement ou par
 * son groupe. Une fiche commune n'admet que les dossiers de toute l'activité.
 * `groupe` est le groupe du périmètre de la fiche, null s'il est archivé : un groupe
 * ne couvre que ses périmètres non archivés.
 */
export function dossierCompatible(
  fiche: {
    organisationId: string
    activiteId: string
    perimetreId: string | null
    groupe: string | null
  },
  dossier: LecteursDossier & { organisationId: string; activiteId: string }
): boolean {
  if (
    fiche.organisationId !== dossier.organisationId ||
    fiche.activiteId !== dossier.activiteId
  ) {
    return false
  }
  if (dossier.touteActivite) return true
  if (fiche.perimetreId === null) return false
  return (
    dossier.perimetres.some(p => p.perimetreId === fiche.perimetreId) ||
    (fiche.groupe !== null &&
      dossier.groupes.some(g => g.groupe === fiche.groupe))
  )
}

/**
 * Les périmètres que les lecteurs d'un dossier lié désignent aujourd'hui : ceux de
 * la liste, puis les périmètres non archivés de ses groupes. Null pour un dossier de
 * toute l'activité.
 */
export async function perimetresDesLecteurs(
  dossier: LecteursDossier & { activiteId: string }
): Promise<string[] | null> {
  if (dossier.touteActivite) return null
  const groupes = dossier.groupes.map(g => g.groupe)
  const membres =
    groupes.length === 0
      ? []
      : await prisma.perimetre.findMany({
          where: {
            activiteId: dossier.activiteId,
            groupe: { in: groupes },
            archivedAt: null,
          },
          select: { id: true },
        })
  return [
    ...new Set([
      ...dossier.perimetres.map(p => p.perimetreId),
      ...membres.map(m => m.id),
    ]),
  ]
}

/**
 * Publie le changement d'un dossier lié pour ses lecteurs : un signal par périmètre
 * désigné, ou un signal d'activité pour toute l'activité (ADR 0017). `avant` porte
 * les lecteurs d'avant une modification : les personnes qui perdent la lecture
 * relisent aussi leurs écrans. Ne lève jamais.
 */
export function publierDossierLie(
  dossier: LecteursDossier & {
    id: string
    organisationId: string
    activiteId: string
  },
  avant?: LecteursDossier
): void {
  void (async () => {
    const listes = await Promise.all(
      [dossier, ...(avant === undefined ? [] : [{ ...dossier, ...avant }])].map(
        perimetresDesLecteurs
      )
    )
    const perimetres = new Set<string | null>()
    for (const liste of listes) {
      if (liste === null) perimetres.add(null)
      else for (const id of liste) perimetres.add(id)
    }
    for (const perimetreId of perimetres) {
      publierPourActivite(
        'FICHIERS',
        dossier.organisationId,
        dossier.activiteId,
        {
          id: dossier.id,
          perimetreId,
        }
      )
    }
  })().catch(() => undefined)
}
