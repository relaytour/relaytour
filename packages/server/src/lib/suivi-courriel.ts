import type { PrismaClient } from '@relaytour/database'

import type {
  ElementDeListe,
  GroupeDeListe,
  RubriqueDeListe,
} from '../courriel/rendu.ts'

import type {
  NotificationComposee,
  NotificationLue,
} from './composition-notifications.ts'
import { i18n, langueCourante } from './langue.ts'

// Mise en page commune des mails de suivi (ADR 0063) : le mail de rappel, les
// échéances du résumé et le mail des priorités rangent leurs lignes par activité,
// puis par périmètre, puis par rubrique. Une tâche partagée porte en retrait le
// résumé de ses déclinaisons.

export type Rubrique =
  'RETARD' | 'PROCHE' | 'A_VENIR' | 'DECLINAISONS' | 'PRIORITES' | 'AUTRES'

const ORDRE_RUBRIQUES: Rubrique[] = [
  'RETARD',
  'PROCHE',
  'A_VENIR',
  'PRIORITES',
  'DECLINAISONS',
  'AUTRES',
]

function titreRubrique(rubrique: Rubrique): string {
  switch (rubrique) {
    case 'RETARD':
      return i18n._('En retard')
    case 'PROCHE':
      return i18n._('Échéance proche')
    case 'A_VENIR':
      return i18n._('À venir')
    case 'PRIORITES':
      return i18n._('À traiter avant le point')
    case 'DECLINAISONS':
      return i18n._('Déclinaisons en retard')
    case 'AUTRES':
      return i18n._('Autres rappels')
  }
}

/** Une ligne à ranger : son activité, son périmètre, sa rubrique. */
export interface LigneSuivi {
  /** L'activité, ou la période quand l'activité en a plusieurs d'ouvertes. */
  groupe: { cle: string; titre: string }
  perimetre: { id: string; nom: string; ordre: number }
  rubrique: Rubrique
  element: ElementDeListe
  /** L'ordre dans la rubrique : la date d'échéance, ou le rang d'une priorité. */
  tri: number
}

/**
 * Range les lignes : les activités dans l'ordre de leur première ligne, les
 * périmètres dans l'ordre de l'activité, les rubriques dans un ordre fixe.
 */
interface PerimetreRange {
  nom: string
  ordre: number
  rubriques: Map<Rubrique, { tri: number; element: ElementDeListe }[]>
}

interface GroupeRange {
  titre: string
  perimetres: Map<string, PerimetreRange>
}

export function ranger(lignes: LigneSuivi[]): GroupeDeListe[] {
  const groupes = new Map<string, GroupeRange>()
  for (const l of lignes) {
    const groupe: GroupeRange = groupes.get(l.groupe.cle) ?? {
      titre: l.groupe.titre,
      perimetres: new Map<string, PerimetreRange>(),
    }
    groupes.set(l.groupe.cle, groupe)
    const perimetre: PerimetreRange = groupe.perimetres.get(l.perimetre.id) ?? {
      nom: l.perimetre.nom,
      ordre: l.perimetre.ordre,
      rubriques: new Map(),
    }
    groupe.perimetres.set(l.perimetre.id, perimetre)
    const rubrique = perimetre.rubriques.get(l.rubrique) ?? []
    rubrique.push({ tri: l.tri, element: l.element })
    perimetre.rubriques.set(l.rubrique, rubrique)
  }
  return [...groupes.values()].map(g => ({
    titre: g.titre,
    elements: [],
    sousGroupes: [...g.perimetres.values()]
      .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom))
      .map(p => ({
        titre: p.nom,
        rubriques: ORDRE_RUBRIQUES.flatMap((r): RubriqueDeListe[] => {
          const elements = p.rubriques.get(r)
          if (elements === undefined) return []
          return [
            {
              titre: titreRubrique(r),
              alerte: r === 'RETARD' || r === 'DECLINAISONS',
              elements: elements
                .sort((a, b) => a.tri - b.tri)
                .map(e => e.element),
            },
          ]
        }),
      })),
  }))
}

