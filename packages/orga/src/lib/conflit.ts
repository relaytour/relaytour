import { CombinedGraphQLErrors } from '@apollo/client/errors'

import type { StatutTache } from '../gql/graphql'

// Conflit d'écriture sur une tâche, une fiche ou un périmètre. Le serveur refuse
// d'écraser ce qu'une autre personne a écrit depuis la lecture (code
// `CONFLIT_VERSION`), et dit l'état actuel : la version et l'auteur d'une
// modification du contenu, ou le nouveau statut d'une tâche. Il ne nomme jamais la
// personne qui a changé un statut.

const LIBELLES: Record<StatutTache, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  FAITE: 'Faite',
  ABANDONNEE: 'Abandonnée',
}

export type Conflit =
  | {
      nature: 'contenu'
      /** Un compteur pour une tâche ou un périmètre, un identifiant pour une fiche. */
      versionCourante: number | string
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
  if (
    typeof details.versionCourante !== 'number' &&
    typeof details.versionCourante !== 'string'
  ) {
    return null
  }
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

/** « le 4 octobre à 14 h 05 », précédé d'une espace, ou rien sans date. */
const momentDuConflit = (
  conflit: Extract<Conflit, { nature: 'contenu' }>,
  fuseau?: string
): string =>
  conflit.modifieeLe === null ? '' : ` ${momentDe(conflit.modifieeLe, fuseau)}`

/**
 * Le titre et le texte de la fenêtre qui annonce un conflit sur une tâche ou sur un
 * périmètre. « Écraser » rejoue l'action avec l'état annoncé, « Recharger » affiche
 * cet état.
 */
export function texteConflit(
  conflit: Conflit,
  options: { objet?: 'tache' | 'perimetre'; fuseau?: string } = {}
): { titre: string; texte: string } {
  if (conflit.nature === 'statut') {
    return {
      titre: 'Le statut de cette tâche a changé',
      texte: `Cette tâche est maintenant « ${LIBELLES[conflit.statutCourant]} ». « Écraser » applique quand même votre changement. « Recharger » affiche son état actuel.`,
    }
  }
  const moment = momentDuConflit(conflit, options.fuseau)
  if (options.objet === 'perimetre') {
    // Un réglage n'a pas de journal, et un import du contenu le modifie aussi : la
    // phrase ne suppose aucune personne.
    return {
      titre: 'Ce périmètre a changé depuis votre lecture',
      texte: `Ce périmètre a été modifié${moment}. « Écraser » enregistre votre réglage à la place du réglage actuel. « Recharger » abandonne votre saisie et affiche le réglage actuel.`,
    }
  }
  const auteur = conflit.modifieePar ?? 'Une autre personne'
  return {
    titre: 'Cette tâche a changé depuis votre lecture',
    texte: `${auteur} a modifié cette tâche${moment}. « Écraser » enregistre votre version à la place de la sienne. « Recharger » abandonne votre saisie et affiche la sienne.`,
  }
}

/**
 * La phrase qui annonce, dans l'éditeur, qu'une autre version de la fiche existe.
 * Une version importée du contenu n'a pas d'auteur : la phrase ne suppose alors
 * aucune personne.
 */
export function annonceConflitFiche(
  conflit: Extract<Conflit, { nature: 'contenu' }>,
  fuseau?: string
): string {
  const moment = momentDuConflit(conflit, fuseau)
  return conflit.modifieePar === null
    ? `Une autre version de cette fiche a été enregistrée${moment}.`
    : `${conflit.modifieePar} a enregistré une autre version de cette fiche${moment}.`
}
