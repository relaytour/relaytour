import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { useApolloClient } from '@apollo/client/react'
import { plural, t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { App } from 'antd'

import { graphql } from '../gql'
import type { StatutTache } from '../gql/graphql'

import { lireConflit, texteConflit } from './conflit'
import { messageErreur } from './erreurs'
import { relireLesVues, VUES_TACHES } from './rafraichissement'

/** Longueur maximale d'un titre de tâche ou de fiche, celle de sa colonne en base. */
export const TITRE_MAX = 191

// Le libellé se lit à l'affichage : il suit la langue active.
export const STATUTS: Record<
  StatutTache,
  { readonly libelle: string; couleur: string }
> = {
  A_FAIRE: {
    get libelle() {
      return t({ message: 'À faire', comment: 'Statut d’une tâche' })
    },
    couleur: 'default',
  },
  EN_COURS: {
    get libelle() {
      return t({ message: 'En cours', comment: 'Statut d’une tâche' })
    },
    couleur: 'blue',
  },
  FAITE: {
    get libelle() {
      return t({ message: 'Faite', comment: 'Statut d’une tâche' })
    },
    couleur: 'green',
  },
  ABANDONNEE: {
    get libelle() {
      return t({ message: 'Abandonnée', comment: 'Statut d’une tâche' })
    },
    couleur: 'default',
  },
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

export { VUES_TACHES }

export const TACHE_CHAMPS = graphql(`
  fragment TacheChamps on Tache {
    id
    titre
    description
    echeance
    statut
    version
    enRetard
    termineeLe
    peutModifier
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
    realisateurs {
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

// Le serveur borne le nombre de champs d'une requête, et « Mon espace » lit ce
// fragment deux fois : il ne porte donc rien des tâches partagées (ADR 0026). La
// page d'un périmètre lit en plus l'origine et le résumé des déclinaisons.

// Les tâches que d'autres périmètres proposent à celui-ci, en attente de son accord.
export const DECLINAISONS_PROPOSEES = graphql(`
  query DeclinaisonsProposees($slug: String!, $editionId: ID!) {
    perimetre(slug: $slug) {
      id
      declinaisonsProposees(editionId: $editionId) {
        id
        titre
        description
        echeance
        origine {
          id
          perimetre {
            slug
            nom
            couleur
          }
        }
      }
    }
  }
`)

// Les déclinaisons d'une tâche partagée, avec l'accord de chaque périmètre. Les
// admins de l'activité y lisent aussi l'historique de cet accord.
export const DECLINAISONS_TACHE = graphql(`
  query DeclinaisonsTache($id: ID!) {
    tache(id: $id) {
      id
      declinaisons {
        id
        titre
        echeance
        statut
        enRetard
        accord
        perimetre {
          id
          slug
          nom
          couleur
        }
        historiqueAccord {
          etape
          le
          par {
            id
            nom
          }
        }
      }
    }
  }
`)

export const DECLINER_TACHE = graphql(`
  mutation DeclinerTache(
    $id: ID!
    $perimetreIds: [ID!]!
    $titre: String
    $description: String
    $echeance: Date
  ) {
    declinerTache(
      id: $id
      perimetreIds: $perimetreIds
      titre: $titre
      description: $description
      echeance: $echeance
    ) {
      ...TacheChamps
    }
  }
`)

export const ACCORDER_DECLINAISON = graphql(`
  mutation AccorderDeclinaison($id: ID!, $accepter: Boolean!) {
    accorderDeclinaison(id: $id, accepter: $accepter) {
      id
      accord
    }
  }
`)

export const IMPOSER_DECLINAISON = graphql(`
  mutation ImposerDeclinaison($id: ID!) {
    imposerDeclinaison(id: $id) {
      id
      accord
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
    $declinaison: DeclinaisonInput
  ) {
    creerTache(
      perimetreId: $perimetreId
      editionId: $editionId
      titre: $titre
      description: $description
      echeance: $echeance
      ficheId: $ficheId
      mAssigner: $mAssigner
      declinaison: $declinaison
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
    $versionAttendue: Int
    $confirmer: Boolean
  ) {
    modifierTache(
      id: $id
      titre: $titre
      description: $description
      echeance: $echeance
      ficheId: $ficheId
      versionAttendue: $versionAttendue
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
    $realisateurs: [ID!]
    $statutAttendu: StatutTache
    $confirmer: Boolean
  ) {
    changerStatutTache(
      id: $id
      statut: $statut
      realisateurs: $realisateurs
      statutAttendu: $statutAttendu
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

/** Ce que l'action rejoue après une réponse de la personne. */
export interface Reprise {
  /** La personne accepte de modifier la tâche d'une autre personne. */
  confirmer: boolean
  /** Après un conflit de contenu : la version que le serveur vient d'annoncer. */
  versionAttendue?: number
  /** Après un conflit de statut : le statut que le serveur vient d'annoncer. */
  statutAttendu?: StatutTache
}

/**
 * Exécute une action sur une tâche, et la rejoue selon la réponse de la personne.
 *
 * Si l'API demande une confirmation (tâche assignée à d'autres personnes), une
 * fenêtre nomme ces personnes, puis l'action est rejouée avec `confirmer: true`.
 *
 * Si l'API annonce un conflit (une autre personne a écrit depuis la lecture), une
 * fenêtre dit ce qui a changé. « Écraser » rejoue l'action avec l'état annoncé.
 * « Recharger » relit les vues des tâches, puis appelle `apresRechargement` si la
 * relecture a réussi.
 */
export function useActionTache() {
  const { message, modal } = App.useApp()
  const { t } = useLingui()
  const client = useApolloClient()

  return async function executer(
    action: (reprise: Reprise) => Promise<unknown>,
    succes?: string,
    options: { apresRechargement?: () => void } = {}
  ): Promise<boolean> {
    const reprise: Reprise = { confirmer: false }
    // Une confirmation, puis un conflit par écriture simultanée : la boucle s'arrête
    // si les réponses du serveur se répètent.
    for (let essai = 0; essai < 6; essai++) {
      try {
        await action({ ...reprise })
        if (succes) message.success(succes)
        return true
      } catch (erreur) {
        const premiere = CombinedGraphQLErrors.is(erreur)
          ? erreur.errors[0]
          : undefined
        const conflit = lireConflit(erreur)
        if (conflit !== null) {
          const { titre, texte } = texteConflit(conflit)
          const ecraser = await modal.confirm({
            title: titre,
            content: texte,
            okText: t`Écraser`,
            cancelText: t`Recharger`,
          })
          if (!ecraser) {
            // La saisie ne se ferme qu'après une relecture réussie : sans réponse
            // du serveur, la personne garde son texte et peut réessayer.
            if (await relireLesVues(client, VUES_TACHES)) {
              options.apresRechargement?.()
            } else {
              message.error(
                t`La tâche n’a pas pu être rechargée. Votre saisie reste à l’écran : réessayez dans un instant.`
              )
            }
            return false
          }
          if (conflit.nature === 'statut') {
            reprise.statutAttendu = conflit.statutCourant
          } else if (typeof conflit.versionCourante === 'number') {
            reprise.versionAttendue = conflit.versionCourante
          }
          continue
        }
        if (
          premiere?.extensions?.code !== 'CONFIRMATION_REQUISE' ||
          reprise.confirmer
        ) {
          message.error(messageErreur(erreur))
          return false
        }
        const personnes =
          (premiere.extensions.personnes as string[] | undefined) ?? []
        const nomsDesPersonnes = personnes.join(', ')
        const nombreDePersonnes = personnes.length
        const confirme = await modal.confirm({
          title: t`Cette tâche est assignée à d’autres personnes`,
          content: t`${plural(nombreDePersonnes, {
            one: `${nomsDesPersonnes} recevra un mail pour les prévenir de votre modification.`,
            other: `${nomsDesPersonnes} recevront un mail pour les prévenir de votre modification.`,
          })}`,
          okText: t`Confirmer`,
          cancelText: t`Annuler`,
        })
        if (!confirme) return false
        reprise.confirmer = true
      }
    }
    message.error(t`L’opération a échoué. Rechargez la page, puis réessayez.`)
    return false
  }
}
