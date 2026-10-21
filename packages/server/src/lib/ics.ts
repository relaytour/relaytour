// Fichiers iCalendar (RFC 5545) de l'agenda (ADR 0037), sans dépendance.
//
// Les réunions s'écrivent en UTC : chaque agenda les affiche dans le fuseau de son
// appareil, sans table de fuseau à joindre. Les phases, les dates clés et les
// échéances sont des journées entières. Les lignes finissent par CRLF et se plient
// à 75 octets.

const PRODID = '-//Relaytour//Agenda//FR'
const LIGNE_OCTETS_MAX = 75

export type HoraireIcs =
  | { debut: Date; fin: Date }
  /** Journée entière : premier et dernier jour compris, au format AAAA-MM-JJ. */
  | { jour: string; jourFin?: string | null }

export interface PersonneIcs {
  nom: string
  adresse: string
}

export interface EvenementIcs {
  uid: string
  titre: string
  horaire: HoraireIcs
  lieu?: string | null
  description?: string | null
  /** Adresse de la page de l'événement, ou le lien de visio. */
  url?: string | null
  sequence?: number
  annule?: boolean
  modifieLe?: Date
  organisateur?: PersonneIcs
  /** Le seul participant écrit : la personne destinataire d'une convocation. */
  participant?: PersonneIcs
}

export type MethodeIcs = 'PUBLISH' | 'REQUEST' | 'CANCEL'

/** Échappe une valeur de texte : barre oblique inverse, point-virgule, virgule, saut de ligne. */
export function echapper(texte: string): string {
  return texte
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** Plie une ligne à 75 octets UTF-8, sans couper un caractère. */
export function plier(ligne: string): string {
  const encodeur = new TextEncoder()
  const morceaux: string[] = []
  let courant = ''
  let octets = 0
  for (const caractere of ligne) {
    const taille = encodeur.encode(caractere).length
    // La suite d'une ligne commence par une espace, qui compte dans ses 75 octets.
    const max = morceaux.length === 0 ? LIGNE_OCTETS_MAX : LIGNE_OCTETS_MAX - 1
    if (octets + taille > max) {
      morceaux.push(courant)
      courant = ''
      octets = 0
    }
    courant += caractere
    octets += taille
  }
  morceaux.push(courant)
  return morceaux.join('\r\n ')
}

/** Un instant au format iCalendar en UTC : 20270301T173000Z. */
export function instantIcs(instant: Date): string {
  return instant
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

const jourIcs = (jour: string) => jour.replace(/-/g, '')

function lendemain(jour: string): string {
  const [annee, mois, quantieme] = jour.split('-').map(Number)
  return new Date(Date.UTC(annee ?? 0, (mois ?? 1) - 1, (quantieme ?? 1) + 1))
    .toISOString()
    .slice(0, 10)
}

/** Les paramètres d'une personne : son nom entre guillemets, sans guillemet interne. */
function personne(propriete: string, p: PersonneIcs, suite = ''): string {
  const nom = p.nom.replace(/["\r\n]/g, ' ').trim()
  return `${propriete};CN="${nom}"${suite}:mailto:${p.adresse}`
}

function lignesEvenement(evenement: EvenementIcs, maintenant: Date): string[] {
  const lignes = [
    'BEGIN:VEVENT',
    `UID:${evenement.uid}`,
    `DTSTAMP:${instantIcs(maintenant)}`,
  ]
  const horaire = evenement.horaire
  if ('debut' in horaire) {
    lignes.push(
      `DTSTART:${instantIcs(horaire.debut)}`,
      `DTEND:${instantIcs(horaire.fin)}`
    )
  } else {
    // Le dernier jour d'une journée entière est exclusif : le lendemain.
    lignes.push(
      `DTSTART;VALUE=DATE:${jourIcs(horaire.jour)}`,
      `DTEND;VALUE=DATE:${jourIcs(lendemain(horaire.jourFin ?? horaire.jour))}`,
      'TRANSP:TRANSPARENT'
    )
  }
  lignes.push(`SUMMARY:${echapper(evenement.titre)}`)
  if (evenement.lieu) lignes.push(`LOCATION:${echapper(evenement.lieu)}`)
  if (evenement.description) {
    lignes.push(`DESCRIPTION:${echapper(evenement.description)}`)
  }
  if (evenement.url) lignes.push(`URL:${evenement.url}`)
  if (evenement.sequence !== undefined) {
    lignes.push(`SEQUENCE:${evenement.sequence}`)
  }
  if (evenement.modifieLe) {
    lignes.push(`LAST-MODIFIED:${instantIcs(evenement.modifieLe)}`)
  }
  lignes.push(`STATUS:${evenement.annule ? 'CANCELLED' : 'CONFIRMED'}`)
  if (evenement.organisateur) {
    lignes.push(personne('ORGANIZER', evenement.organisateur))
  }
  if (evenement.participant) {
    lignes.push(
      personne(
        'ATTENDEE',
        evenement.participant,
        ';ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE'
      )
    )
  }
  lignes.push('END:VEVENT')
  return lignes
}

/** Un calendrier complet, prêt à servir ou à joindre à un mail. */
export function calendrier(options: {
  evenements: readonly EvenementIcs[]
  methode?: MethodeIcs
  /** Nom affiché par un agenda abonné. */
  nom?: string
  /** Fuseau indicatif d'un agenda abonné. */
  fuseau?: string
  maintenant?: Date
}): string {
  const maintenant = options.maintenant ?? new Date()
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `METHOD:${options.methode ?? 'PUBLISH'}`,
  ]
  if (options.nom) lignes.push(`X-WR-CALNAME:${echapper(options.nom)}`)
  if (options.fuseau) lignes.push(`X-WR-TIMEZONE:${options.fuseau}`)
  for (const evenement of options.evenements) {
    lignes.push(...lignesEvenement(evenement, maintenant))
  }
  lignes.push('END:VCALENDAR')
  return lignes.map(plier).join('\r\n') + '\r\n'
}
