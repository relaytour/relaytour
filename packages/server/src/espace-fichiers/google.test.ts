import { createVerify, generateKeyPairSync } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  adresseAutorisationGoogle,
  assertionCompteService,
  espaceGoogleDrive,
  HOTES_GOOGLE,
  lireCleCompteService,
  litteral,
} from './google.ts'
import { hoteAdmis } from './sortant.ts'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const EMAIL = 'relaytour@projet-asso.iam.gserviceaccount.com'

describe('compte de service', () => {
  it('lit une clé de compte de service, et rien d’autre', () => {
    const cle = JSON.stringify({
      type: 'service_account',
      client_email: EMAIL,
      private_key: privateKey,
      token_uri: 'https://oauth2.googleapis.com/token',
      project_id: 'projet-asso',
    })
    expect(lireCleCompteService(cle)).toEqual({
      client_email: EMAIL,
      private_key: privateKey,
    })
    for (const [texte, motif] of [
      ['pas du json', /JSON/],
      [JSON.stringify({ type: 'authorized_user' }), /compte de service/],
      [
        JSON.stringify({
          type: 'service_account',
          client_email: 'personne@exemple.org',
          private_key: privateKey,
        }),
        /adresse/,
      ],
      [
        JSON.stringify({
          type: 'service_account',
          client_email: EMAIL,
          private_key: privateKey,
          token_uri: 'https://jetons.exemple.org/token',
        }),
        /autre service/,
      ],
    ] as const) {
      expect(() => lireCleCompteService(texte)).toThrow(motif)
    }
  })

  it('signe une assertion vérifiable par la clé publique', () => {
    const assertion = assertionCompteService(
      { client_email: EMAIL, private_key: privateKey },
      1_800_000_000
    )
    const [entete, contenu, signature] = assertion.split('.')
    expect(
      createVerify('RSA-SHA256')
        .update(`${entete}.${contenu}`)
        .verify(publicKey, Buffer.from(signature!, 'base64url'))
    ).toBe(true)
    expect(JSON.parse(Buffer.from(entete!, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    })
    expect(
      JSON.parse(Buffer.from(contenu!, 'base64url').toString())
    ).toMatchObject({
      iss: EMAIL,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/drive',
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    })
  })
})

describe('connexion par le compte de l’admin', () => {
  it('demande un accès hors ligne, avec PKCE', () => {
    const adresse = new URL(
      adresseAutorisationGoogle(
        {
          clientId: 'client',
          clientSecret: 'secret',
          retour:
            'https://orga.exemple.org/medias/espace-fichiers/retour/google',
        },
        'etat',
        'defi'
      )
    )
    expect(adresse.host).toBe('accounts.google.com')
    expect(Object.fromEntries(adresse.searchParams)).toMatchObject({
      access_type: 'offline',
      code_challenge: 'defi',
      code_challenge_method: 'S256',
      state: 'etat',
      scope: 'https://www.googleapis.com/auth/drive',
    })
  })

  it('n’admet que les hôtes de Google', () => {
    expect(
      hoteAdmis('https://www.googleapis.com/drive/v3/files', HOTES_GOOGLE)
    ).toBe(true)
    expect(hoteAdmis('https://googleapis.com.exemple.org/', HOTES_GOOGLE)).toBe(
      false
    )
  })
})

describe('requêtes de Drive', () => {
  it('échappe l’apostrophe et l’antislash d’un nom', () => {
    expect(litteral("L'équipe \\ A")).toBe("'L\\'équipe \\\\ A'")
  })
})

// ── Drive simulé ─────────────────────────────────────────────────────────────

interface Fichier {
  id: string
  name: string
  mimeType: string
  parents: string[]
  contenu?: string
  version: number
}

const DOSSIER = 'application/vnd.google-apps.folder'

/** Un Drive minimal : fichiers, recherche par parent et par nom, export, envoi. */
function driveSimule(fichiers: Fichier[]) {
  const appels: { methode: string; adresse: URL; corps?: string }[] = []
  const json = (valeur: unknown, statut = 200) =>
    new Response(JSON.stringify(valeur), {
      status: statut,
      headers: { 'content-type': 'application/json' },
    })
  const vue = (f: Fichier) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    parents: f.parents,
    version: String(f.version),
  })
  vi.stubGlobal('fetch', (entree: string, init: RequestInit = {}) => {
    const adresse = new URL(entree)
    const methode = init.method ?? 'GET'
    const corps =
      init.body === undefined
        ? undefined
        : Buffer.from(init.body as string).toString()
    appels.push({ methode, adresse, corps })
    const chemin = adresse.pathname
    if (chemin === '/drive/v3/files' && methode === 'GET') {
      const q = adresse.searchParams.get('q') ?? ''
      const parent = /'([^']+)' in parents/.exec(q)?.[1]
      const nom = /name = '((?:[^'\\]|\\.)*)'/
        .exec(q)?.[1]
        ?.replace(/\\(.)/g, '$1')
      return Promise.resolve(
        json({
          files: fichiers
            .filter(f => parent === undefined || f.parents.includes(parent))
            .filter(f => nom === undefined || f.name === nom)
            .map(vue),
        })
      )
    }
    const unFichier = /^\/drive\/v3\/files\/([^/]+)(\/export)?$/.exec(chemin)
    if (unFichier !== null && methode === 'GET') {
      const id = decodeURIComponent(unFichier[1]!)
      const f = fichiers.find(x => x.id === (id === 'root' ? 'racine' : id))
      if (f === undefined) return Promise.resolve(json({}, 404))
      if (unFichier[2] !== undefined)
        return Promise.resolve(
          new Response(`export ${adresse.searchParams.get('mimeType')}`)
        )
      if (adresse.searchParams.get('alt') === 'media')
        return Promise.resolve(new Response(f.contenu ?? ''))
      return Promise.resolve(json(vue(f)))
    }
    const envoi = /^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/.exec(chemin)
    if (envoi !== null) {
      if (envoi[1] !== undefined) {
        const f = fichiers.find(x => x.id === envoi[1])!
        f.contenu = corps
        f.version += 1
        return Promise.resolve(json({ version: String(f.version) }))
      }
      const meta = JSON.parse(/\{.*\}/.exec(corps!)![0]) as {
        name: string
        parents: string[]
      }
      fichiers.push({
        id: `f-${fichiers.length}`,
        name: meta.name,
        mimeType: 'text/markdown',
        parents: meta.parents,
        contenu: corps,
        version: 1,
      })
      return Promise.resolve(json({ version: '1' }))
    }
    return Promise.resolve(json({}, 404))
  })
  return appels
}

