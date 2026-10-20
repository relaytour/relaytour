import { prisma, type RolePlace } from '@relaytour/database'

import { dansLEquipe, membreActif } from './appartenances.ts'
import { accesRefuse, erreurSaisie } from './erreurs.ts'

// Programme du jour J (ADR 0040). Une séquence suit les droits d'écriture d'une
// réunion (ADR 0037) : l'agenda global de l'activité pour ses admins, l'agenda
// d'un périmètre pour les personnes qui y écrivent.

/** Une séquence dure 24 heures au plus. */
export const SEQUENCE_DUREE_MAX_MS = 24 * 60 * 60 * 1000
/** Une période compte 1 000 séquences au plus. */
export const SEQUENCES_MAX = 1000
/** Une séquence compte 50 places au plus. */
export const PLACES_MAX = 50
export const NOM_LIEU_MAX = 120

export interface PlaceSaisie {
  personneId?: string | number | null
  benevoleId?: string | number | null
  role: RolePlace
}

export interface PlaceValide {
  userId: string | null
  benevoleId: string | null
  role: RolePlace
}

/** Une séquence dure 24 heures au plus. */
export function dureeValide(debut: Date, fin: Date): void {
  if (fin.getTime() - debut.getTime() > SEQUENCE_DUREE_MAX_MS) {
    throw erreurSaisie('Une séquence dure 24 heures au plus.')
  }
}

/**
 * Les places d'une séquence, vérifiées : chacune désigne un membre actif de
 * l'équipe de l'activité, ou une fiche bénévole de l'activité. Une personne ne
 * figure qu'une fois. Une personne hors de ces listes vaut une personne inconnue.
 */
export async function placesValides(
  organisationId: string,
  activiteId: string,
  places: readonly PlaceSaisie[] | null | undefined
): Promise<PlaceValide[]> {
  const liste = places ?? []
  if (liste.length > PLACES_MAX) {
    throw erreurSaisie(`Une séquence compte ${PLACES_MAX} places au plus.`)
  }
  const valides: PlaceValide[] = []
  const vues = new Set<string>()
  for (const place of liste) {
    const userId = place.personneId ? String(place.personneId) : null
    const benevoleId = place.benevoleId ? String(place.benevoleId) : null
    if ((userId === null) === (benevoleId === null)) {
      throw erreurSaisie(
        'Une place désigne une personne de l’équipe ou une fiche bénévole.'
      )
    }
    const cle = userId ?? `b:${benevoleId}`
    if (vues.has(cle)) continue
    vues.add(cle)
    valides.push({ userId, benevoleId, role: place.role })
  }
  const userIds = valides.flatMap(p => (p.userId ? [p.userId] : []))
  const benevoleIds = valides.flatMap(p => (p.benevoleId ? [p.benevoleId] : []))
  const [membres, benevoles] = await Promise.all([
    userIds.length === 0
      ? 0
      : prisma.user.count({
          where: {
            id: { in: userIds },
            AND: [dansLEquipe([activiteId]), membreActif(organisationId)],
          },
        }),
    benevoleIds.length === 0
      ? 0
      : prisma.benevole.count({
          where: { id: { in: benevoleIds }, organisationId, activiteId },
        }),
  ])
  if (membres !== userIds.length || benevoles !== benevoleIds.length) {
    throw accesRefuse()
  }
  return valides
}
