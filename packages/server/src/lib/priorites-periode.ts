import {
  prisma,
  type AjustementPriorite,
  type Edition,
  type Perimetre,
  type Tache,
} from '@relaytour/database'

import { jourISO } from './agenda.ts'
import { TACHES_ACTIVES } from './declinaisons.ts'
import { aujourdhui } from './droits.ts'
import { heureLocale } from './heures.ts'
import { moduleActif } from './modules.ts'
import {
  ajustementActif,
  classerPriorites,
  horizon,
  type Raison,
  type TacheAClasser,
} from './priorites.ts'
import { filtreProchainPoint } from './reunions.ts'

// Lecture des priorités d'une période (ADR 0059), commune au panneau Priorités et
// au mail des priorités (ADR 0063) : même horizon, même score, même plafond.

const OUVERTES = ['A_FAIRE', 'EN_COURS'] as const

export interface AjustementLu {
  niveau: AjustementPriorite
  parId: string | null
  le: Date
  jusquAu: Date
}

/** L'ajustement d'une tâche, s'il compte encore aujourd'hui. */
export function ajustementLu(
  tache: Pick<
    Tache,
    | 'ajustementPriorite'
    | 'ajustementParId'
    | 'ajustementLe'
    | 'ajustementJusquAu'
  >,
  jour: string
): AjustementLu | null {
  if (
    tache.ajustementPriorite === null ||
    tache.ajustementLe === null ||
    tache.ajustementJusquAu === null
  ) {
    return null
  }
  const actif = ajustementActif(
    {
      niveau: tache.ajustementPriorite,
      jusquAu: jourISO(tache.ajustementJusquAu),
    },
    jour
  )
  return actif === null
    ? null
    : {
        niveau: tache.ajustementPriorite,
        parId: tache.ajustementParId,
        le: tache.ajustementLe,
        jusquAu: tache.ajustementJusquAu,
      }
}

export interface PrioriteLue {
  tache: Tache
  score: number
  raisons: Raison[]
}

export interface PrioritesDuPerimetreLues {
  perimetre: Perimetre
  priorites: PrioriteLue[]
  autres: number
  ensuite: Tache | null
}

export interface PrioritesDeLaPeriode {
  /** Dernier jour de l'horizon (AAAA-MM-JJ), dans le fuseau de l'organisation. */
  fin: string
  /** Le prochain point d'équipe, ou null sans point prévu ou sans module Agenda. */
  pointId: string | null
  pointDebut: Date | null
  perimetres: PrioritesDuPerimetreLues[]
  /** Les jalons ouverts dont l'échéance tombe dans l'horizon, par échéance (ADR 0062). */
  jalons: Tache[]
}

type TacheLue = TacheAClasser & { ligne: Tache }

/**
 * Les priorités d'une période : pour chaque périmètre non archivé de l'activité,
 * les tâches à traiter avant le prochain point, classées par score. Une
 * déclinaison qui n'est pas acceptée n'entre pas (ADR 0026).
 */
