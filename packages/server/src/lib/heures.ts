import { erreurSaisie } from './erreurs.ts'

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

/**
 * L'instant d'une heure murale dans un fuseau. Une heure qui n'existe pas, au
 * passage à l'heure d'été, avance d'une heure. Une heure doublée, au passage à
 * l'heure d'hiver, vaut sa première occurrence.
 */
export function instantDepuisHeureLocale(
  jour: string,
  heure: string,
  fuseau: string
): Date {
  if (!JOUR.test(jour))
    throw erreurSaisie('Le jour attendu est au format AAAA-MM-JJ.')
  const lue = HEURE.exec(heure)
  if (lue === null) throw erreurSaisie('L’heure attendue est au format HH:MM.')
  const [annee, mois, quantieme] = jour.split('-').map(Number)
  const voulue = Date.UTC(
    annee!,
    mois! - 1,
    quantieme,
    Number(lue[1]),
    Number(lue[2])
  )
  // Deux essais : le décalage du fuseau à l'heure voulue, puis à l'instant trouvé.
  const premier = voulue - (murale(voulue, fuseau) - voulue)
  const decalage = murale(premier, fuseau) - premier
  const second = voulue - decalage
  if (murale(second, fuseau) === voulue) {
    // Une heure doublée a deux instants : le plus tôt des deux.
    const plusTot = second - 60 * 60 * 1000
    return new Date(murale(plusTot, fuseau) === voulue ? plusTot : second)
  }
  if (murale(premier, fuseau) === voulue) return new Date(premier)
  // Une heure qui n'existe pas : le plus tardif des deux essais, une heure après.
  return new Date(Math.max(premier, second))
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
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`
}

/**
 * L'horaire d'une réunion en clair, dans le fuseau de l'organisation : « lundi
 * 1 mars 2027, de 18 h 30 à 20 h », ou « du samedi 6 mars 2027 à 9 h au dimanche
 * 7 mars 2027 à 17 h » pour une réunion de plusieurs jours.
 */
export function horaireEnClair(debut: Date, fin: Date, fuseau: string): string {
  const format = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: fuseau,
  })
  const du = heureLocale(debut, fuseau)
  const au = heureLocale(fin, fuseau)
  if (du.jour !== au.jour) {
    return `du ${format.format(debut)} à ${heureEnClair(du.heure)} au ${format.format(fin)} à ${heureEnClair(au.heure)}`
  }
  return `${format.format(debut)}, de ${heureEnClair(du.heure)} à ${heureEnClair(au.heure)}`
}
