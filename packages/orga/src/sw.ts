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

// Notification push (ADR 0024). Le serveur envoie un texte déjà composé : le
// service worker l'affiche. Chaque message reçu affiche une notification, sans
// quoi le navigateur retire l'abonnement.
interface MessagePush {
  titre: string
  corps: string
  lien: string
  organisation: string
  etiquette: string
  icone: string
  nonLues: number
}

sw.addEventListener('push', evenement => {
  let message: Partial<MessagePush> = {}
  try {
    message = (evenement.data?.json() ?? {}) as Partial<MessagePush>
  } catch {
    // Charge illisible : la notification garde un texte neutre.
  }
  const pastille = sw.navigator as WorkerNavigator & {
    setAppBadge?: (nombre?: number) => Promise<void>
  }
  evenement.waitUntil(
    Promise.all([
      sw.registration.showNotification(message.titre ?? 'Espace organisateur', {
        body: message.corps ?? 'Une notification vous attend.',
        tag: message.etiquette,
        icon: message.icone ?? '/icon.png',
        data: { lien: message.lien ?? '/', organisation: message.organisation },
      }),
      typeof message.nonLues === 'number' && message.nonLues > 0
        ? pastille.setAppBadge?.(message.nonLues).catch(() => undefined)
        : undefined,
    ])
  )
})

// Un appui ramène une fenêtre déjà ouverte sur l'écran concerné, ou en ouvre une.
// Une personne peut appartenir à plusieurs organisations : l'adresse désigne
// celle de la notification, que l'application sélectionne avant d'afficher l'écran.
sw.addEventListener('notificationclick', evenement => {
  evenement.notification.close()
  const donnees = evenement.notification.data as {
    lien?: string
    organisation?: string
  } | null
  // Seul un chemin de l'application s'ouvre, jamais une adresse externe.
  const chemin =
    typeof donnees?.lien === 'string' && /^\/(?!\/)/.test(donnees.lien)
      ? donnees.lien
      : '/'
  const organisation =
    typeof donnees?.organisation === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(donnees.organisation)
      ? donnees.organisation
      : null
  // L'adresse complète sert à une fenêtre neuve : l'application y lit
  // l'organisation à son démarrage.
  const adresse = new URL(chemin, sw.location.origin)
  if (organisation !== null)
    adresse.searchParams.set('organisation', organisation)
  const complete = adresse.pathname + adresse.search
  evenement.waitUntil(
    sw.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async fenetres => {
        const fenetre = fenetres[0]
        if (fenetre === undefined) return sw.clients.openWindow(complete)
        await fenetre.focus()
        // L'écran de connexion et le formulaire public n'écoutent pas le
        // service worker : la fenêtre charge alors l'adresse elle-même.
        const sansCoquille = /^\/(?:connexion|rejoindre)(?:\/|$)/.test(
          new URL(fenetre.url).pathname
        )
        if (sansCoquille)
          return fenetre
            .navigate(complete)
            .catch(() => sw.clients.openWindow(complete))
        fenetre.postMessage({ type: 'OUVRIR', chemin, organisation })
        return undefined
      })
  )
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
              // L'écriture tient le service worker en vie jusqu'à sa fin : sans
              // cela, le navigateur peut l'arrêter dès la réponse rendue.
              evenement.waitUntil(
                caches.open(CACHE).then(cache => cache.put(requete, copie))
              )
            }
            return reponse
          })
      )
    )
  }
})
