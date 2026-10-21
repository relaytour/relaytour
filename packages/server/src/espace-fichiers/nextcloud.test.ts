import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  baseAdmise,
  commencerLoginNextcloud,
  espaceNextcloud,
  lireMultistatus,
  type ConfigurationNextcloud,
  type SecretNextcloud,
} from './nextcloud.ts'

const TOUS: ConfigurationNextcloud = { tous: true, hotes: [] }
const BASE = 'https://cloud.exemple.org'

describe('baseAdmise', () => {
  it('ramène une adresse https à la base du Nextcloud', () => {
    expect(baseAdmise('https://Cloud.Exemple.org/', TOUS)).toBe(
      'https://cloud.exemple.org'
    )
    expect(
      baseAdmise('https://exemple.org/nextcloud/index.php/apps/files/', TOUS)
    ).toBe('https://exemple.org/nextcloud')
    expect(baseAdmise('https://cloud.exemple.org/apps/files?dir=/', TOUS)).toBe(
      'https://cloud.exemple.org'
    )
  })

  it('refuse une adresse que l’exploitant n’admet pas', () => {
    for (const a of [
      'http://cloud.exemple.org',
      'https://cloud.exemple.org:8443',
      'https://192.168.1.4',
      'https://[fd00::1]',
      'https://intranet.localhost',
      'https://moi:test-secret@cloud.exemple.org',
      'cloud.exemple.org',
    ]) {
      expect(baseAdmise(a, TOUS)).toBeNull()
    }
    expect(
      baseAdmise('https://cloud.exemple.org', { tous: false, hotes: [] })
    ).toBeNull()
  })

  it('refuse une adresse trop longue pour servir d’emplacement', () => {
    expect(
      baseAdmise(`https://cloud.exemple.org/${'a'.repeat(200)}`, TOUS)
    ).toBeNull()
  })

  it('admet un hôte nommé par l’exploitant, port et réseau privé compris', () => {
    const c = { tous: false, hotes: ['nuage.lan:8443', '192.168.1.4'] }
    expect(baseAdmise('https://nuage.lan:8443/', c)).toBe(
      'https://nuage.lan:8443'
    )
    expect(baseAdmise('https://192.168.1.4', c)).toBe('https://192.168.1.4')
    expect(baseAdmise('https://nuage.lan', c)).toBeNull()
  })
})

const RACINE = ['remote.php', 'dav', 'files', 'camille']

const reponse = (href: string, prop: string, statut = 'HTTP/1.1 200 OK') =>
  `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${prop}</d:prop><d:status>${statut}</d:status></d:propstat></d:response>`

const multistatus = (...reponses: string[]) =>
  `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">${reponses.join('')}</d:multistatus>`

describe('lireMultistatus', () => {
  it('lit les dossiers et fichiers, chemins décodés', () => {
    const entrees = lireMultistatus(
      multistatus(
        reponse(
          '/remote.php/dav/files/camille/%C3%89quipe/',
          '<d:resourcetype><d:collection/></d:resourcetype><oc:fileid>12</oc:fileid><d:getetag>"e1"</d:getetag>'
        ),
        reponse(
          '/remote.php/dav/files/camille/%C3%89quipe/Plan%20d%27acc%C3%A8s.pdf',
          '<d:resourcetype/><oc:fileid>13</oc:fileid><d:getcontentlength>2048</d:getcontentlength><d:getcontenttype>application/pdf</d:getcontenttype><d:getlastmodified>Tue, 20 Oct 2026 08:00:00 GMT</d:getlastmodified><d:getetag>"e2"</d:getetag>'
        ),
        // Hors de la racine des fichiers du compte : ignoré.
        reponse(
          '/remote.php/dav/files/autre/Secret.pdf',
          '<oc:fileid>99</oc:fileid>'
        )
      ),
      RACINE
    )
    expect(entrees).toEqual([
      {
        chemin: ['Équipe'],
        fileid: '12',
        dossier: true,
        taille: null,
        modifieLe: null,
        typeMime: null,
        etag: 'e1',
      },
      {
        chemin: ['Équipe', "Plan d'accès.pdf"],
        fileid: '13',
        dossier: false,
        taille: 2048,
        modifieLe: new Date('2026-10-20T08:00:00Z'),
        typeMime: 'application/pdf',
        etag: 'e2',
      },
    ])
  })

  it('ignore une entrée sans propriété trouvée', () => {
    expect(
      lireMultistatus(
        multistatus(
          reponse(
            '/remote.php/dav/files/camille/x',
            '<oc:fileid>1</oc:fileid>',
            'HTTP/1.1 404 Not Found'
          )
        ),
        RACINE
      )
    ).toEqual([])
  })
})