export async function lirePrioritesDeLaPeriode(
  edition: Pick<Edition, 'id' | 'activiteId'>,
  fuseau: string,
  maintenant: Date
): Promise<PrioritesDeLaPeriode> {
  const jour = aujourdhui(maintenant, fuseau)
  const agenda = await moduleActif(edition.activiteId, 'AGENDA')
  const [perimetres, taches, point, liens] = await Promise.all([
    prisma.perimetre.findMany({
      where: { activiteId: edition.activiteId, archivedAt: null },
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
    }),
    prisma.tache.findMany({
      where: {
        editionId: edition.id,
        perimetre: { archivedAt: null },
        statut: { in: [...OUVERTES] },
        AND: [TACHES_ACTIVES],
      },
      include: {
        _count: { select: { assignations: true } },
        declinaisons: {
          select: { statut: true, accord: true, echeance: true },
        },
        // Jalons (ADR 0062) : les tâches liées d'un jalon, et les jalons
        // qu'une tâche sert.
        liensJalon: { select: { tache: { select: { statut: true } } } },
        liensTache: {
          select: {
            jalon: {
              select: {
                titre: true,
                echeance: true,
                statut: true,
                accord: true,
                jalonLe: true,
                perimetre: { select: { archivedAt: true } },
              },
            },
          },
        },
      },
    }),
    agenda
      ? prisma.reunion.findFirst({
          where: filtreProchainPoint(edition.id, maintenant),
          select: { id: true, debut: true },
          orderBy: { debut: 'asc' },
        })
      : null,
    agenda
      ? prisma.reunionTache.findMany({
          where: {
            tache: { editionId: edition.id },
            reunion: { statut: 'PREVUE', debut: { gt: maintenant } },
          },
          select: { tacheId: true },
        })
      : [],
  ])
  const reunions = new Map<string, number>()
  for (const l of liens) {
    reunions.set(l.tacheId, (reunions.get(l.tacheId) ?? 0) + 1)
  }
  const h = horizon(
    jour,
    point === null ? null : heureLocale(point.debut, fuseau).jour
  )
  const aClasser: TacheLue[] = taches.map(tache => {
    const ouvertes = tache.declinaisons.filter(
      d => d.statut === 'A_FAIRE' || d.statut === 'EN_COURS'
    )
    const actives = ouvertes.filter(d => d.accord === 'ACCEPTE')
    const ajustement = ajustementLu(tache, jour)
    return {
      id: tache.id,
      perimetreId: tache.perimetreId,
      statut: tache.statut as TacheAClasser['statut'],
      echeance: tache.echeance ? jourISO(tache.echeance) : null,
      assignes: tache._count.assignations,
      declinaisonsActives: actives.length,
      declinaisonsEnAttente: tache.declinaisons.filter(
        d => d.accord === 'EN_ATTENTE'
      ).length,
      echeancesDeclinaisons: actives.flatMap(d =>
        d.echeance ? [jourISO(d.echeance)] : []
      ),
      reunionsAVenir: reunions.get(tache.id) ?? 0,
      ...(tache.jalonLe === null
        ? {}
        : {
            jalonOuvertes: tache.liensJalon.filter(
              l => l.tache.statut === 'A_FAIRE' || l.tache.statut === 'EN_COURS'
            ).length,
          }),
      jalonsServis: tache.liensTache.flatMap(({ jalon }) =>
        jalon.jalonLe !== null &&
        jalon.echeance !== null &&
        (jalon.statut === 'A_FAIRE' || jalon.statut === 'EN_COURS') &&
        (jalon.accord === null || jalon.accord === 'ACCEPTE') &&
        jalon.perimetre.archivedAt === null
          ? [{ titre: jalon.titre, echeance: jourISO(jalon.echeance) }]
          : []
      ),
      ajustement:
        ajustement === null
          ? null
          : {
              niveau: ajustement.niveau,
              jusquAu: jourISO(ajustement.jusquAu),
            },
      ligne: tache,
    }
  })
  const parId = new Map(perimetres.map(p => [p.id, p]))
  const classes = classerPriorites(
    aClasser,
    perimetres.map(p => p.id),
    h
  )
  const jalons = taches
    .filter(
      t =>
        t.jalonLe !== null &&
        t.echeance !== null &&
        jourISO(t.echeance) <= h.fin
    )
    .sort((a, b) => a.echeance!.getTime() - b.echeance!.getTime())
  return {
    fin: h.fin,
    jalons,
    pointId: point?.id ?? null,
    pointDebut: point?.debut ?? null,
    perimetres: classes.map(c => ({
      perimetre: parId.get(c.perimetreId)!,
      priorites: c.priorites.map(n => ({
        tache: n.tache.ligne,
        score: n.score,
        raisons: n.raisons,
      })),
      autres: c.autres,
      ensuite: c.ensuite?.ligne ?? null,
    })),
  }
}
