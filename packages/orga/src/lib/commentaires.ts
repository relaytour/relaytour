import { useQuery } from '@apollo/client/react'

import { graphql } from '../gql'
import type {
  CommentairesDeLaPeriodeQuery,
  FilTacheQuery,
  StatutTache,
} from '../gql/graphql'

// Commentaires d'une tâche (ADR 0029).
//
// Le fil d'une tâche se lit à part, à l'ouverture de son volet : une liste de tâches
// ne le porte pas. Le nombre de commentaires se lit aussi à part, une fois par
// période, et chaque carte y cherche le sien.

/** Longueur maximale d'un commentaire, comme sur le serveur. */
export const COMMENTAIRE_MAX = 4000

export const FIL_CHAMPS = graphql(`
  fragment FilChamps on FilTache {
    tacheId
    nombreCommentaires
    peutCommenter
    commentaires {
      id
      texte
      creeLe
      modifieLe
      peutModifier
      peutSupprimer
      auteur {
        id
        nom
      }
    }
    evenements {
      id
      type
      le
      statut
      acteur {
        id
        nom
      }
      personne {
        id
        nom
      }
    }
  }
`)

export const FIL_TACHE = graphql(`
  query FilTache($id: ID!) {
    filTache(id: $id) {
      ...FilChamps
    }
  }
`)

export const COMMENTAIRES_DE_LA_PERIODE = graphql(`
  query CommentairesDeLaPeriode($editionId: ID!) {
    commentairesDeLaPeriode(editionId: $editionId) {
      perimetresLus
      nombres {
        tacheId
        nombre
      }
    }
  }
`)

export const COMMENTER_TACHE = graphql(`
  mutation CommenterTache($id: ID!, $texte: String!) {
    commenterTache(id: $id, texte: $texte) {
      ...FilChamps
    }
  }
`)

export const MODIFIER_COMMENTAIRE = graphql(`
  mutation ModifierCommentaire($id: ID!, $texte: String!) {
    modifierCommentaire(id: $id, texte: $texte) {
      ...FilChamps
    }
  }
`)

export const SUPPRIMER_COMMENTAIRE = graphql(`
  mutation SupprimerCommentaire($id: ID!) {
    supprimerCommentaire(id: $id) {
      ...FilChamps
    }
  }
`)

export type Fil = FilTacheQuery['filTache']
export type Commentaire = Fil['commentaires'][number]
export type Evenement = Fil['evenements'][number]

/** Un élément du fil : un commentaire ou un événement du journal. */
export type ElementDuFil =
  | { sorte: 'commentaire'; le: string; commentaire: Commentaire }
  | { sorte: 'evenement'; le: string; evenement: Evenement }

/**
 * Le fil, du plus ancien au plus récent. À la même date, un événement précède un
 * commentaire : une tâche est créée avant d'être commentée.
 */
export function composerFil(
  fil: Pick<Fil, 'commentaires' | 'evenements'>,
  avecEvenements = true
): ElementDuFil[] {
  const elements: ElementDuFil[] = [
    ...(avecEvenements
      ? fil.evenements.map((evenement): ElementDuFil => ({
          sorte: 'evenement',
          le: evenement.le,
          evenement,
        }))
      : []),
    ...fil.commentaires.map((commentaire): ElementDuFil => ({
      sorte: 'commentaire',
      le: commentaire.creeLe,
      commentaire,
    })),
  ]
  // Le tri est stable : deux éléments de même date gardent l'ordre ci-dessus.
  return elements.sort(
    (a, b) => new Date(a.le).getTime() - new Date(b.le).getTime()
  )
}

const STATUT_VOUS: Record<StatutTache, string> = {
  A_FAIRE: 'Vous avez remis la tâche à faire.',
  EN_COURS: 'Vous avez commencé la tâche.',
  FAITE: 'Vous avez marqué la tâche comme faite.',
  ABANDONNEE: 'Vous avez abandonné la tâche.',
}
const STATUT_AUTRE: Record<StatutTache, string> = {
  A_FAIRE: 'a remis la tâche à faire.',
  EN_COURS: 'a commencé la tâche.',
  FAITE: 'a marqué la tâche comme faite.',
  ABANDONNEE: 'a abandonné la tâche.',
}

