/// <reference lib="webworker" />

// Service worker de l'espace organisateur (ADR 0023). Il garde en cache la
// coquille de l'application, jamais une donnée : il n'intercepte ni l'API, ni la
// connexion, ni les images d'une organisation.

const sw = self as unknown as ServiceWorkerGlobalScope
// Remplacés au build par `vite.config.ts` : la version du build et ses fichiers.
declare const __VERSION_COQUILLE__: string
declare const __FICHIERS_COQUILLE__: string[]

const CACHE = `relaytour-coquille-${__VERSION_COQUILLE__}`
const PAGE = '/index.html'
const HORS_CACHE = ['/graphql', '/api/', '/medias/']

sw.addEventListener('install', evenement => {
  evenement.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll([PAGE, ...__FICHIERS_COQUILLE__]))
  )
})

sw.addEventListener('activate', evenement => {
  evenement.waitUntil(
    caches
      .keys()
      .then(cles =>
        Promise.all(
          cles
            .filter(
              cle => cle.startsWith('relaytour-coquille-') && cle !== CACHE
            )
            .map(cle => caches.delete(cle))
        )
      )
      .then(() => sw.clients.claim())
  )
})

// La personne a demandé la nouvelle version : elle remplace l'ancienne.
sw.addEventListener('message', evenement => {
  if ((evenement.data as { type?: string } | null)?.type === 'ACTIVER')
    void sw.skipWaiting()
})

sw.addEventListener('fetch', evenement => {
  const requete = evenement.request
  if (requete.method !== 'GET') return
  const adresse = new URL(requete.url)
  if (adresse.origin !== sw.location.origin) return
  if (HORS_CACHE.some(prefixe => adresse.pathname.startsWith(prefixe))) return

  // Une navigation interroge le réseau. Sans réseau, la coquille gardée en
  // cache s'affiche, et l'application montre l'écran « Hors connexion ».
  if (requete.mode === 'navigate') {
    evenement.respondWith(
      fetch(requete).catch(async () => {
        const page = await caches.match(PAGE)
        return page ?? Response.error()
      })
    )
    return
  }

  // Un fichier du build porte une empreinte dans son nom : son contenu ne
  // change jamais. Les polices entrent dans le cache à leur première lecture.
  if (adresse.pathname.startsWith('/assets/')) {
    evenement.respondWith(
      caches.match(requete).then(
        enCache =>
          enCache ??
          fetch(requete).then(reponse => {
            if (reponse.ok) {
              const copie = reponse.clone()
              void caches.open(CACHE).then(cache => cache.put(requete, copie))
            }
            return reponse
          })
      )
    )
  }
})
