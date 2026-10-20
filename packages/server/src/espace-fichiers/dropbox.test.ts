import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  adresseAutorisationDropbox,
  argumentEnTete,
  cheminDeLecture,
  convertibleParDropbox,
  espaceDropbox,
} from './dropbox.ts'

describe('Dropbox, règles pures', () => {
  it('échappe en ASCII l’argument d’un en-tête', () => {
    expect(argumentEnTete({ path: '/Équipe/été' })).toBe(
      '{"path":"/\\u00c9quipe/\\u00e9t\\u00e9"}'
    )
  })

  it('lit depuis l’identifiant de la base, ou depuis la racine', () => {
    expect(
      cheminDeLecture({
        emplacement: 'dropbox',
        base: 'id:abc',
        chemin: ['Natation', 'Plan.pdf'],
      })
    ).toBe('id:abc/Natation/Plan.pdf')
    expect(
      cheminDeLecture({ emplacement: 'dropbox', base: null, chemin: [] })
    ).toBe('')
  })

  it('ne convertit en PDF que les formats que Dropbox rend en PDF', () => {
    expect(convertibleParDropbox('Plan.docx')).toBe(true)
    expect(convertibleParDropbox('Diapos.pptx')).toBe(true)
    // Un tableur reçoit un aperçu HTML, que la liseuse ne sert pas.
    expect(convertibleParDropbox('Budget.xlsx')).toBe(false)
  })

  it('demande un accès hors ligne, avec PKCE', () => {
    const adresse = new URL(
      adresseAutorisationDropbox(
        {
          clientId: 'cle',
          clientSecret: 'secret',
          retour:
            'https://orga.exemple.org/medias/espace-fichiers/retour/dropbox',
        },
        'etat',
        'defi'
      )
    )
    expect(adresse.host).toBe('www.dropbox.com')
    expect(Object.fromEntries(adresse.searchParams)).toMatchObject({
      token_access_type: 'offline',
      code_challenge: 'defi',
      code_challenge_method: 'S256',
      state: 'etat',
    })
  })
})

// ── Dropbox simulé ───────────────────────────────────────────────────────────

interface Meta {
  '.tag': 'file' | 'folder'
  id: string
  name: string
  path_lower: string
  path_display: string
  rev?: string
  contenu?: string
}

function dropboxSimule(elements: Meta[], parPage = 1000) {
  const appels: {
    route: string
    entetes: Record<string, string>
    corps: string
  }[] = []
  const json = (valeur: unknown, statut = 200) =>
    new Response(JSON.stringify(valeur), {
      status: statut,
      headers: { 'content-type': 'application/json' },
    })
  /** « id:x/a/b » ou « /a/b » vers le chemin en minuscules. */
  const resoudre = (chemin: string): string | null => {
    const id = /^(id:[^/]+)(.*)$/.exec(chemin)
    if (id === null) return chemin.toLowerCase()
    const base = elements.find(e => e.id === id[1])
    return base === undefined
      ? null
      : `${base.path_lower}${id[2]!.toLowerCase()}`
  }
  const introuvable = () => json({ error_summary: 'path/not_found/..' }, 409)
  vi.stubGlobal('fetch', (adresse: string, init: RequestInit = {}) => {
    const route = new URL(adresse).pathname.replace(/^\/2\//, '')
    const entetes = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>)
    )
    const corps = typeof init.body === 'string' ? init.body : ''
    appels.push({ route, entetes, corps })
    const args = (
      route.startsWith('files/upload') ||
      route.startsWith('files/download') ||
      route.startsWith('files/get_preview')
        ? JSON.parse(entetes['Dropbox-API-Arg'] ?? '{}')
        : JSON.parse(corps || 'null')
    ) as { path?: string; cursor?: string } | null
    if (route === 'files/get_metadata') {
      const chemin = resoudre(args!.path!)
      const e = elements.find(x => x.path_lower === chemin)
      return Promise.resolve(e === undefined ? introuvable() : json(e))
    }
    if (
      route === 'files/list_folder' ||
      route === 'files/list_folder/continue'
    ) {
      const chemin =
        route === 'files/list_folder'
          ? resoudre(args!.path!)
          : args!.cursor!.split('|')[0]!
      const depart =
        route === 'files/list_folder' ? 0 : Number(args!.cursor!.split('|')[1])
      const enfants = elements.filter(
        x => x.path_lower.slice(0, x.path_lower.lastIndexOf('/')) === chemin
      )
      const page = enfants.slice(depart, depart + parPage)
      return Promise.resolve(
        json({
          entries: page,
          cursor: `${chemin}|${depart + parPage}`,
          has_more: depart + parPage < enfants.length,
        })
      )
    }
    if (route === 'files/download') {
      const chemin = resoudre(args!.path!)
      const e = elements.find(x => x.path_lower === chemin)
      return Promise.resolve(
        e === undefined ? introuvable() : new Response(e.contenu ?? '')
      )
    }
    if (route === 'files/upload') {
      return Promise.resolve(
        json({ ...args, rev: 'r2', name: 'x', id: 'id:n' })
      )
    }
    return Promise.resolve(json({}, 404))
  })
  return appels
}