/** La phrase d'un événement du fil, pour la personne qui le lit. */
export function texteEvenement(e: Evenement, moiId: string): string {
  const moi = e.acteur?.id === moiId
  const acteur = e.acteur?.nom ?? 'Une personne'
  const cible = e.personne?.id === moiId ? 'vous' : e.personne?.nom
  // La personne s'est assignée ou retirée elle-même.
  const soi = e.personne !== null && e.personne?.id === e.acteur?.id
  switch (e.type) {
    case 'CREEE':
      return moi ? 'Vous avez créé la tâche.' : `${acteur} a créé la tâche.`
    case 'MODIFIEE':
      return moi
        ? 'Vous avez modifié la tâche.'
        : `${acteur} a modifié la tâche.`
    case 'ASSIGNEE':
      if (soi || !cible)
        return moi
          ? 'Vous vous occupez de la tâche.'
          : `${acteur} s’occupe de la tâche.`
      return moi
        ? `Vous avez assigné la tâche à ${cible}.`
        : `${acteur} ${cible === 'vous' ? 'vous a assigné la tâche' : `a assigné la tâche à ${cible}`}.`
    case 'RETIREE':
      if (soi || !cible)
        return moi
          ? 'Vous ne vous occupez plus de la tâche.'
          : `${acteur} ne s’occupe plus de la tâche.`
      return moi
        ? `Vous avez retiré ${cible} de la tâche.`
        : `${acteur} ${cible === 'vous' ? 'vous a retiré·e de la tâche' : `a retiré ${cible} de la tâche`}.`
    case 'STATUT': {
      if (!e.statut) return `${acteur} a changé le statut de la tâche.`
      if (moi) return STATUT_VOUS[e.statut]
      // Qui a coché une tâche reste réservé : le serveur ne nomme alors personne.
      if (e.acteur === null && e.statut === 'FAITE')
        return 'La tâche est faite.'
      return `${acteur} ${STATUT_AUTRE[e.statut]}`
    }
  }
}

/** Le jour et l'heure d'un instant, dans le fuseau du navigateur. */
export function instantDuFil(iso: string, fuseau?: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fuseau,
  })
}

interface CommentairesPeriode {
  /** Les périmètres dont la personne lit les fils. */
  lus: ReadonlySet<string>
  /** Le nombre de commentaires par tâche commentée. */
  nombres: ReadonlyMap<string, number>
}

const VIDE: CommentairesPeriode = { lus: new Set(), nombres: new Map() }
// Chaque carte lit la même réponse : elle se range une seule fois.
const rangees = new WeakMap<
  CommentairesDeLaPeriodeQuery['commentairesDeLaPeriode'],
  CommentairesPeriode
>()

/**
 * Les commentaires de la période affichée : où la personne lit les fils, et combien
 * de commentaires porte chaque tâche. Sans période, ou avant la réponse, rien n'est
 * lisible : la carte ne propose pas le fil.
 */
export function useCommentairesDeLaPeriode(
  editionId: string | undefined
): CommentairesPeriode {
  const { data } = useQuery(COMMENTAIRES_DE_LA_PERIODE, {
    variables: { editionId: editionId ?? '' },
    skip: !editionId,
  })
  const reponse = data?.commentairesDeLaPeriode
  if (!reponse) return VIDE
  let rangee = rangees.get(reponse)
  if (rangee === undefined) {
    rangee = {
      lus: new Set(reponse.perimetresLus),
      nombres: new Map(reponse.nombres.map(n => [n.tacheId, n.nombre])),
    }
    rangees.set(reponse, rangee)
  }
  return rangee
}
