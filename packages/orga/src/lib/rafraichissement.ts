import type { ApolloClient, ObservableQuery } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { useApolloClient } from '@apollo/client/react'
import { useEffect } from 'react'

// Rafraîchissement des écrans. Les données d'un écran viennent aussi d'autres
// personnes : les écrans les relisent au retour sur l'onglet, au retour du réseau, et
// chaque minute tant que l'onglet est visible.
//
// La relecture passe par une liste de requêtes, jamais par toutes les requêtes
// actives : les requêtes de session et les écrans de réglage n'y figurent pas.
//
// Une relecture est silencieuse. Elle n'appelle pas `refetch()` sur la requête d'un
// écran : `refetch()` passe `loading` à vrai, et une panne de réseau y pose une
// erreur que l'écran afficherait comme un refus. Elle lit le serveur à côté, et le
// cache met à jour les écrans qui l'observent. Une panne laisse donc l'écran tel
// quel jusqu'au passage suivant.

// Les requêtes actives à rafraîchir après une action sur une tâche : les compteurs
// d'avancement et les listes « à prendre » dépendent du statut et des assignations.
export const VUES_TACHES = [
  'PagePerimetre',
  'MesTaches',
  'AvancementGlobal',
  'Retroplanning',
]

/** Les requêtes relues, désignées par le nom de leur opération GraphQL. */
export const REQUETES_RAFRAICHIES: ReadonlySet<string> = new Set([
  ...VUES_TACHES,
  // Fiches : la liste, la fiche lue, ses tâches liées et les fiches d'un périmètre.
  'ListeFiches',
  'Fiche',
  'TachesFiche',
  'FichesDuPerimetre',
  // Périmètres et équipe.
  'MenuPerimetres',
  'TousLesPerimetres',
  'PostesAPourvoir',
  'Demandes',
  'DemandesEnAttente',
  'SouhaitsEnAttente',
  'MesPropositions',
  // Cloche.
  'NombreNotificationsNonLues',
  'ListeNotifications',
])

/** Délai entre deux relectures périodiques. */
export const INTERVALLE_MS = 60_000
/** Écart minimal entre deux relectures, quelle que soit leur cause. */
export const ECART_MIN_MS = 15_000

/** Vrai quand une relecture peut partir. */
export function peutRafraichir(etat: {
  maintenant: number
  dernier: number
  visible: boolean
  enLigne: boolean
}): boolean {
  return (
    etat.visible &&
    etat.enLigne &&
    etat.maintenant - etat.dernier >= ECART_MIN_MS
  )
}

// Un écran qui porte une saisie longue écarte sa requête de la relecture : l'éditeur
// de fiche garde la version qu'il a chargée. La valeur compte les écrans montés.
const ecartees = new Map<string, number>()

async function relire(
  client: ApolloClient,
  requete: ObservableQuery
): Promise<void> {
  try {
    await client.query({
      query: requete.query,
      variables: requete.variables,
      fetchPolicy: 'network-only',
    })
  } catch (erreur) {
    // Un refus du serveur doit se voir : la requête se relit elle-même, et l'écran
    // affiche le refus. Une panne de réseau ne change rien à l'écran.
    if (CombinedGraphQLErrors.is(erreur)) {
      await requete.refetch().catch(() => undefined)
    }
  }
}

/**
 * Relit en silence les requêtes actives de la liste, et renvoie leur nombre. Ne lève
 * jamais.
 */
export async function relireLesRequetes(client: ApolloClient): Promise<number> {
  const lectures = [...client.getObservableQueries('active')]
    .filter(requete => {
      const nom = requete.queryName ?? ''
      return REQUETES_RAFRAICHIES.has(nom) && !ecartees.has(nom)
    })
    .map(requete => relire(client, requete))
  await Promise.all(lectures)
  return lectures.length
}

/** Écarte une requête de la relecture tant que le composant est monté. */
export function useSansRafraichissement(nom: string): void {
  useEffect(() => {
    ecartees.set(nom, (ecartees.get(nom) ?? 0) + 1)
    return () => {
      const reste = (ecartees.get(nom) ?? 1) - 1
      if (reste > 0) ecartees.set(nom, reste)
      else ecartees.delete(nom)
    }
  }, [nom])
}

/**
 * Relit les écrans au retour sur l'onglet, au retour du réseau et chaque minute.
 * À monter une seule fois, dans la coquille de l'espace organisateur.
 */
export function useRafraichissement(): void {
  const client = useApolloClient()
  useEffect(() => {
    // Les écrans viennent de se charger : la première relecture attend son tour.
    let dernier = Date.now()
    const rafraichir = () => {
      const maintenant = Date.now()
      const pret = peutRafraichir({
        maintenant,
        dernier,
        visible: document.visibilityState === 'visible',
        enLigne: navigator.onLine,
      })
      if (!pret) return
      dernier = maintenant
      void relireLesRequetes(client)
    }
    document.addEventListener('visibilitychange', rafraichir)
    window.addEventListener('online', rafraichir)
    const minuteur = window.setInterval(rafraichir, INTERVALLE_MS)
    return () => {
      document.removeEventListener('visibilitychange', rafraichir)
      window.removeEventListener('online', rafraichir)
      window.clearInterval(minuteur)
    }
  }, [client])
}