describe('Dropbox simulé', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const jeton = () => Promise.resolve('jeton')
  const elements: Meta[] = [
    {
      '.tag': 'folder',
      id: 'id:asso',
      name: 'Asso',
      path_lower: '/asso',
      path_display: '/Asso',
    },
    {
      '.tag': 'folder',
      id: 'id:nat',
      name: 'Natation',
      path_lower: '/asso/natation',
      path_display: '/Asso/Natation',
    },
    {
      '.tag': 'file',
      id: 'id:plan',
      name: 'Plan.pdf',
      path_lower: '/asso/natation/plan.pdf',
      path_display: '/Asso/Natation/Plan.pdf',
      rev: 'r1',
      contenu: '%PDF',
    },
    {
      '.tag': 'file',
      id: 'id:a',
      name: 'A.md',
      path_lower: '/asso/a.md',
      path_display: '/Asso/A.md',
      rev: 'r1',
    },
    {
      '.tag': 'file',
      id: 'id:b',
      name: 'B.md',
      path_lower: '/asso/b.md',
      path_display: '/Asso/B.md',
      rev: 'r1',
    },
  ]

  it('lit depuis un dossier connu par son identifiant', async () => {
    dropboxSimule(elements)
    const espace = espaceDropbox(jeton)
    const plan = await espace.element({
      emplacement: 'dropbox',
      base: 'id:asso',
      chemin: ['Natation', 'Plan.pdf'],
    })
    expect(plan).toMatchObject({
      id: 'id:plan',
      dossier: false,
      etag: 'r1',
      lienWeb: 'https://www.dropbox.com/home/Asso/Natation?preview=Plan.pdf',
    })
    expect(
      await espace.element({
        emplacement: 'dropbox',
        base: 'id:asso',
        chemin: ['Absent'],
      })
    ).toBeNull()
    const contenu = await espace.ouvrir(
      {
        emplacement: 'dropbox',
        base: 'id:asso',
        chemin: ['Natation', 'Plan.pdf'],
      },
      { pdf: false }
    )
    expect(await new Response(contenu.flux).text()).toBe('%PDF')
  })

  it('suit les pages, et dit quand la liste est coupée', async () => {
    dropboxSimule(elements, 1)
    const espace = espaceDropbox(jeton)
    const liste = await espace.lister({
      emplacement: 'dropbox',
      base: 'id:asso',
      chemin: [],
    })
    expect(liste?.complet).toBe(true)
    expect(liste?.elements.map(e => e.nom)).toEqual([
      'Natation',
      'A.md',
      'B.md',
    ])
  })

  it('écrit sur le chemin complet reconstitué, et passe la racine d’équipe', async () => {
    const appels = dropboxSimule(elements)
    const espace = espaceDropbox(jeton)
    expect(
      await espace.ecrire(
        {
          emplacement: 'equipe:42',
          base: 'id:asso',
          chemin: ['communes', 'accueil.md'],
        },
        'Texte.'
      )
    ).toEqual({ etag: 'r2' })
    const envoi = appels.find(a => a.route === 'files/upload')!
    expect(JSON.parse(envoi.entetes['Dropbox-API-Arg']!)).toMatchObject({
      path: '/asso/communes/accueil.md',
      mode: 'overwrite',
    })
    expect(JSON.parse(envoi.entetes['Dropbox-API-Path-Root']!)).toEqual({
      '.tag': 'root',
      root: '42',
    })
  })
})
