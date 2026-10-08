import type { ApolloClient, ObservableQuery } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { useApolloClient } from '@apollo/client/react'
import { useEffect, useSyncExternalStore } from 'react'

import { creerFlux } from './flux'
import { ouvrirLeFluxSse } from './flux-sse'

// Rafraîchissement des écrans. Les données d'un écran viennent aussi d'autres
// personnes : les écrans les relisent au retour sur l'onglet, au retour du réseau, et
// chaque minute tant que l'onglet est visible.
//
// Le flux des changements (lib/flux.ts, ADR 0017) accélère cette relecture : à chaque
// signal du serveur, les écrans concernés se relisent aussitôt. Tant qu'il est
// ouvert, la relecture périodique passe à cinq minutes : elle ne sert plus qu'à
// rattraper un signal perdu.
//
// La relecture passe par une liste de requêtes, jamais par toutes les requêtes
// actives : les requêtes de session et les écrans de réglage n'y figurent pas.
//
// Une relecture est silencieuse. Elle n'appelle pas `refetch()` sur la requête d'un
// écran : `refetch()` passe `loading` à vrai, et une panne de réseau y pose une
// erreur que l'écran afficherait comme un refus. Elle lit le serveur à côté, puis
// écrit la réponse dans le cache, qui met à jour les écrans. Une panne du réseau ou
// du serveur laisse donc l'écran tel quel jusqu'au passage suivant.
//
// Un refus n'est pas une panne : la session a pris fin, ou les accès de la personne
// ont changé. Peu d'écrans lisent l'erreur de leur requête, et la garde de session
// renverrait aussitôt vers la connexion. Le refus se traite donc à un seul endroit :
// la coquille affiche un avis, qui propose de recharger la page
// (composants/AvisRelecture.tsx). Rien n'est démonté ni écrit dans le cache, et une
// saisie en cours reste à l'écran jusqu'au rechargement.

