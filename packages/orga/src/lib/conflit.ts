import { CombinedGraphQLErrors } from '@apollo/client/errors'

import type { StatutTache } from '../gql/graphql'

// Conflit d'écriture sur une tâche. Le serveur refuse d'écraser ce qu'une autre
// personne a écrit depuis la lecture (code `CONFLIT_VERSION`), et dit l'état actuel :
// la version et l'auteur d'une modification du contenu, ou le nouveau statut. Il ne
// nomme jamais la personne qui a changé un statut.

const LIBELLES: Record<StatutTache, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  FAITE: 'Faite',
  ABANDONNEE: 'Abandonnée',
}

export type Conflit =
  | {
      nature: 'contenu'
      versionCourante: number
      modifieeLe: string | null
      modifieePar: string | null
    }
  | { nature: 'statut'; statutCourant: StatutTache }

/** Le conflit que porte une erreur du serveur, ou null pour toute autre erreur. */
export function lireConflit(erreur: unknown): Conflit | null {
  if (!CombinedGraphQLErrors.is(erreur)) return null
  const details = erreur.errors[0]?.extensions
  if (details?.code !== 'CONFLIT_VERSION') return null
  if (
    typeof details.statutCourant === 'string' &&
    details.statutCourant in LIBELLES
  ) {
    return {
      nature: 'statut',
      statutCourant: details.statutCourant as StatutTache,
    }
  }
  if (typeof details.versionCourante !== 'number') return null
  return {
    nature: 'contenu',
    versionCourante: details.versionCourante,
    modifieeLe:
      typeof details.modifieeLe === 'string' ? details.modifieeLe : null,
    modifieePar:
      typeof details.modifieePar === 'string' ? details.modifieePar : null,
  }
}

/** « le 4 octobre à 14 h 05 », dans le fuseau du navigateur ou dans `fuseau`. */
function momentDe(iso: string, fuseau?: string): string {
  const instant = new Date(iso)
  const jour = instant.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: fuseau,
  })
  const [heures, minutes] = instant
    .toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: fuseau,
    })
    .split(':')
  return `le ${jour} à ${Number(heures)} h ${minutes}`
}

/**
 * Le titre et le texte de la fenêtre qui annonce un conflit. « Écraser » rejoue
 * l'action avec l'état annoncé, « Recharger » affiche cet état.
 */
export function texteConflit(
  conflit: Conflit,
  fuseau?: string
): { titre: string; texte: string } {
  if (conflit.nature === 'statut') {
    return {
      titre: 'Le statut de cette tâche a changé',
      texte: `Cette tâche est maintenant « ${LIBELLES[conflit.statutCourant]} ». « Écraser » applique quand même votre changement. « Recharger » affiche son état actuel.`,
    }
  }
  const auteur = conflit.modifieePar ?? 'Une autre personne'
  const moment =
    conflit.modifieeLe === null
      ? ''
      : ` ${momentDe(conflit.modifieeLe, fuseau)}`
  return {
    titre: 'Cette tâche a changé depuis votre lecture',
    texte: `${auteur} a modifié cette tâche${moment}. « Écraser » enregistre votre version à la place de la sienne. « Recharger » abandonne votre saisie et affiche la sienne.`,
  }
}
