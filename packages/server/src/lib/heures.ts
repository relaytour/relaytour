import { erreurSaisie } from './erreurs.ts'
import { i18n, langueCourante } from './langue.ts'

// Heures d'une réunion dans le fuseau de l'organisation (ADR 0037).
//
// Le serveur garde des instants en UTC. La saisie et l'affichage passent par le
// fuseau de l'organisation : un jour au format AAAA-MM-JJ et une heure HH:MM. Ce
// module ne lit pas la base.

export const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/
const JOUR = /^\d{4}-\d{2}-\d{2}$/

const formats = new Map<string, Intl.DateTimeFormat>()

function formatDuFuseau(fuseau: string): Intl.DateTimeFormat {
  let format = formats.get(fuseau)
  if (format === undefined) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formats.set(fuseau, format)
  }
  return format
}

/** L'heure murale d'un instant dans un fuseau, en millisecondes « comme UTC ». */
function murale(instant: number, fuseau: string): number {
  const parties = Object.fromEntries(
    formatDuFuseau(fuseau)
      .formatToParts(new Date(instant))
      .map(p => [p.type, p.value])
  )
  return Date.UTC(
    Number(parties.year),
    Number(parties.month) - 1,
    Number(parties.day),
    Number(parties.hour),
    Number(parties.minute),
    Number(parties.second)
  )
}

const JOUR_MS = 24 * 60 * 60 * 1000

/**
 * L'instant d'une heure murale dans un fuseau. Une heure qui n'existe pas, au
 * passage à l'heure d'été, avance de la durée du saut. Une heure doublée, au
 * passage à l'heure d'hiver, vaut sa première occurrence. Le saut dure une heure
 * en général, trente minutes dans certains fuseaux (Australia/Lord_Howe).
 */
export function instantDepuisHeureLocale(
  jour: string,
  heure: string,
  fuseau: string
): Date {
  if (!JOUR.test(jour))
    throw erreurSaisie(i18n._('Le jour attendu est au format AAAA-MM-JJ.'))
  const lue = HEURE.exec(heure)
  if (lue === null)
    throw erreurSaisie(i18n._('L’heure attendue est au format HH:MM.'))
  const [annee, mois, quantieme] = jour.split('-').map(Number)
  const voulue = Date.UTC(
    annee!,
    mois! - 1,
    quantieme,
    Number(lue[1]),
    Number(lue[2])
  )
  // Les décalages du fuseau la veille, le jour même et le lendemain encadrent
  // toute transition de la journée. Chacun donne un instant candidat.
  const decalage = (instant: number) => murale(instant, fuseau) - instant
  const avant = decalage(voulue - JOUR_MS)
  const decalages = new Set([
    avant,
    decalage(voulue),
    decalage(voulue + JOUR_MS),
  ])
  const exacts = [...decalages]
    .map(d => voulue - d)
    .filter(instant => murale(instant, fuseau) === voulue)
  // Une heure doublée a deux instants : le plus tôt des deux.
  if (exacts.length > 0) return new Date(Math.min(...exacts))
  // Une heure qui n'existe pas : le décalage d'avant le saut la repousse après.
  return new Date(voulue - avant)
}

/**
 * Les instants qui bornent une suite de jours dans un fuseau : le minuit du
 * premier jour, et la dernière milliseconde du dernier jour.
 */
export function bornesDesJours(
  depuis: string,
  jusqua: string,
  fuseau: string
): { debut: Date; fin: Date } {
  const lendemain = new Date(`${jusqua}T00:00:00.000Z`)
  lendemain.setUTCDate(lendemain.getUTCDate() + 1)
  return {
    debut: instantDepuisHeureLocale(depuis, '00:00', fuseau),
    fin: new Date(
      instantDepuisHeureLocale(
        lendemain.toISOString().slice(0, 10),
        '00:00',
        fuseau
      ).getTime() - 1
    ),
  }
}

/** Le jour et l'heure d'un instant dans un fuseau. */
export function heureLocale(
  instant: Date,
  fuseau: string
): { jour: string; heure: string } {
  const iso = new Date(murale(instant.getTime(), fuseau)).toISOString()
  return { jour: iso.slice(0, 10), heure: iso.slice(11, 16) }
}

/** « 18 h 30 », ou « 18 h » à l'heure pile. */
function heureEnClair(heure: string): string {
  const [h, m] = heure.split(':')
  const heures = Number(h)
  return m === '00'
    ? i18n._(
        '{heures} h',
        { heures },
        { comment: 'Heure pile, par exemple 18 h' }
      )
    : i18n._(
        '{heures} h {minutes}',
        { heures, minutes: m },
        { comment: 'Heure avec minutes, par exemple 18 h 30' }
      )
}

/**
 * L'horaire d'une réunion en clair, dans le fuseau de l'organisation : « lundi
 * 1 mars 2027, de 18 h 30 à 20 h », ou « du samedi 6 mars 2027 à 9 h au dimanche
 * 7 mars 2027 à 17 h » pour une réunion de plusieurs jours.
 */
export function horaireEnClair(debut: Date, fin: Date, fuseau: string): string {
  const format = new Intl.DateTimeFormat(langueCourante(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: fuseau,
  })
  const du = heureLocale(debut, fuseau)
  const au = heureLocale(fin, fuseau)
  if (du.jour !== au.jour) {
    return i18n._('du {jourDebut} à {heureDebut} au {jourFin} à {heureFin}', {
      jourDebut: format.format(debut),
      heureDebut: heureEnClair(du.heure),
      jourFin: format.format(fin),
      heureFin: heureEnClair(au.heure),
    })
  }
  return i18n._('{jour}, de {heureDebut} à {heureFin}', {
    jour: format.format(debut),
    heureDebut: heureEnClair(du.heure),
    heureFin: heureEnClair(au.heure),
  })
}
