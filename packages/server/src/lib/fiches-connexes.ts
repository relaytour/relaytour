import { prisma, type Prisma, type PrismaClient } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { perimetresLisibles } from './droits.ts'
import { publierPourActivite } from './flux.ts'

// Fiches connexes (ADR 0039). Une fiche de périmètre concerne aussi d'autres
// périmètres non archivés de son activité :
// - ceux de sa liste « Concerne aussi » (`FicheConnexe`) ;
// - ceux des groupes de cette liste (`FicheGroupeConnexe`), y compris les périmètres
//   qui rejoignent le groupe plus tard ;
// - ceux d'une déclinaison acceptée qui cite la fiche (ADR 0026).
// Une personne qui lit les fiches d'un de ces périmètres lit la fiche, sans la
// modifier. Le masquage (`FicheConnexeMasquee`) ne retire la fiche que de la liste
// « Fiches connexes » du périmètre cible : elle reste lisible par son lien.

/** D'où vient le partage d'une fiche vers un périmètre. */
export type OrigineConnexe = 'LISTE' | 'GROUPE' | 'DECLINAISON'

export interface PerimetreConcerne {
  perimetreId: string
  par: OrigineConnexe
  /** Pour un partage par un groupe : la clé du groupe. */
  groupe: string | null
  /** Pour un partage par une déclinaison : la déclinaison. */
  tacheId: string | null
  masquee: boolean
}

/** Une déclinaison acceptée relie sa fiche à son périmètre (ADR 0026, 0039). */
const DECLINAISON_ACCEPTEE = {
  origineId: { not: null },
  accord: 'ACCEPTE',
} as const satisfies Prisma.TacheWhereInput

// Mémo par requête : les périmètres lisibles et non archivés, avec leur groupe.
const memo = new WeakMap<
  AppContext,
  Promise<{ id: string; activiteId: string; groupe: string }[]>
>()

function lisiblesActifs(ctx: AppContext) {
  let lus = memo.get(ctx)
  if (lus === undefined) {
    lus = perimetresLisibles(ctx).then(ids =>
      ids.length === 0
        ? []
        : prisma.perimetre.findMany({
            where: {
              id: { in: ids },
              organisationId: ctx.organisation?.id ?? '',
              archivedAt: null,
            },
            select: { id: true, activiteId: true, groupe: true },
          })
    )
    memo.set(ctx, lus)
  }
  return lus
}

/**
 * Les conditions Prisma d'une fiche que la personne lit par un partage : un de ses
 * périmètres lisibles et non archivés est concerné par la fiche. Vide sans
 * périmètre lisible. À combiner en `OR` avec la règle de lecture ordinaire.
 */
export async function conditionsConnexes(
  ctx: AppContext
): Promise<Prisma.FicheWhereInput[]> {
  const actifs = await lisiblesActifs(ctx)
  if (actifs.length === 0) return []
  const parActivite = new Map<string, { ids: string[]; groupes: Set<string> }>()
  for (const p of actifs) {
    const lus = parActivite.get(p.activiteId) ?? { ids: [], groupes: new Set() }
    lus.ids.push(p.id)
    lus.groupes.add(p.groupe)
    parActivite.set(p.activiteId, lus)
  }
  // Chaque chemin se lit dans l'activité de la fiche : une fiche déplacée vers une
  // autre activité par un import ne s'ouvre pas par une liste, un groupe ou une
  // déclinaison de son ancienne activité. La même clé de groupe peut aussi
  // désigner un autre groupe dans une autre activité.
  return [...parActivite].flatMap(([activiteId, { ids, groupes }]) => [
    {
      activiteId,
      perimetreId: { not: null },
      connexes: { some: { perimetreId: { in: ids } } },
    },
    {
      activiteId,
      perimetreId: { not: null },
      groupesConnexes: { some: { groupe: { in: [...groupes] } } },
    },
    {
      activiteId,
      perimetreId: { not: null },
      taches: { some: { ...DECLINAISON_ACCEPTEE, perimetreId: { in: ids } } },
    },
  ])
}

/** La personne lit-elle cette fiche par un partage ? */
export async function litParPartage(
  ctx: AppContext,
  ficheId: string
): Promise<boolean> {
  const conditions = await conditionsConnexes(ctx)
  if (conditions.length === 0) return false
  return (
    (await prisma.fiche.count({ where: { id: ficheId, OR: conditions } })) > 0
  )
}

/**
 * Les périmètres non archivés que la fiche concerne, avec le chemin du partage et le
 * masquage. Un périmètre partagé par plusieurs chemins garde le premier : la liste,
 * puis un groupe, puis une déclinaison. Le périmètre de la fiche n'y figure jamais.
 */