// ── Nextcloud simulé ─────────────────────────────────────────────────────────

interface Noeud {
  fileid: string
  chemin: string[]
  contenu?: string
  etag: string
}

function nextcloudSimule(noeuds: Noeud[]) {
  const appels: { methode: string; adresse: URL; entetes: Headers }[] = []
  const prefixe = '/remote.php/dav/files/camille'
  const href = (n: Noeud) =>
    `${prefixe}${n.chemin.map(x => `/${encodeURIComponent(x)}`).join('')}${n.contenu === undefined ? '/' : ''}`
  const prop = (n: Noeud) =>
    `<d:resourcetype>${n.contenu === undefined ? '<d:collection/>' : ''}</d:resourcetype><oc:fileid>${n.fileid}</oc:fileid><d:getetag>"${n.etag}"</d:getetag>${n.contenu === undefined ? '' : `<d:getcontentlength>${n.contenu.length}</d:getcontentlength>`}`
  const xml = (liste: Noeud[]) =>
    new Response(multistatus(...liste.map(n => reponse(href(n), prop(n)))), {
      status: 207,
    })
  const egal = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x, i) => x === b[i])
  vi.stubGlobal('fetch', (entree: string, init: RequestInit = {}) => {
    const adresse = new URL(entree)
    const methode = init.method ?? 'GET'
    const entetes = new Headers(init.headers)
    appels.push({ methode, adresse, entetes })
    if (methode === 'SEARCH') {
      const id = /<d:literal>(\d+)<\/d:literal>/.exec(init.body as string)?.[1]
      return Promise.resolve(xml(noeuds.filter(n => n.fileid === id)))
    }
    const chemin = adresse.pathname
      .slice(prefixe.length)
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent)
    const noeud = noeuds.find(n => egal(n.chemin, chemin))
    if (methode === 'PROPFIND') {
      if (noeud === undefined)
        return Promise.resolve(new Response('', { status: 404 }))
      const enfants =
        entetes.get('depth') === '1'
          ? noeuds.filter(
              n =>
                n.chemin.length === chemin.length + 1 &&
                egal(n.chemin.slice(0, -1), chemin)
            )
          : []
      return Promise.resolve(xml([noeud, ...enfants]))
    }
    if (methode === 'GET') {
      return Promise.resolve(
        new Response(noeud?.contenu ?? '', { status: 200 })
      )
    }
    if (methode === 'MKCOL') {
      if (noeud !== undefined)
        return Promise.resolve(new Response('', { status: 405 }))
      noeuds.push({ fileid: String(100 + noeuds.length), chemin, etag: 'n' })
      return Promise.resolve(new Response('', { status: 201 }))
    }
    if (methode === 'PUT') {
      return Promise.resolve(
        new Response('', { status: 201, headers: { 'oc-etag': '"e9"' } })
      )
    }
    return Promise.resolve(new Response('', { status: 404 }))
  })
  return appels
}

