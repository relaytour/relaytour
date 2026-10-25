import { t } from '@lingui/core/macro'

import { envoyerDepot, ErreurDepot } from './depot-contenu'

// Dépôt direct de fiches depuis l'écran « Ressources » (ADR 0049). Les fichiers
// partent en JSON, leur contenu en base64 : le serveur convertit les documents
// Word et applique les règles de l'import depuis l'espace de fichiers.

export const ROUTE_DEPOT_FICHES = '/medias/fiches/depot'

export const FORMATS_FICHES = '.md,.markdown,.txt,.docx'

/** Taille totale d'un dépôt, vérifiée aussi par le serveur. */
export const TAILLE_MAX_DEPOT = 20 * 1024 * 1024

export interface FichierEcarte {
  fichier: string
  raison: string
}

export interface RapportDepotFiches {
  creees: string[]
  nouvellesVersions: string[]
  inchangees: string[]
  conflits: { fiche: string; raison: string }[]
  nonImportes: FichierEcarte[]
  refusees: FichierEcarte[]
  converties: FichierEcarte[]
}

/** Le contenu d'un fichier en base64, sans l'en-tête d'une adresse data:. */
function enBase64(fichier: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader()
    lecteur.onload = () =>
      resoudre(String(lecteur.result).replace(/^data:[^,]*,/, ''))
    lecteur.onerror = () => rejeter(new Error(lecteur.error?.message))
    lecteur.readAsDataURL(fichier)
  })
}

export async function deposerFiches(
  fichiers: readonly File[],
  options: {
    activiteId: string
    /** Null : les fiches communes de l'activité. */
    perimetreId: string | null
    simulation: boolean
  }
): Promise<RapportDepotFiches> {
  if (fichiers.reduce((n, f) => n + f.size, 0) > TAILLE_MAX_DEPOT) {
    throw new ErreurDepot(t`Les fichiers déposés dépassent 20 Mo au total.`)
  }
  const parametres = new URLSearchParams({ activite: options.activiteId })
  if (options.perimetreId !== null)
    parametres.set('perimetre', options.perimetreId)
  if (options.simulation) parametres.set('simulation', '1')
  const corps = JSON.stringify({
    fichiers: await Promise.all(
      fichiers.map(async f => ({ nom: f.name, donnees: await enBase64(f) }))
    ),
  })
  return envoyerDepot<RapportDepotFiches>(
    `${ROUTE_DEPOT_FICHES}?${parametres.toString()}`,
    corps,
    'application/json'
  )
}
