import { useSyncExternalStore } from 'react'

// Application installée (ADR 0023) : déclaration du manifest dans la page,
// service worker, mise à jour et état du réseau.

interface IdentiteApplication {
  nomCourt: string
  iconeApplicationUrl: string | null
  manifestUrl: string | null
  theme: { couleurs: { primaire: string } }
}

/** Icône de Relaytour livrée avec le build : elle sert sans icône déclarée. */
const ICONE_PAR_DEFAUT = '/icon.png'

function poser(selecteur: string, creer: () => HTMLElement): HTMLElement {
  const existant = document.head.querySelector<HTMLElement>(selecteur)
  if (existant !== null) return existant
  const element = creer()
  document.head.append(element)
  return element
}

function lien(rel: string): HTMLLinkElement {
  return poser(`link[rel="${rel}"]`, () => {
    const l = document.createElement('link')
    l.rel = rel
    return l
  }) as HTMLLinkElement
}

function meta(name: string): HTMLMetaElement {
  return poser(`meta[name="${name}"]`, () => {
    const m = document.createElement('meta')
    m.name = name
    return m
  }) as HTMLMetaElement
}

/**
 * Déclare l'application de l'organisation dans la page : manifest, icône d'écran
 * d'accueil, nom et couleur. Le navigateur lit ces balises quand la personne
 * installe l'application.
 */
export function declarerApplication(organisation: IdentiteApplication): void {
  if (organisation.manifestUrl === null) return
  lien('manifest').href = organisation.manifestUrl
  lien('apple-touch-icon').href =
    organisation.iconeApplicationUrl ?? ICONE_PAR_DEFAUT
  meta('apple-mobile-web-app-title').content = organisation.nomCourt
  meta('theme-color').content = organisation.theme.couleurs.primaire
}

// ── Réseau ──────────────────────────────────────────────────────────────────

function ecouterReseau(prevenir: () => void): () => void {
  window.addEventListener('online', prevenir)
  window.addEventListener('offline', prevenir)
  return () => {
    window.removeEventListener('online', prevenir)
    window.removeEventListener('offline', prevenir)
  }
}

/**
 * Faux quand l'appareil n'a aucun réseau. Vrai ne garantit rien : un réseau sans
 * accès à Internet reste « en ligne » pour le navigateur.
 */
export function useEnLigne(): boolean {
  return useSyncExternalStore(
    ecouterReseau,
    () => navigator.onLine,
    () => true
  )
}

// ── Service worker et mise à jour ───────────────────────────────────────────

let enAttente: ServiceWorker | null = null
const abonnes = new Set<() => void>()

function retenir(worker: ServiceWorker | null) {
  enAttente = worker
  for (const prevenir of abonnes) prevenir()
}

/** Suit un service worker en cours d'installation jusqu'à son attente. */
function suivre(enregistrement: ServiceWorkerRegistration) {
  const nouveau = enregistrement.installing
  if (nouveau === null) return
  nouveau.addEventListener('statechange', () => {
    // Sans contrôleur, c'est la première installation : rien à annoncer.
    if (nouveau.state === 'installed' && navigator.serviceWorker.controller)
      retenir(nouveau)
  })
}

/**
 * Enregistre le service worker du build. En développement, Vite sert les
 * modules un par un : il n'y a pas de coquille à garder en cache.
 */
export function enregistrerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      enregistrement => {
        if (enregistrement.waiting && navigator.serviceWorker.controller)
          retenir(enregistrement.waiting)
        enregistrement.addEventListener('updatefound', () =>
          suivre(enregistrement)
        )
        // Une application installée reste ouverte des jours : elle revérifie
        // sa version à chaque retour au premier plan.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible')
            void enregistrement.update().catch(() => undefined)
        })
      },
      () => undefined
    )
  })
  // Le nouveau service worker a pris la main à la demande de la personne.
  let recharge = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recharge || enAttente === null) return
    recharge = true
    window.location.reload()
  })
}

/**
 * Vrai quand une nouvelle version attend. `recharger` l'active puis recharge
 * la page : l'application ne se recharge jamais d'elle-même.
 */
export function useMiseAJour(): { disponible: boolean; recharger: () => void } {
  const worker = useSyncExternalStore(
    prevenir => {
      abonnes.add(prevenir)
      return () => abonnes.delete(prevenir)
    },
    () => enAttente,
    () => null
  )
  return {
    disponible: worker !== null,
    recharger: () => worker?.postMessage({ type: 'ACTIVER' }),
  }
}
