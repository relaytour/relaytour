import { createHash, timingSafeEqual } from 'node:crypto'

// Jeton d'administration de l'installation (ADR 0008).
// La comparaison hache les deux valeurs avant timingSafeEqual : sa durée ne dépend ni
// du contenu ni de la longueur du jeton attendu.

const empreinte = (valeur: string) =>
  createHash('sha256').update(valeur).digest()

/** Vrai si le jeton présenté est le jeton attendu. Faux si aucun jeton n'est configuré. */
export function jetonValide(
  presente: string,
  attendu: string | undefined
): boolean {
  if (attendu === undefined || attendu.length === 0 || presente.length === 0) {
    return false
  }
  return timingSafeEqual(empreinte(presente), empreinte(attendu))
}
