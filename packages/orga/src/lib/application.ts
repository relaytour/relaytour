import { useEffect, useSyncExternalStore } from 'react'

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

/**
 * Vrai quand la page a chargé tous ses scripts et ses styles du build parmi les
 * fichiers d'une coquille : elle tourne déjà sur cette version.
 */
export function pageAJour(
  fichiersPage: string[],
  fichiersCoquille: string[]
): boolean {
  const coquille = new Set(fichiersCoquille)
  return fichiersPage.length > 0 && fichiersPage.every(f => coquille.has(f))
}

/** Les scripts et les styles du build que la page a chargés. */
function fichiersDeLaPage(): string[] {
  return [
    ...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
      'script[src], link[rel="stylesheet"], link[rel="modulepreload"]'
    ),
  ]
    .map(e => new URL(e instanceof HTMLScriptElement ? e.src : e.href).pathname)
    .filter(chemin => /^\/assets\/.+\.(?:js|css)$/.test(chemin))
}

/** Demande à un service worker les fichiers de sa coquille. */
function coquilleDe(worker: ServiceWorker): Promise<string[] | null> {
  return new Promise(resoudre => {
    const canal = new MessageChannel()
    const delai = setTimeout(() => resoudre(null), 2000)
    canal.port1.onmessage = evenement => {
      clearTimeout(delai)
      const fichiers = (evenement.data as { fichiers?: unknown } | null)
        ?.fichiers
      resoudre(
        Array.isArray(fichiers) && fichiers.every(f => typeof f === 'string')
          ? fichiers
          : null
      )
    }
    worker.postMessage({ type: 'COQUILLE' }, [canal.port2])
  })
}

/**
 * Annonce un service worker en attente, sauf si la page tourne déjà sur sa
 * version. Une navigation passe par le réseau : la page rechargée est la
 * nouvelle, alors que l'ancien service worker la contrôle encore et que le
 * nouveau attend. Sans réponse du service worker, l'avis s'affiche.
 */
async function annoncer(worker: ServiceWorker) {
  const fichiers = await coquilleDe(worker)
  if (fichiers !== null && pageAJour(fichiersDeLaPage(), fichiers)) return
  retenir(worker)
}

/** Suit un service worker en cours d'installation jusqu'à son attente. */
function suivre(enregistrement: ServiceWorkerRegistration) {
  const nouveau = enregistrement.installing
  if (nouveau === null) return
  nouveau.addEventListener('statechange', () => {
    // Sans contrôleur, c'est la première installation : rien à annoncer.
    if (nouveau.state === 'installed' && navigator.serviceWorker.controller)
      void annoncer(nouveau)
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
          void annoncer(enregistrement.waiting)
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

/**
 * Ouvre l'écran d'une notification push (ADR 0024). Le service worker ramène la
 * fenêtre au premier plan, puis lui demande d'afficher le chemin : le routeur
 * s'en charge, sans recharger la page. Le message nomme l'organisation de la
 * notification, que l'appelant sélectionne quand elle n'est pas l'active.
 */
export function useOuvertureDepuisNotification(
  ouvrir: (chemin: string, organisation: string | null) => void
): void {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const recevoir = (evenement: MessageEvent) => {
      const donnees = evenement.data as {
        type?: string
        chemin?: unknown
        organisation?: unknown
      } | null
      if (
        donnees?.type === 'OUVRIR' &&
        typeof donnees.chemin === 'string' &&
        /^\/(?!\/)/.test(donnees.chemin)
      )
        ouvrir(
          donnees.chemin,
          typeof donnees.organisation === 'string' ? donnees.organisation : null
        )
    }
    navigator.serviceWorker.addEventListener('message', recevoir)
    return () =>
      navigator.serviceWorker.removeEventListener('message', recevoir)
  }, [ouvrir])
}
