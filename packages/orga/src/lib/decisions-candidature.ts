import type { ApolloClient } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { i18n, type MessageDescriptor } from '@lingui/core'
import { msg, t } from '@lingui/core/macro'

import type { StatutChoix } from '../gql/graphql'

import { messageErreur } from './erreurs'
import { relireLesVues } from './rafraichissement'

// Garde d'état des décisions de candidature (ADR 0070). L'espace organisateur
// envoie le statut affiché d'un choix à chaque acceptation. Le serveur refuse
// d'accepter un choix dont le statut a changé depuis la lecture (code
// `CONFLIT_VERSION`) et dit son statut courant, sans nommer la personne qui l'a
// changé.

export const STATUTS_CHOIX: Record<
  StatutChoix,
  { libelle: MessageDescriptor; couleur: string }
> = {
  EN_ATTENTE: {
    libelle: msg({
      message: 'En attente',
      comment: 'Statut du choix de séquence d’une candidature de bénévole',
    }),
    couleur: 'processing',
  },
  LISTE_ATTENTE: {
    libelle: msg({
      message: 'Liste d’attente',
      comment: 'Statut du choix de séquence d’une candidature de bénévole',
    }),
    couleur: 'warning',
  },
  ACCEPTE: {
    libelle: msg({
      message: 'Acceptée',
      comment: 'Statut du choix de séquence d’une candidature de bénévole',
    }),
    couleur: 'success',
  },
  REFUSE: {
    libelle: msg({
      message: 'Refusée',
      comment: 'Statut du choix de séquence d’une candidature de bénévole',
    }),
    couleur: 'default',
  },
}

/** Les vues qui montrent une candidature, une place ou un besoin de renforts. */
export const VUES_CANDIDATURES = [
  'Candidatures',
  'Benevoles',
  'Programme',
  'BenevolesARepartir',
  'CouvertureProgramme',
  'AppelsBenevoles',
]

/**
 * Le statut courant que porte un conflit sur un choix, ou `undefined` pour toute
 * autre erreur. Null : la candidature n'a pas choisi la séquence.
 */
export function lireConflitChoix(
  erreur: unknown
): { statutCourant: StatutChoix | null } | undefined {
  if (!CombinedGraphQLErrors.is(erreur)) return undefined
  const details = erreur.errors[0]?.extensions
  if (details?.code !== 'CONFLIT_VERSION') return undefined
  const statut = details.statutCourant
  if (statut === null) return { statutCourant: null }
  if (typeof statut === 'string' && statut in STATUTS_CHOIX) {
    return { statutCourant: statut as StatutChoix }
  }
  return undefined
}

/** Le titre et le texte de la fenêtre qui annonce un conflit sur un choix. */
export function texteConflitChoix(statutCourant: StatutChoix | null): {
  titre: string
  texte: string
} {
  if (statutCourant === null) {
    return {
      titre: t`Le choix de cette séquence a changé`,
      texte: t`La personne n’a pas choisi cette séquence. « Accepter quand même » la place sur cette séquence. « Recharger » affiche son état actuel.`,
    }
  }
  const statut = i18n._(STATUTS_CHOIX[statutCourant].libelle)
  return {
    titre: t`Le statut de ce choix a changé`,
    texte: t`Ce choix est maintenant « ${statut} ». « Accepter quand même » l’accepte, et la personne peut recevoir un mail. « Recharger » affiche son état actuel.`,
  }
}

interface Outils {
  client: ApolloClient
  confirmer: (options: {
    title: string
    content: string
    okText: string
    cancelText: string
  }) => Promise<boolean>
  signalerErreur: (texte: string) => void
}

/**
 * Accepte avec le statut lu. Après un conflit, la fenêtre propose d'accepter quand
 * même, avec le statut courant, ou de recharger les vues. Rend vrai quand
 * l'acceptation est écrite.
 */
export async function accepterAvecStatutLu(
  executer: (statutAttendu: StatutChoix | null) => Promise<unknown>,
  statutLu: StatutChoix | null,
  outils: Outils
): Promise<boolean> {
  const recharger = async () => {
    if (!(await relireLesVues(outils.client, VUES_CANDIDATURES))) {
      outils.signalerErreur(
        t`La candidature n’a pas pu être rechargée. Réessayez dans un instant.`
      )
    }
  }
  let statutAttendu = statutLu
  // Deux essais au plus : après « Accepter quand même », un statut qui change
  // encore recharge les vues sans rouvrir la fenêtre.
  for (let essai = 0; ; essai++) {
    try {
      await executer(statutAttendu)
      return true
    } catch (erreur) {
      const conflit = lireConflitChoix(erreur)
      if (conflit === undefined) {
        outils.signalerErreur(messageErreur(erreur))
        return false
      }
      if (essai > 0) {
        outils.signalerErreur(
          t`Ce choix a encore changé. La candidature est rechargée : décidez sur son état actuel.`
        )
        await recharger()
        return false
      }
      const { titre, texte } = texteConflitChoix(conflit.statutCourant)
      const quandMeme = await outils.confirmer({
        title: titre,
        content: texte,
        okText: t`Accepter quand même`,
        cancelText: t`Recharger`,
      })
      if (!quandMeme) {
        await recharger()
        return false
      }
      statutAttendu = conflit.statutCourant
    }
  }
}