describe('Nextcloud simulé', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const SECRET: SecretNextcloud = {
    base: 'https://cloud.exemple.org',
    utilisateur: 'camille',
    identifiant: 'camille@asso.exemple.org',
    motDePasse: 'mdp',
  }
  const jeton = () => Promise.resolve(JSON.stringify(SECRET))
  const noeuds = (): Noeud[] => [
    { fileid: '1', chemin: [], etag: 'r' },
    { fileid: '10', chemin: ['Association'], etag: 'a' },
    { fileid: '11', chemin: ['Association', 'Natation'], etag: 'n' },
    {
      fileid: '12',
      chemin: ['Association', 'Natation', 'Plan.pdf'],
      contenu: '%PDF',
      etag: 'p',
    },
  ]

  it('retrouve un dossier lié par son identifiant, et lit sous lui', async () => {
    const appels = nextcloudSimule(noeuds())
    const espace = espaceNextcloud(jeton, TOUS)
    const position = {
      emplacement: BASE,
      base: '10',
      chemin: ['Natation', 'Plan.pdf'],
    }
    expect(await espace.element(position)).toMatchObject({
      id: '12',
      nom: 'Plan.pdf',
      dossier: false,
      etag: 'p',
      lienWeb: 'https://cloud.exemple.org/index.php/f/12',
    })
    const contenu = await espace.ouvrir(position, { pdf: false })
    expect(await new Response(contenu.flux).text()).toBe('%PDF')
    expect(await espace.element({ ...position, base: '404' })).toBeNull()
    // Chaque appel porte le mot de passe d'application, en Basic.
    expect(appels[0]!.entetes.get('authorization')).toBe(
      `Basic ${Buffer.from('camille@asso.exemple.org:mdp').toString('base64')}`
    )
  })

  it('liste un dossier sans lui-même, et remonte ses parents', async () => {
    nextcloudSimule(noeuds())
    const espace = espaceNextcloud(jeton, TOUS)
    const liste = await espace.lister({
      emplacement: BASE,
      base: null,
      chemin: ['Association'],
    })
    expect(liste?.elements.map(e => e.nom)).toEqual(['Natation'])
    expect(await espace.ancetres(BASE, '11')).toEqual([
      { id: '11', nom: 'Natation' },
      { id: '10', nom: 'Association' },
      { id: '1', nom: 'Fichiers' },
    ])
  })

  it('crée un dossier sous un nom libre, puis écrit un fichier', async () => {
    const appels = nextcloudSimule(noeuds())
    const espace = espaceNextcloud(jeton, TOUS)
    const parent = { emplacement: BASE, base: null, chemin: [] }
    const cree = await espace.creerDossier(parent, 'Association', {
      renommer: true,
    })
    expect(cree.nom).toBe('Association 1')
    expect(
      await espace.creerDossier(parent, 'Association', { renommer: false })
    ).toMatchObject({ id: '10' })
    expect(
      await espace.ecrire(
        { emplacement: BASE, base: '10', chemin: ['accueil.md'] },
        'Texte.'
      )
    ).toEqual({ etag: 'e9' })
    const envoi = appels.find(a => a.methode === 'PUT')!
    expect(envoi.adresse.pathname).toBe(
      '/remote.php/dav/files/camille/Association/accueil.md'
    )
  })

  it('ne lit pas une position d’une autre instance', async () => {
    nextcloudSimule(noeuds())
    const espace = espaceNextcloud(jeton, TOUS)
    // Un lien créé sur une autre instance porte son adresse comme emplacement.
    const ailleurs = 'https://autre.exemple.org'
    expect(
      await espace.element({ emplacement: ailleurs, base: '10', chemin: [] })
    ).toBeNull()
    expect(
      await espace.lister({ emplacement: ailleurs, base: null, chemin: [] })
    ).toBeNull()
    expect(await espace.ancetres(ailleurs, '11')).toBeNull()
    expect(await espace.emplacements()).toEqual([
      { id: BASE, nom: 'Fichiers', site: 'cloud.exemple.org' },
    ])
  })

  it('refuse une réponse JSON trop lourde avant de la décoder', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(`{"login":"${'x'.repeat(100_000)}"}`, { status: 200 })
      )
    )
    await expect(commencerLoginNextcloud(TOUS, BASE)).rejects.toThrow(
      /trop longuement/
    )
  })

  it('refuse une redirection, et une base que l’exploitant n’admet plus', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response('', {
          status: 302,
          headers: { location: 'http://169.254.169.254/' },
        })
      )
    )
    const espace = espaceNextcloud(jeton, TOUS)
    await expect(
      espace.element({ emplacement: BASE, base: null, chemin: [] })
    ).rejects.toThrow(/autre adresse/)
    const ferme = espaceNextcloud(jeton, { tous: false, hotes: [] })
    await expect(
      ferme.element({ emplacement: BASE, base: null, chemin: [] })
    ).rejects.toThrow(/n’admet plus/)
  })
})
