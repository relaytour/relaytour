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

/** Le nom d'hôte d'un identifiant, et l'hôte avec son port s'il en a un. */
function hotesDe(clientId: string): string[] {
  try {
    const u = new URL(clientId)
    return [...new Set([u.hostname, u.host].map(h => h.toLowerCase()))]
  } catch {
    return []
  }
}

/** Vrai quand l'installation refuse cette application. */
export function applicationRefusee(
  clientId: string,
  r: ReglageApplications = reglageDeLEnvironnement()
): boolean {
  if (r.mode === 'fermees') return true
  // Un hôte refusé l'est sur tous ses ports : « exemple.org » refuse aussi
  // « exemple.org:8443 ». Une entrée « hote:port » ne refuse que ce port.
  const hotes = hotesDe(clientId)
  const refusee = r.refusees.some(
    v => v === clientId || hotes.includes(v.toLowerCase())
  )
  if (refusee) return true
  return r.mode === 'liste' && !r.liste.includes(clientId)
}
