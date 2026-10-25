import type { ApolloClient } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { i18n, type MessageDescriptor } from '@lingui/core'
import { msg, t } from '@lingui/core/macro'

import type { StatutTache } from '../gql/graphql'

import { relireLesVues } from './rafraichissement'
import { langueActive } from './langue'

// Conflit d'écriture sur une tâche, une fiche ou un périmètre. Le serveur refuse
// d'écraser ce qu'une autre personne a écrit depuis la lecture (code
// `CONFLIT_VERSION`), et dit l'état actuel : la version et l'auteur d'une
// modification du contenu, ou le nouveau statut d'une tâche. Il ne nomme jamais la
// personne qui a changé un statut.

const LIBELLES: Record<StatutTache, MessageDescriptor> = {
  A_FAIRE: msg({ message: 'À faire', comment: 'Statut d’une tâche' }),
  EN_COURS: msg({ message: 'En cours', comment: 'Statut d’une tâche' }),
  FAITE: msg({ message: 'Faite', comment: 'Statut d’une tâche' }),
  ABANDONNEE: msg({ message: 'Abandonnée', comment: 'Statut d’une tâche' }),
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
  const jour = instant.toLocaleDateString(langueActive(), {
    day: 'numeric',
    month: 'long',
    timeZone: fuseau,
  })
  const [heures, minutes] = instant
    .toLocaleTimeString(langueActive(), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: fuseau,
    })
    .split(':')
  const heure = Number(heures)
  const minute = minutes ?? ''
  return t`le ${jour} à ${heure} h ${minute}`
}

/** « le 4 octobre à 14 h 05 », ou null sans date. */
const momentDuConflit = (
  conflit: Extract<Conflit, { nature: 'contenu' }>,
  fuseau?: string
): string | null =>
  conflit.modifieeLe === null ? null : momentDe(conflit.modifieeLe, fuseau)

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
    const statutCourant = i18n._(LIBELLES[conflit.statutCourant])
    return {
      titre: t`Le statut de cette tâche a changé`,
      texte: t`Cette tâche est maintenant « ${statutCourant} ». « Écraser » applique quand même votre changement. « Recharger » affiche son état actuel.`,
    }
  }
  const moment = momentDuConflit(conflit, options.fuseau)
  if (options.objet === 'perimetre') {
    // Un réglage n'a pas de journal, et un import du contenu le modifie aussi : la
    // phrase ne suppose aucune personne.
    return {
      titre: t`Ce périmètre a changé depuis votre lecture`,
      texte:
        moment === null
          ? t`Ce périmètre a été modifié. « Écraser » enregistre votre réglage à la place du réglage actuel. « Recharger » abandonne votre saisie et affiche le réglage actuel.`
          : t`Ce périmètre a été modifié ${moment}. « Écraser » enregistre votre réglage à la place du réglage actuel. « Recharger » abandonne votre saisie et affiche le réglage actuel.`,
    }
  }
  const auteur = conflit.modifieePar ?? t`Une autre personne`
  return {
    titre: t`Cette tâche a changé depuis votre lecture`,
    texte:
      moment === null
        ? t`${auteur} a modifié cette tâche. « Écraser » enregistre votre version à la place de la sienne. « Recharger » abandonne votre saisie et affiche la sienne.`
        : t`${auteur} a modifié cette tâche ${moment}. « Écraser » enregistre votre version à la place de la sienne. « Recharger » abandonne votre saisie et affiche la sienne.`,
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
  const auteur = conflit.modifieePar
  if (auteur === null) {
    return moment === null
      ? t`Une autre version de cette fiche a été enregistrée.`
      : t`Une autre version de cette fiche a été enregistrée ${moment}.`
  }
  return moment === null
    ? t`${auteur} a enregistré une autre version de cette fiche.`
    : t`${auteur} a enregistré une autre version de cette fiche ${moment}.`
}

/**
 * Après un conflit de version sur une date clé, une réunion, un sondage ou une
 * séquence : relit les vues qui montrent l'objet, puis ferme la saisie. Une
 * mutation refusée ne lance pas ses `refetchQueries` : sans cette relecture, une
 * nouvelle saisie reprendrait la version dépassée. Si la relecture échoue, la
 * saisie reste à l'écran pour un nouvel essai.
 */
export async function relireApresConflit(
  client: ApolloClient,
  vues: readonly string[],
  signaler: (texte: string) => void,
  textes: { relu: string; echec: string },
  fermer: () => void
): Promise<void> {
  if (await relireLesVues(client, vues)) {
    signaler(textes.relu)
    fermer()
  } else {
    signaler(textes.echec)
  }
}
