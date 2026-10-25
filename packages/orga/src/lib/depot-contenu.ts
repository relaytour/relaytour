import { t } from '@lingui/core/macro'

import { activiteAffichee, organisationChoisie } from './selection'

// Dépôt d'un dossier de contenu (ADR 0049). L'archive dépasse la borne d'une
// requête GraphQL : elle part en corps brut vers sa propre route, avec les mêmes
// en-têtes d'organisation et d'activité que les autres requêtes.

export const ROUTE_DEPOT_CONTENU = '/medias/contenu/depot'

/** Taille maximale d'une archive, vérifiée aussi par le serveur. */
export const TAILLE_MAX_ARCHIVE = 20 * 1024 * 1024

export interface RapportActiviteDepot {
  slug: string
  etat: 'creee' | 'mise-a-jour'
  perimetres: { crees: string[]; modifies: string[]; absentsDuDepot: string[] }
  fiches: {
    creees: string[]
    nouvellesVersions: string[]
    inchangees: string[]
    conflits: string[]
  }
}

export interface RapportDepot {
  organisation: { slug: string; etat: 'creee' | 'mise-a-jour' }
  medias: { enregistrees: string[]; dejaPresentes: string[] }
  /** Date ISO de la dernière modification faite dans l'application, ou null. */
  modifieDansApplication: string | null
  activites: RapportActiviteDepot[]
  activitesAbsentesDuDepot: string[]
  amorcageRetire: boolean
  slugIgnore: string | null
  fichiersIgnores: string[]
}

export class ErreurDepot extends Error {
  constructor(
    message: string,
    readonly erreurs: string[] = [],
    readonly code = 'SAISIE_INVALIDE'
  ) {
    super(message)
  }
}

export async function deposerContenu(
  fichier: Blob,
  options: { activiteId: string | null; simulation: boolean; forcer: boolean }
): Promise<RapportDepot> {
  if (fichier.size > TAILLE_MAX_ARCHIVE) {
    throw new ErreurDepot(t`L’archive dépasse 20 Mo.`)
  }
  const parametres = new URLSearchParams()
  if (options.activiteId !== null)
    parametres.set('activite', options.activiteId)
  if (options.simulation) parametres.set('simulation', '1')
  if (options.forcer) parametres.set('forcer', '1')
  return envoyerDepot<RapportDepot>(
    `${ROUTE_DEPOT_CONTENU}?${parametres.toString()}`,
    fichier,
    'application/zip'
  )
}

/**
 * Envoie un dépôt à sa route, avec les en-têtes d'organisation et d'activité. Un
 * refus du serveur devient une ErreurDepot avec son message et ses erreurs.
 */
export async function envoyerDepot<T>(
  adresse: string,
  corps: BodyInit,
  type: string
): Promise<T> {
  const organisation = organisationChoisie()
  const activite = activiteAffichee()
  let reponse: Response
  try {
    reponse = await fetch(adresse, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': type,
        ...(organisation === null
          ? {}
          : { 'X-Relaytour-Organisation': organisation }),
        ...(activite === null ? {} : { 'X-Relaytour-Activite': activite }),
      },
      body: corps,
    })
  } catch {
    throw new ErreurDepot(t`Le serveur ne répond pas. Réessayez plus tard.`)
  }
  const lu = (await reponse.json().catch(() => null)) as unknown
  if (reponse.ok && lu !== null) return lu as T
  const refus = (lu ?? {}) as {
    code?: string
    message?: string
    erreurs?: string[]
  }
  throw new ErreurDepot(
    refus.message ?? t`Le dépôt a échoué.`,
    refus.erreurs ?? [],
    refus.code
  )
}
