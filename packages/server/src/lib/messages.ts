import { erreurSaisie } from './erreurs.ts'

// Messages écrits dans l'application et envoyés depuis la messagerie de leur auteur
// (ADR 0020). Le serveur n'envoie rien : il garde ce que l'admin a préparé.

/** Longueur maximale de l'objet d'un message. */
export const OBJET_MAX = 200
/** Longueur maximale du texte d'un message. */
export const CORPS_MAX = 10_000
/** Nombre maximal de destinataires d'un message. */
export const DESTINATAIRES_MAX = 500
/** Nombre de messages rendus par une lecture de l'historique, les plus récents. */
export const MESSAGES_LUS_MAX = 200

const MODELE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** La clé d'un modèle : des minuscules, des chiffres et des tirets. */
export function modeleValide(brut: string): string {
  const modele = brut.trim()
  if (!MODELE.test(modele) || modele.length > 60) {
    throw erreurSaisie('Le modèle du message n’est pas reconnu.')
  }
  return modele
}

/** Les identifiants des destinataires, sans doublon et dans les bornes. */
export function destinatairesValides(bruts: readonly (string | number)[]) {
  const ids = [...new Set(bruts.map(String))]
  if (ids.length === 0) {
    throw erreurSaisie('Choisissez au moins une personne.')
  }
  if (ids.length > DESTINATAIRES_MAX) {
    throw erreurSaisie(
      `Un message compte ${DESTINATAIRES_MAX} destinataires au plus.`
    )
  }
  return ids
}