describe('Google Drive simulé', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const jeton = () => Promise.resolve('jeton')

  it('descend de la racine par nom, et liste un dossier', async () => {
    driveSimule([
      {
        id: 'racine',
        name: 'Mon Drive',
        mimeType: DOSSIER,
        parents: [],
        version: 1,
      },
      {
        id: 'd1',
        name: "L'équipe",
        mimeType: DOSSIER,
        parents: ['racine'],
        version: 1,
      },
      {
        id: 'f1',
        name: 'Plan.pdf',
        mimeType: 'application/pdf',
        parents: ['d1'],
        version: 3,
      },
      {
        id: 'g1',
        name: 'Compte rendu',
        mimeType: 'application/vnd.google-apps.document',
        parents: ['d1'],
        version: 2,
      },
    ])
    const espace = espaceGoogleDrive(jeton, { compteService: false })
    const position = {
      emplacement: 'mon-drive',
      base: null,
      chemin: ["L'équipe"],
    }
    expect(await espace.element(position)).toMatchObject({
      id: 'd1',
      dossier: true,
    })
    const liste = await espace.lister(position)
    expect(liste?.complet).toBe(true)
    expect(liste?.elements.map(e => [e.nom, e.etag])).toEqual([
      ['Plan.pdf', '3'],
      ['Compte rendu', '2'],
    ])
    expect(
      espace.convertitEnPdf(
        'Compte rendu',
        'application/vnd.google-apps.document'
      )
    ).toBe(true)
    expect(
      espace.convertitEnPdf(
        'Plan.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(false)
    const pdf = await espace.ouvrir(
      { ...position, chemin: ["L'équipe", 'Compte rendu'] },
      { pdf: true }
    )
    expect(await new Response(pdf.flux).text()).toBe('export application/pdf')
    expect(
      await espace.lireMarkdown!({
        ...position,
        chemin: ["L'équipe", 'Compte rendu'],
      })
    ).toBe('export text/markdown')
  })

  it('crée un fichier, puis le remplace', async () => {
    const appels = driveSimule([
      {
        id: 'racine',
        name: 'Mon Drive',
        mimeType: DOSSIER,
        parents: [],
        version: 1,
      },
      {
        id: 'd1',
        name: 'Export',
        mimeType: DOSSIER,
        parents: ['racine'],
        version: 1,
      },
    ])
    const espace = espaceGoogleDrive(jeton, { compteService: false })
    const position = {
      emplacement: 'mon-drive',
      base: 'd1',
      chemin: ['fiche.md'],
    }
    expect(await espace.ecrire(position, 'premier')).toEqual({ etag: '1' })
    const creation = appels.find(a => a.methode === 'POST')!
    expect(creation.adresse.searchParams.get('uploadType')).toBe('multipart')
    expect(await espace.ecrire(position, 'second')).toEqual({ etag: '2' })
    const remplacement = appels.find(a => a.methode === 'PATCH')!
    expect(remplacement.adresse.searchParams.get('uploadType')).toBe('media')
    expect(remplacement.corps).toBe('second')
  })
})
