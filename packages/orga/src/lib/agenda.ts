// Agenda d'une période (ADR 0037), côté navigateur.
//
// Les jours s'écrivent au format AAAA-MM-JJ et se comparent comme des chaînes :
// aucun fuseau ne les décale. Les calculs passent par des instants UTC.

import { formatDate } from './langue'

const JOUR_MS = 24 * 60 * 60 * 1000

function instantDuJour(jour: string): number {
  const [annee, mois, quantieme] = jour.slice(0, 10).split('-').map(Number)
  return Date.UTC(annee ?? 0, (mois ?? 1) - 1, quantieme ?? 1)
}

/** Le jour d'un instant au format AAAA-MM-JJ, dans le fuseau du navigateur. */
export function jourLocal(maintenant = new Date(), fuseau?: string): string {
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: fuseau,
  }).format(maintenant)
}

/** Le jour situé à `jours` jours d'un autre. */
export function decalerJour(jour: string, jours: number): string {
  return new Date(instantDuJour(jour) + jours * JOUR_MS)
    .toISOString()
    .slice(0, 10)
}

/** Le mois AAAA-MM situé à `mois` mois d'un autre. */
export function decalerMois(mois: string, decalage: number): string {
  const [annee, numero] = mois.split('-').map(Number)
  return new Date(Date.UTC(annee ?? 0, (numero ?? 1) - 1 + decalage, 1))
    .toISOString()
    .slice(0, 7)
}

/** Le jour de la semaine, de 0 pour lundi à 6 pour dimanche. */
function rangDansLaSemaine(jour: string): number {
  return (new Date(instantDuJour(jour)).getUTCDay() + 6) % 7
}

export interface CaseDuMois {
  jour: string
  /** Faux pour les jours des mois voisins qui complètent la première et la dernière semaine. */
  dansLeMois: boolean
}

/** Les semaines d'un mois AAAA-MM, du lundi au dimanche. */
export function grilleDuMois(mois: string): CaseDuMois[][] {
  const premier = `${mois}-01`
  const debut = decalerJour(premier, -rangDansLaSemaine(premier))
  const semaines: CaseDuMois[][] = []
  let jour = debut
  do {
    const semaine: CaseDuMois[] = []
    for (let i = 0; i < 7; i++) {
      semaine.push({ jour, dansLeMois: jour.startsWith(mois) })
      jour = decalerJour(jour, 1)
    }
    semaines.push(semaine)
  } while (jour.startsWith(mois))
  return semaines
}

interface Etendue {
  jour: string
  jourFin?: string | null
}

/** Vrai si l'élément couvre ce jour, du premier au dernier jour compris. */
export function couvre(element: Etendue, jour: string): boolean {
  return element.jour <= jour && jour <= (element.jourFin ?? element.jour)
}

/** Vrai si l'élément touche ce mois AAAA-MM. */
export function toucheLeMois(element: Etendue, mois: string): boolean {
  return (
    element.jour.slice(0, 7) <= mois &&
    mois <= (element.jourFin ?? element.jour).slice(0, 7)
  )
}

export interface GroupeMoisAgenda<T> {
  /** Mois au format AAAA-MM. */
  mois: string
  elements: T[]
}

/**
 * Range les éléments par mois de leur premier jour, dans l'ordre reçu. Un élément
 * qui finit avant `depuis` est écarté : la liste commence au jour choisi.
 */
export function grouperParMoisAgenda<T extends Etendue>(
  elements: readonly T[],
  depuis: string | null = null
): GroupeMoisAgenda<T>[] {
  const groupes = new Map<string, T[]>()
  for (const element of elements) {
    if (depuis !== null && (element.jourFin ?? element.jour) < depuis) continue
    const mois = element.jour.slice(0, 7)
    const groupe = groupes.get(mois)
    if (groupe) groupe.push(element)
    else groupes.set(mois, [element])
  }
  return [...groupes]
    .map(([mois, contenu]) => ({ mois, elements: contenu }))
    .sort((a, b) => a.mois.localeCompare(b.mois))
}

// Les formats suivent la langue active : ils se lisent à chaque appel, et
// `formatDate` les garde en cache.
const OPTIONS_JOUR: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
}
const OPTIONS_JOUR_SEUL: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
}

/** « lun. 1 mars », ou « 1 mars → 3 mars » pour une suite de jours. */
export function libelleJours(jour: string, jourFin?: string | null): string {
  const du = new Date(instantDuJour(jour))
  if (!jourFin || jourFin === jour) return formatDate(OPTIONS_JOUR).format(du)
  const formatJourSeul = formatDate(OPTIONS_JOUR_SEUL)
  return `${formatJourSeul.format(du)} → ${formatJourSeul.format(
    new Date(instantDuJour(jourFin))
  )}`
}

/** Le quantième d'un jour, pour une case du mois : « 1 », « 31 ». */
export function quantieme(jour: string): string {
  return String(Number(jour.slice(8, 10)))
}

/** Les jours de la semaine, du lundi au dimanche, en abrégé, dans la langue active. */
export function joursDeLaSemaine(): string[] {
  const format = formatDate({ weekday: 'short', timeZone: 'UTC' })
  // Le 1er mars 2027 est un lundi.
  return Array.from({ length: 7 }, (_, rang) =>
    format.format(new Date(instantDuJour(decalerJour('2027-03-01', rang))))
  )
}
