import { prisma, type RolePlace } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { dansLEquipeQuiVoit, membreActif } from './appartenances.ts'
import { peutModifierPerimetre } from './droits.ts'
import { accesRefuse, erreurSaisie } from './erreurs.ts'
import { i18n } from './langue.ts'

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

/** Une place prête à écrire, avec sa date de confirmation (ADR 0041). */
export interface PlaceDatee extends PlaceValide {
  confirmeeLe: Date | null
  /** La date de création d'une place gardée ; rien pour une place nouvelle. */
  createdAt?: Date
}

/**
 * Les places d'une séquence avec leur date de confirmation. Une place déjà tenue
 * par la même personne garde la sienne, même nulle (place à confirmer), et sa
 * date de création. Une place
 * nouvelle d'une fiche joignable reste à confirmer ; toute autre place nouvelle
 * naît confirmée (ADR 0041).
 */
export function placesDatees(
  places: readonly PlaceValide[],
  actuelles: readonly {
    userId: string | null
    benevoleId: string | null
    confirmeeLe: Date | null
    createdAt?: Date
  }[],
  maintenant: Date,
  joignables: ReadonlySet<string> = new Set()
): PlaceDatee[] {
  const cle = (p: { userId: string | null; benevoleId: string | null }) =>
    p.userId ?? `b:${p.benevoleId}`
  const dates = new Map(actuelles.map(p => [cle(p), p] as const))
  return places.map(p => {
    const k = cle(p)
    // Une place gardée garde ses dates : le délai de sept jours d'une place à
    // confirmer court depuis sa vraie création.
    const tenue = dates.get(k)
    if (tenue !== undefined) {
      return {
        ...p,
        confirmeeLe: tenue.confirmeeLe,
        ...(tenue.createdAt ? { createdAt: tenue.createdAt } : {}),
      }
    }
    const aConfirmer = p.benevoleId !== null && joignables.has(p.benevoleId)
    return { ...p, confirmeeLe: aConfirmer ? null : maintenant }
  })
}

/**
 * Vrai si la personne écrit la séquence : elle écrit dans son périmètre, ou elle
 * administre l'activité pour une séquence sans périmètre. Une période archivée
 * est en lecture seule.
 */
export async function peutEcrireSequence(
  ctx: AppContext,
  s: { editionId: string; activiteId: string; perimetreId: string | null }
): Promise<boolean> {
  if (s.perimetreId !== null) {
    return peutModifierPerimetre(ctx, s.perimetreId, s.editionId)
  }
  const edition = await ctx.exigerEdition(s.editionId)
  return edition.statut !== 'ARCHIVEE' && (await ctx.estAdminDe(s.activiteId))
}

/** Une séquence dure 24 heures au plus. */
export function dureeValide(debut: Date, fin: Date): void {
  if (fin.getTime() - debut.getTime() > SEQUENCE_DUREE_MAX_MS) {
    throw erreurSaisie(i18n._('Une séquence dure 24 heures au plus.'))
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
    throw erreurSaisie(
      i18n._('Une séquence compte {max} places au plus.', { max: PLACES_MAX })
    )
  }
  const valides: PlaceValide[] = []
  const vues = new Set<string>()
  for (const place of liste) {
    const userId = place.personneId ? String(place.personneId) : null
    const benevoleId = place.benevoleId ? String(place.benevoleId) : null
    if ((userId === null) === (benevoleId === null)) {
      throw erreurSaisie(
        i18n._(
          'Une place désigne une personne de l’équipe ou une fiche bénévole.'
        )
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
            AND: [
              dansLEquipeQuiVoit([activiteId]),
              membreActif(organisationId),
            ],
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