export function dateLongue(date: Date): string {
  return date.toLocaleDateString(langueCourante(), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/** Les compteurs des déclinaisons acceptées d'une tâche partagée. */
export interface CompteDeclinaisons {
  total: number
  enRetard: number
  enCours: number
  faites: number
}

/**
 * Compte les déclinaisons acceptées de chaque tâche : une déclinaison en attente
 * ou refusée ne compte pas, une déclinaison abandonnée sort du total (ADR 0026).
 * Une tâche sans déclinaison n'a pas d'entrée.
 */
export async function compterDeclinaisons(
  prisma: PrismaClient,
  tacheIds: string[],
  jour: Date
): Promise<Map<string, CompteDeclinaisons>> {
  const comptes = new Map<string, CompteDeclinaisons>()
  if (tacheIds.length === 0) return comptes
  const declinaisons = await prisma.tache.findMany({
    where: {
      origineId: { in: [...new Set(tacheIds)] },
      accord: 'ACCEPTE',
      statut: { not: 'ABANDONNEE' },
    },
    select: { origineId: true, statut: true, echeance: true },
  })
  for (const d of declinaisons) {
    const compte = comptes.get(d.origineId!) ?? {
      total: 0,
      enRetard: 0,
      enCours: 0,
      faites: 0,
    }
    compte.total++
    if (d.statut === 'FAITE') compte.faites++
    else if (d.echeance !== null && d.echeance < jour) compte.enRetard++
    else if (d.statut === 'EN_COURS') compte.enCours++
    comptes.set(d.origineId!, compte)
  }
  return comptes
}

/** « Déclinaisons : 2 en retard, 3 en cours, 4 faites sur 10 », sans nombre nul. */
export function resumeDeclinaisons(compte: CompteDeclinaisons): string {
  const parties = [
    compte.enRetard > 0
      ? i18n._('{n} en retard', { n: compte.enRetard })
      : null,
    compte.enCours > 0 ? i18n._('{n} en cours', { n: compte.enCours }) : null,
    compte.faites > 0
      ? i18n._('{n, plural, one {# faite} other {# faites}}', {
          n: compte.faites,
        })
      : null,
  ].filter((p): p is string => p !== null)
  return parties.length === 0
    ? i18n._('Déclinaisons : {total} à faire', { total: compte.total })
    : i18n._('Déclinaisons : {parties} sur {total}', {
        parties: parties.join(', '),
        total: compte.total,
      })
}

/** Une ligne de tâche, avec le résumé de ses déclinaisons quand elle en a. */
export function avecDeclinaisons(
  texte: string,
  compte: CompteDeclinaisons | undefined
): ElementDeListe {
  return compte === undefined || compte.total === 0
    ? texte
    : { texte, retrait: [resumeDeclinaisons(compte)] }
}

/** Les activités qui ont plus d'une période non archivée : leurs mails nomment la période. */
export async function activitesAPlusieursPeriodes(
  prisma: PrismaClient,
  activiteIds: string[]
): Promise<Set<string>> {
  if (activiteIds.length === 0) return new Set()
  const periodes = await prisma.edition.groupBy({
    by: ['activiteId'],
    where: {
      activiteId: { in: [...new Set(activiteIds)] },
      statut: { not: 'ARCHIVEE' },
    },
    _count: { _all: true },
  })
  return new Set(periodes.filter(p => p._count._all > 1).map(p => p.activiteId))
}

/**
 * Range les notifications du mail de rappel (ADR 0063) : par activité, par
 * périmètre, puis en retard, échéance proche et déclinaisons en retard. Les
 * déclinaisons en retard d'une même tâche partagée se regroupent sous elle.
 */
export async function rangerRappels(
  prisma: PrismaClient,
  notifications: NotificationLue[],
  composees: NotificationComposee[],
  sansActivite: string,
  jour: Date
): Promise<GroupeDeListe[]> {
  const parId = new Map(composees.map(c => [c.id, c]))
  const perimetreIds = [
    ...new Set(
      notifications.flatMap(n => [n.perimetreId, n.tache?.perimetreId ?? null])
    ),
  ].filter((id): id is string => id !== null)
  const tachesSuivies = notifications.flatMap(n =>
    n.type === 'DECLINAISON_EN_RETARD'
      ? n.tache?.origine
        ? [n.tache.origine.id]
        : []
      : n.tache
        ? [n.tache.id]
        : []
  )
  const [perimetres, comptes] = await Promise.all([
    prisma.perimetre.findMany({
      where: { id: { in: perimetreIds } },
      select: { id: true, nom: true, ordre: true },
    }),
    compterDeclinaisons(prisma, tachesSuivies, jour),
  ])
  const infos = new Map(perimetres.map(p => [p.id, p]))
  const lignes: LigneSuivi[] = []
  const suivies = new Map<
    string,
    { ligne: LigneSuivi; retards: { tri: number; texte: string }[] }
  >()
  for (const n of notifications) {
    const c = parId.get(n.id)
    if (c === undefined) continue
    const groupe = c.activite
      ? { cle: c.periode ?? c.activite.id, titre: c.periode ?? c.activite.nom }
      : { cle: '', titre: sansActivite }
    const perimetreId = n.perimetreId ?? n.tache?.perimetreId ?? null
    const info = perimetreId ? infos.get(perimetreId) : undefined
    const perimetre = info ?? { id: '', nom: sansActivite, ordre: -1 }
    const tache = n.tache
    const tri = tache?.echeance?.getTime() ?? Number.MAX_SAFE_INTEGER
    if (tache === null) {
      lignes.push({
        groupe,
        perimetre,
        rubrique: 'AUTRES',
        element: c.message,
        tri,
      })
      continue
    }
    const titre = tache.titre
    const date = tache.echeance ? dateLongue(tache.echeance) : ''
    switch (n.type) {
      case 'TACHE_EN_RETARD':
        lignes.push({
          groupe,
          perimetre,
          rubrique: 'RETARD',
          element: avecDeclinaisons(
            date
              ? i18n._('« {titre} », en retard depuis le {date}', {
                  titre,
                  date,
                })
              : i18n._('« {titre} », en retard', { titre }),
            comptes.get(tache.id)
          ),
          tri,
        })
        break
      case 'ECHEANCE_PROCHE':
        lignes.push({
          groupe,
          perimetre,
          rubrique: 'PROCHE',
          element: avecDeclinaisons(
            i18n._(
              '{jours, plural, =0 {« {titre} », échéance aujourd’hui} =1 {« {titre} », échéance demain} other {« {titre} », échéance dans # jours, le {date}}}',
              { jours: n.jours ?? 7, titre, date }
            ),
            comptes.get(tache.id)
          ),
          tri,
        })
        break
      case 'DECLINAISON_EN_RETARD': {
        const origine = tache.origine
        if (!origine) break
        const cible = infos.get(tache.perimetreId)?.nom ?? ''
        const texte = date
          ? i18n._('{cible} : « {titre} », en retard depuis le {date}', {
              cible,
              titre,
              date,
            })
          : i18n._('{cible} : « {titre} », en retard', { cible, titre })
        const suivie = suivies.get(origine.id) ?? {
          ligne: {
            groupe,
            perimetre,
            rubrique: 'DECLINAISONS' as const,
            element: '',
            tri,
          },
          retards: [],
        }
        suivie.retards.push({ tri, texte })
        suivie.ligne.tri = Math.min(suivie.ligne.tri, tri)
        suivies.set(origine.id, suivie)
        break
      }
      default:
        lignes.push({
          groupe,
          perimetre,
          rubrique: 'AUTRES',
          element: c.message,
          tri,
        })
    }
  }
  for (const [origineId, suivie] of suivies) {
    const origine = notifications.find(n => n.tache?.origine?.id === origineId)!
      .tache!.origine!
    const compte = comptes.get(origineId)
    lignes.push({
      ...suivie.ligne,
      element: {
        texte: i18n._('« {titre} »', { titre: origine.titre }),
        retrait: [
          ...suivie.retards.sort((a, b) => a.tri - b.tri).map(r => r.texte),
          ...(compte ? [resumeDeclinaisons(compte)] : []),
        ],
      },
    })
  }
  return ranger(lignes)
}