export async function perimetresConcernes(fiche: {
  id: string
  perimetreId: string | null
  activiteId: string
}): Promise<PerimetreConcerne[]> {
  if (fiche.perimetreId === null) return []
  const ailleurs = { not: fiche.perimetreId }
  const [liste, groupes, declinaisons, masquages] = await Promise.all([
    prisma.ficheConnexe.findMany({
      where: {
        ficheId: fiche.id,
        perimetreId: ailleurs,
        perimetre: { archivedAt: null, activiteId: fiche.activiteId },
      },
      select: { perimetreId: true },
    }),
    prisma.ficheGroupeConnexe.findMany({
      where: { ficheId: fiche.id },
      select: { groupe: true },
    }),
    prisma.tache.findMany({
      where: {
        ficheId: fiche.id,
        ...DECLINAISON_ACCEPTEE,
        perimetreId: ailleurs,
        perimetre: { archivedAt: null, activiteId: fiche.activiteId },
      },
      select: { id: true, perimetreId: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.ficheConnexeMasquee.findMany({
      where: { ficheId: fiche.id },
      select: { perimetreId: true },
    }),
  ])
  const membres =
    groupes.length === 0
      ? []
      : await prisma.perimetre.findMany({
          where: {
            activiteId: fiche.activiteId,
            groupe: { in: groupes.map(g => g.groupe) },
            archivedAt: null,
            id: ailleurs,
          },
          select: { id: true, groupe: true },
        })
  const masquees = new Set(masquages.map(m => m.perimetreId))
  const concernes = new Map<string, PerimetreConcerne>()
  const ajouter = (
    perimetreId: string,
    par: OrigineConnexe,
    groupe: string | null,
    tacheId: string | null
  ) => {
    if (concernes.has(perimetreId)) return
    concernes.set(perimetreId, {
      perimetreId,
      par,
      groupe,
      tacheId,
      masquee: masquees.has(perimetreId),
    })
  }
  for (const l of liste) ajouter(l.perimetreId, 'LISTE', null, null)
  for (const m of membres) ajouter(m.id, 'GROUPE', m.groupe, null)
  for (const d of declinaisons)
    ajouter(d.perimetreId, 'DECLINAISON', null, d.id)
  return [...concernes.values()]
}

/**
 * Les fiches connexes d'un périmètre : les fiches d'autres périmètres de son
 * activité qui le concernent. Une fiche masquée par le périmètre n'y figure qu'avec
 * `inclureMasquees`. Un périmètre archivé n'en a aucune.
 */
export function conditionFichesConnexesDe(
  perimetre: { id: string; activiteId: string; groupe: string },
  inclureMasquees = false
): Prisma.FicheWhereInput {
  return {
    activiteId: perimetre.activiteId,
    archivedAt: null,
    perimetreId: { not: null },
    NOT: [
      { perimetreId: perimetre.id },
      ...(inclureMasquees
        ? []
        : [{ masquages: { some: { perimetreId: perimetre.id } } }]),
    ],
    OR: [
      { connexes: { some: { perimetreId: perimetre.id } } },
      { groupesConnexes: { some: { groupe: perimetre.groupe } } },
      {
        taches: {
          some: { ...DECLINAISON_ACCEPTEE, perimetreId: perimetre.id },
        },
      },
    ],
  }
}

/**
 * Le nombre de périmètres à partir duquel une liste « Concerne aussi » demande une
 * confirmation (ADR 0039) : au moins quatre, et plus de la moitié des périmètres
 * non archivés de l'activité.
 */
export const SEUIL_MINIMUM = 4

export function largeDiffusion(concernes: number, total: number): boolean {
  return concernes >= SEUIL_MINIMUM && concernes * 2 > total
}

/**
 * Publie le changement d'une fiche pour son périmètre, puis pour chaque périmètre
 * qu'elle concerne : le flux juge la réception par le périmètre du signal (ADR 0017).
 * `aussi` ajoute des périmètres qui ne sont plus concernés, pour qu'ils relisent
 * leurs écrans. Ne lève jamais et n'attend pas.
 */
export function publierFiche(
  fiche: {
    id: string
    organisationId: string
    activiteId: string
    perimetreId: string | null
  },
  aussi: string[] = []
): void {
  void (async () => {
    try {
      const concernes =
        fiche.perimetreId === null
          ? []
          : (await perimetresConcernes(fiche)).map(c => c.perimetreId)
      const perimetres = new Set<string | null>([
        fiche.perimetreId,
        ...concernes,
        ...aussi,
      ])
      for (const perimetreId of perimetres) {
        publierPourActivite('FICHE', fiche.organisationId, fiche.activiteId, {
          id: fiche.id,
          perimetreId,
        })
      }
    } catch {
      // Le flux est un accélérateur : les écrans se relisent à leur rythme.
    }
  })()
}

/**
 * Une personne lit-elle une fiche de périmètre, sans contexte de requête ? Elle
 * administre son activité, ou elle a été affectée à son périmètre ou à un
 * périmètre qu'elle concerne. Le résumé et la cloche s'en servent pour ne jamais
 * nommer une fiche devenue illisible.
 */
export async function lecteurDeLaFiche(
  client: PrismaClient,
  userId: string,
  organisationId: string,
  fiche: { id: string; perimetreId: string | null; activiteId: string }
): Promise<boolean> {
  const [admin, adminActivite] = await Promise.all([
    client.appartenance.count({
      where: { userId, organisationId, role: 'ADMIN' },
    }),
    client.adminActivite.count({
      where: { userId, organisationId, activiteId: fiche.activiteId },
    }),
  ])
  if (admin + adminActivite > 0) return true
  const perimetres = new Set(
    (await perimetresConcernes(fiche)).map(c => c.perimetreId)
  )
  if (fiche.perimetreId !== null) perimetres.add(fiche.perimetreId)
  if (perimetres.size === 0) return false
  return (
    (await client.affectation.count({
      where: { userId, perimetreId: { in: [...perimetres] } },
    })) > 0
  )
}