// Les requêtes actives à rafraîchir après une action sur une tâche : les compteurs
// d'avancement et les listes « à prendre » dépendent du statut et des assignations.
export const VUES_TACHES = [
  'PagePerimetre',
  'MesTaches',
  'AvancementGlobal',
  'Retroplanning',
  // Tâches partagées (ADR 0026) : les tâches proposées à un périmètre, et le détail
  // des déclinaisons d'une tâche quand il est ouvert.
  'DeclinaisonsProposees',
  'DeclinaisonsTache',
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
/** Délai entre deux relectures périodiques quand le flux des changements est ouvert. */
export const INTERVALLE_AVEC_FLUX_MS = 5 * 60_000
/** Écart minimal entre deux relectures, quelle que soit leur cause. */
export const ECART_MIN_MS = 15_000

/** Vrai quand une relecture peut partir. */
export function peutRafraichir(etat: {
  maintenant: number
  dernier: number
  visible: boolean
  enLigne: boolean
  /** L'écart exigé depuis la relecture précédente : `ECART_MIN_MS` par défaut. */
  ecart?: number
}): boolean {
  return (
    etat.visible &&
    etat.enLigne &&
    etat.maintenant - etat.dernier >= (etat.ecart ?? ECART_MIN_MS)
  )
}

// Un écran qui porte une saisie longue écarte sa requête de la relecture : l'éditeur
// de fiche garde la version qu'il a chargée. La valeur compte les écrans montés.
const ecartees = new Map<string, number>()

/** Vrai pour un refus du serveur, faux pour une panne du réseau ou du serveur. */
function estUnRefus(erreur: unknown): boolean {
  return (
    CombinedGraphQLErrors.is(erreur) &&
    erreur.errors.some(e => e.extensions?.code === 'FORBIDDEN')
  )
}

/**
 * Vrai quand la réponse dit que la session a pris fin : le champ `moi` est public,
 * et répond null sans erreur à une requête sans session.
 */
function sessionTerminee(donnees: unknown): boolean {
  return (
    typeof donnees === 'object' &&
    donnees !== null &&
    'moi' in donnees &&
    donnees.moi === null
  )
}

// Le refus rencontré par la dernière relecture, lu par l'avis de la coquille.
let refusEnCours = false
const abonnes = new Set<() => void>()

function noterRefus(refus: boolean): void {
  if (refus === refusEnCours) return
  refusEnCours = refus
  for (const prevenir of abonnes) prevenir()
}

function abonner(prevenir: () => void): () => void {
  abonnes.add(prevenir)
  return () => abonnes.delete(prevenir)
}

/** Vrai quand la dernière relecture a rencontré un refus du serveur. */
export function useRefusDeRelecture(): boolean {
  return useSyncExternalStore(
    abonner,
    () => refusEnCours,
    () => refusEnCours
  )
}

async function relire(
  client: ApolloClient,
  requete: ObservableQuery
): Promise<'relue' | 'panne' | 'refus'> {
  const { query, variables } = requete
  try {
    const { data } = await client.query({
      query,
      variables,
      fetchPolicy: 'no-cache',
    })
    if (data === undefined || data === null) return 'panne'
    // Écrire `moi: null` dans le cache renverrait aussitôt vers la connexion.
    if (sessionTerminee(data)) return 'refus'
    client.writeQuery({ query, variables, data })
    return 'relue'
  } catch (erreur) {
    return estUnRefus(erreur) ? 'refus' : 'panne'
  }
}

/**
 * Relit en silence les requêtes actives de la liste, et renvoie leur nombre. Note un
 * refus pour l'avis de la coquille : une relecture suivante sans refus le retire. Ne
 * lève jamais.
 *
 * Avec `noms`, seules ces requêtes de la liste se relisent : un signal du flux ne
 * concerne que quelques écrans. Une relecture partielle peut lever l'avis, jamais le
 * retirer : elle ne dit rien des autres requêtes.
 */
export async function relireLesRequetes(
  client: ApolloClient,
  noms?: readonly string[]
): Promise<number> {
  const issues = await Promise.all(
    [...client.getObservableQueries('active')]
      .filter(requete => {
        const nom = requete.queryName ?? ''
        return (
          REQUETES_RAFRAICHIES.has(nom) &&
          !ecartees.has(nom) &&
          (noms === undefined || noms.includes(nom))
        )
      })
      .map(requete => relire(client, requete))
  )
  // Une relecture où tout est en panne ne dit rien des accès : l'avis reste tel quel.
  if (issues.includes('refus')) noterRefus(true)
  else if (noms === undefined && issues.includes('relue')) noterRefus(false)
  return issues.length
}

/**
 * Relit tout de suite, en silence, les requêtes actives nommées. Vrai quand le
 * serveur a répondu à chacune : l'appelant ne ferme une saisie qu'après une
 * relecture réussie. Un refus s'annonce par l'avis de la coquille.
 */
export async function relireLesVues(
  client: ApolloClient,
  noms: readonly string[]
): Promise<boolean> {
  const issues = await Promise.all(
    [...client.getObservableQueries('active')]
      .filter(requete => noms.includes(requete.queryName ?? ''))
      .map(requete => relire(client, requete))
  )
  if (issues.includes('refus')) noterRefus(true)
  return issues.every(issue => issue === 'relue')
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
 * Relit les écrans au retour sur l'onglet, au retour du réseau et chaque minute, et
 * tient le flux des changements ouvert tant que l'onglet est visible et en ligne.
 * À monter une seule fois, dans la coquille de l'espace organisateur.
 *
 * `organisation` est le slug de l'organisation active. Le serveur attache un flux à
 * une organisation : quand la personne en change, le flux se ferme et un autre
 * s'ouvre pour la nouvelle.
 */
export function useRafraichissement(organisation: string): void {
  const client = useApolloClient()
  useEffect(() => {
    // Les écrans viennent de se charger : la première relecture attend son tour.
    let dernier = Date.now()
    const rafraichir = (ecart?: number) => {
      const maintenant = Date.now()
      const pret = peutRafraichir({
        maintenant,
        dernier,
        visible: document.visibilityState === 'visible',
        enLigne: navigator.onLine,
        ecart,
      })
      if (!pret) return
      dernier = maintenant
      void relireLesRequetes(client)
    }
    const flux = creerFlux({
      ouvrir: ouvrirLeFluxSse,
      relire: noms => relireLesRequetes(client, noms),
      // Un flux qui s'ouvre a pu manquer des signaux : une relecture complète les
      // rattrape, sans attendre l'écart minimal entre deux relectures.
      apresOuverture: () => rafraichir(0),
    })
    // Un onglet caché ou hors ligne ne garde pas de flux ouvert.
    const suivreLOnglet = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        flux.demarrer()
      } else {
        flux.arreter()
      }
      rafraichir()
    }
    const periodique = () =>
      rafraichir(flux.actif() ? INTERVALLE_AVEC_FLUX_MS : INTERVALLE_MS)

    suivreLOnglet()
    document.addEventListener('visibilitychange', suivreLOnglet)
    window.addEventListener('online', suivreLOnglet)
    window.addEventListener('offline', suivreLOnglet)
    const minuteur = window.setInterval(periodique, INTERVALLE_MS)
    return () => {
      document.removeEventListener('visibilitychange', suivreLOnglet)
      window.removeEventListener('online', suivreLOnglet)
      window.removeEventListener('offline', suivreLOnglet)
      window.clearInterval(minuteur)
      flux.arreter()
    }
  }, [client, organisation])
}
