import { env } from '../env.ts'

// Refus des applications tierces par l'administration de l'installation (ADR 0067).
//
// `APPLICATIONS_TIERCES` ouvre, limite ou ferme la fonction. `APPLICATIONS_REFUSEES`
// refuse des applications par leur identifiant ou par l'hôte de cet identifiant,
// quel que soit le mode. Un refus vaut dès la requête suivante : les jetons d'une
// application refusée cessent de répondre.

export interface ReglageApplications {
  mode: 'ouvertes' | 'liste' | 'fermees'
  liste: readonly string[]
  refusees: readonly string[]
}

const reglageDeLEnvironnement = (): ReglageApplications => ({
  mode: env.APPLICATIONS_TIERCES,
  liste: env.APPLICATIONS_LISTE,
  refusees: env.APPLICATIONS_REFUSEES,
})

/** Vrai quand l'installation sert les points /oauth/* et leurs métadonnées. */
export function applicationsOuvertes(
  r: ReglageApplications = reglageDeLEnvironnement()
): boolean {
  return r.mode !== 'fermees'
}

function hoteDe(clientId: string): string | null {
  try {
    return new URL(clientId).host.toLowerCase()
  } catch {
    return null
  }
}

/** Vrai quand l'installation refuse cette application. */
export function applicationRefusee(
  clientId: string,
  r: ReglageApplications = reglageDeLEnvironnement()
): boolean {
  if (r.mode === 'fermees') return true
  const hote = hoteDe(clientId)
  const refusee = r.refusees.some(
    v => v === clientId || (hote !== null && v.toLowerCase() === hote)
  )
  if (refusee) return true
  return r.mode === 'liste' && !r.liste.includes(clientId)
}
