import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { App } from 'antd'

import { graphql } from '../gql'
import type { StatutTache } from '../gql/graphql'

import { messageErreur } from './erreurs'

export const STATUTS: Record<
  StatutTache,
  { libelle: string; couleur: string }
> = {
  A_FAIRE: { libelle: 'À faire', couleur: 'default' },
  EN_COURS: { libelle: 'En cours', couleur: 'blue' },
  FAITE: { libelle: 'Faite', couleur: 'green' },
  ABANDONNEE: { libelle: 'Abandonnée', couleur: 'default' },
}

/** Classe CSS de la pastille d'état de chaque statut (global.css, `.rt-etat-*`). */
export const CLASSE_STATUT: Record<StatutTache, string> = {
  A_FAIRE: 'rt-etat-a-faire',
  EN_COURS: 'rt-etat-en-cours',
  FAITE: 'rt-etat-faite',
  ABANDONNEE: 'rt-etat-abandonnee',
}

export const estOuverte = (tache: { statut: StatutTache }) =>
  tache.statut === 'A_FAIRE' || tache.statut === 'EN_COURS'

/** Nombre de jours pendant lesquels une échéance ouverte est signalée comme proche. */
export const JOURS_ECHEANCE_PROCHE = 7

/**
 * Situation d'une échéance : en retard (le serveur le calcule), proche (ouverte
 * et due dans les sept jours) ou normale. La date se lit dans le texte, sans
 * décalage de fuseau.
 */
export function etatEcheance(
  tache: { statut: StatutTache; echeance?: string | null; enRetard: boolean },
  aujourdhui = new Date()
): 'retard' | 'proche' | 'normale' {
  if (tache.enRetard) return 'retard'
  if (!tache.echeance || !estOuverte(tache)) return 'normale'
  const [annee, mois, jour] = tache.echeance.slice(0, 10).split('-').map(Number)
  const echeance = new Date(annee ?? 0, (mois ?? 1) - 1, jour ?? 1)
  const debut = new Date(
    aujourdhui.getFullYear(),
    aujourdhui.getMonth(),
    aujourdhui.getDate()
  )
  const jours = Math.round((echeance.getTime() - debut.getTime()) / 86_400_000)
  return jours >= 0 && jours <= JOURS_ECHEANCE_PROCHE ? 'proche' : 'normale'
}

// Les requêtes actives à rafraîchir après une action sur une tâche : les compteurs
// d'avancement et les listes « à prendre » dépendent du statut et des assignations.
export const VUES_TACHES = [
  'PagePerimetre',
  'MesTaches',
  'AvancementGlobal',
  'Retroplanning',
]

export const TACHE_CHAMPS = graphql(`
  fragment TacheChamps on Tache {
    id
    titre
    description
    echeance
    statut
    enRetard
    termineeLe
    perimetre {
      id
      slug
      nom
      couleur
    }
    assignes {
      id
      nom
    }
    clotureePar {
      id
      nom
    }
    realiseePar {
      id
      nom
    }
    fiche {
      id
      slug
      titre
    }
  }
`)

export const CREER_TACHE = graphql(`
  mutation CreerTache(
    $perimetreId: ID!
    $editionId: ID!
    $titre: String!
    $description: String
    $echeance: Date
    $ficheId: ID
    $mAssigner: Boolean
  ) {
    creerTache(
      perimetreId: $perimetreId
      editionId: $editionId
      titre: $titre
      description: $description
      echeance: $echeance
      ficheId: $ficheId
      mAssigner: $mAssigner
    ) {
      ...TacheChamps
    }
  }
`)

export const MODIFIER_TACHE = graphql(`
  mutation ModifierTache(
    $id: ID!
    $titre: String!
    $description: String
    $echeance: Date
    $ficheId: ID
    $confirmer: Boolean
  ) {
    modifierTache(
      id: $id
      titre: $titre
      description: $description
      echeance: $echeance
      ficheId: $ficheId
      confirmer: $confirmer
    ) {
      ...TacheChamps
    }
  }
`)

export const CHANGER_STATUT = graphql(`
  mutation ChangerStatutTache(
    $id: ID!
    $statut: StatutTache!
    $realiseeParId: ID
    $confirmer: Boolean
  ) {
    changerStatutTache(
      id: $id
      statut: $statut
      realiseeParId: $realiseeParId
      confirmer: $confirmer
    ) {
      ...TacheChamps
    }
  }
`)

export const ASSIGNER_TACHE = graphql(`
  mutation AssignerTache($id: ID!, $assigne: Boolean!, $personneId: ID) {
    assignerTache(id: $id, assigne: $assigne, personneId: $personneId) {
      ...TacheChamps
    }
  }
`)

/**
 * Exécute une action sur une tâche. Si l'API demande une confirmation (tâche
 * assignée à d'autres personnes), une fenêtre nomme ces personnes, puis l'action est
 * rejouée avec `confirmer: true`.
 */
export function useActionTache() {
  const { message, modal } = App.useApp()

  return async function executer(
    action: (confirmer: boolean) => Promise<unknown>,
    succes?: string
  ): Promise<boolean> {
    try {
      await action(false)
      if (succes) message.success(succes)
      return true
    } catch (erreur) {
      const premiere = CombinedGraphQLErrors.is(erreur)
        ? erreur.errors[0]
        : undefined
      if (premiere?.extensions?.code !== 'CONFIRMATION_REQUISE') {
        message.error(messageErreur(erreur))
        return false
      }
      const personnes =
        (premiere.extensions.personnes as string[] | undefined) ?? []
      const confirme = await modal.confirm({
        title: 'Cette tâche est assignée à d’autres personnes',
        content: `${personnes.join(', ')} ${
          personnes.length > 1 ? 'recevront' : 'recevra'
        } un mail pour les prévenir de votre modification.`,
        okText: 'Confirmer',
        cancelText: 'Annuler',
      })
      if (!confirme) return false
      try {
        await action(true)
        if (succes) message.success(succes)
        return true
      } catch (e) {
        message.error(messageErreur(e))
        return false
      }
    }
  }
}
