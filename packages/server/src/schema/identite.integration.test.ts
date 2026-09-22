import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { creerOrganisation } from '../lib/installation.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'
import { pngMinimal, SVG_EXEMPLE } from '../test/images.ts'

import { schema } from './index.ts'

// Identité de l'organisation et de ses activités (ADR 0009). Un contrôle d'accès
// se prouve par le refus (invariant 11) : un membre ne modifie rien, et l'admin
// d'une organisation ne touche jamais à l'identité d'une autre.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const ids = {
  orgA: '',
  orgB: '',
  activiteA: '',
  adminA: '',
  membreA: '',
  adminB: '',
}
const slugA = `ident-a-${s}`
const slugB = `ident-b-${s}`

async function executer(
  userId: string,
  organisation: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue: await buildContext('127.0.0.1', userId, organisation) }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

async function creerPersonne(
  cle: string,
  organisationId: string,
  role: 'ADMIN' | 'MEMBRE'
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      email: `${cle}-${s}@exemple.fr`,
      name: `${cle} ${s}`,
      appartenances: { create: [{ organisationId, role }] },
    },
  })
  return id
}

const TELEVERSER =
  'mutation ($f: FormatMedia!, $d: String!) { televerserMedia(format: $f, donnees: $d) { empreinte url } }'

const MODIFIER_ORGANISATION = `mutation ($nom: String!, $contact: String, $domaines: [String!]!, $adresses: [String!]!, $png: String, $svg: String, $theme: JSONObject) {
  modifierIdentiteOrganisation(nom: $nom, contactRecrutement: $contact, domainesCourrielAutorises: $domaines, adressesRoleAutorisees: $adresses, logoPng: $png, logoSvg: $svg, theme: $theme) {
    nom contactRecrutement adressesRoleAutorisees logoUrl contenuModifieLe
  }
}`

const MODIFIER_ACTIVITE = `mutation ($id: ID!, $contact: String, $png: String, $theme: JSONObject) {
  modifierIdentiteActivite(id: $id, contactRecrutement: $contact, logoPng: $png, theme: $theme) {
    id contactRecrutement logoUrl theme { couleurs { primaire } polices { titre } }
    identite { contactRecrutement logoPng }
  }
}`

beforeAll(async () => {
  ids.orgA = await creerOrganisation({
    slug: slugA,
    nom: 'Identité A',
    domainesCourrielAutorises: ['exemple.org'],
  })
  ids.orgB = await creerOrganisation({
    slug: slugB,
    nom: 'Identité B',
    domainesCourrielAutorises: ['exemple.org'],
  })
  ids.activiteA = (
    await prisma.activite.findFirstOrThrow({
      where: { organisationId: ids.orgA },
    })
  ).id
  ids.adminA = await creerPersonne('admin-a', ids.orgA, 'ADMIN')
  ids.membreA = await creerPersonne('membre-a', ids.orgA, 'MEMBRE')
  ids.adminB = await creerPersonne('admin-b', ids.orgB, 'ADMIN')
})

afterAll(async () => {
  const organisations = [ids.orgA, ids.orgB]
  await prisma.user.deleteMany({
    where: { id: { in: [ids.adminA, ids.membreA, ids.adminB] } },
  })
  await prisma.fiche.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.perimetre.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.activite.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.media.deleteMany({
    where: { organisationId: { in: organisations } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: organisations } } })
  invaliderConfigurationOrganisation()
})

describe('droits sur l’identité', () => {
  it('refuse à un membre de lire, modifier, téléverser ou exporter', async () => {
    for (const [query, variables] of [
      ['query { identiteOrganisation { nom } }', {}],
      ['query { exportContenu { nomFichier } }', {}],
      [TELEVERSER, { f: 'PNG', d: pngMinimal().toString('base64') }],
      [MODIFIER_ORGANISATION, { nom: 'Intrusion', domaines: [], adresses: [] }],
      [MODIFIER_ACTIVITE, { id: ids.activiteA, contact: null }],
    ] as const) {
      const r = await executer(ids.membreA, slugA, query, variables)
      expect(code(r), query).toBe('FORBIDDEN')
    }
    expect(
      await prisma.media.count({ where: { organisationId: ids.orgA } })
    ).toBe(0)
  })

  it('n’utilise jamais l’image d’une autre organisation', async () => {
    const r = await executer(ids.adminB, slugB, TELEVERSER, {
      f: 'PNG',
      d: pngMinimal(7).toString('base64'),
    })
    const empreinte = (r.data as { televerserMedia: { empreinte: string } })
      .televerserMedia.empreinte
    const refus = await executer(ids.adminA, slugA, MODIFIER_ORGANISATION, {
      nom: 'Identité A',
      domaines: ['exemple.org'],
      adresses: [],
      png: empreinte,
    })
    expect(code(refus)).toBe('SAISIE_INVALIDE')
  })
})

describe('adresses de rôle', () => {
  it('refuse une messagerie grand public comme domaine', async () => {
    const r = await executer(ids.adminA, slugA, MODIFIER_ORGANISATION, {
      nom: 'Identité A',
      domaines: ['exemple.org', 'gmail.com'],
      adresses: [],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).toMatch(/adresse complète/)
  })

  it('accepte une adresse complète de messagerie grand public en exception', async () => {
    const r = await executer(ids.adminA, slugA, MODIFIER_ORGANISATION, {
      nom: 'Identité A',
      contact: 'bureau.association@laposte.net',
      domaines: ['exemple.org'],
      adresses: ['Bureau.Association@laposte.net'],
    })
    expect(r.errors).toBeUndefined()
    const identite = (
      r.data as {
        modifierIdentiteOrganisation: {
          contactRecrutement: string
          adressesRoleAutorisees: string[]
          contenuModifieLe: string
        }
      }
    ).modifierIdentiteOrganisation
    expect(identite.adressesRoleAutorisees).toEqual([
      'bureau.association@laposte.net',
    ])
    expect(identite.contactRecrutement).toBe('bureau.association@laposte.net')
    expect(identite.contenuModifieLe).not.toBeNull()
  })

  it('refuse un contact d’activité hors des adresses de rôle', async () => {
    const r = await executer(ids.adminA, slugA, MODIFIER_ACTIVITE, {
      id: ids.activiteA,
      contact: 'prenom.nom@laposte.net',
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })
})

describe('logo, thème et contacts d’une activité', () => {
  it('téléverse un logo, refuse un SVG dangereux et un SVG pris pour un PNG', async () => {
    const svg = await executer(ids.adminA, slugA, TELEVERSER, {
      f: 'SVG',
      d: Buffer.from(SVG_EXEMPLE).toString('base64'),
    })
    expect(svg.errors).toBeUndefined()
    const script = await executer(ids.adminA, slugA, TELEVERSER, {
      f: 'SVG',
      d: Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64'),
    })
    expect(code(script)).toBe('SAISIE_INVALIDE')
    const faux = await executer(ids.adminA, slugA, TELEVERSER, {
      f: 'PNG',
      d: Buffer.from(SVG_EXEMPLE).toString('base64'),
    })
    expect(code(faux)).toBe('SAISIE_INVALIDE')
  })

  it('surcharge le logo et les couleurs, et garde les polices de l’organisation', async () => {
    const png = await executer(ids.adminA, slugA, TELEVERSER, {
      f: 'PNG',
      d: pngMinimal(42).toString('base64'),
    })
    const empreinte = (png.data as { televerserMedia: { empreinte: string } })
      .televerserMedia.empreinte
    const r = await executer(ids.adminA, slugA, MODIFIER_ACTIVITE, {
      id: ids.activiteA,
      contact: 'bureau.association@laposte.net',
      png: empreinte,
      theme: { couleurs: { primaire: '#2E5B3B' } },
    })
    expect(r.errors).toBeUndefined()
    const activite = (
      r.data as {
        modifierIdentiteActivite: {
          logoUrl: string
          theme: { couleurs: { primaire: string } }
          identite: { logoPng: string }
        }
      }
    ).modifierIdentiteActivite
    expect(activite.logoUrl).toBe(`/medias/${empreinte}.png`)
    expect(activite.theme.couleurs.primaire).toBe('#2E5B3B')
    expect(activite.identite.logoPng).toBe(empreinte)
  })

  it('refuse une police dans le thème d’une activité', async () => {
    const r = await executer(ids.adminA, slugA, MODIFIER_ACTIVITE, {
      id: ids.activiteA,
      theme: { polices: { titre: 'Inter' } },
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
  })

  it('refuse de retirer une adresse de rôle qu’une activité utilise', async () => {
    const r = await executer(ids.adminA, slugA, MODIFIER_ORGANISATION, {
      nom: 'Identité A',
      domaines: ['exemple.org'],
      adresses: [],
    })
    expect(code(r)).toBe('SAISIE_INVALIDE')
    expect(r.errors?.[0]?.message).toMatch(/ne serait plus valide/)
  })
})

describe('export du contenu en archive', () => {
  it('livre une archive zip lisible, sans donnée personnelle', async () => {
    const r = await executer(
      ids.adminA,
      slugA,
      'query { exportContenu { nomFichier donnees } }'
    )
    expect(r.errors).toBeUndefined()
    const archive = (
      r.data as { exportContenu: { nomFichier: string; donnees: string } }
    ).exportContenu
    expect(archive.nomFichier).toMatch(
      new RegExp(`^contenu-${slugA}-\\d{4}-\\d{2}-\\d{2}\\.zip$`)
    )
    const dossier = mkdtempSync(path.join(tmpdir(), 'relaytour-archive-'))
    try {
      const fichier = path.join(dossier, archive.nomFichier)
      writeFileSync(fichier, Buffer.from(archive.donnees, 'base64'))
      const liste = execFileSync('unzip', ['-Z1', fichier], {
        encoding: 'utf8',
      })
      expect(liste).toContain('organisation.yaml')
      expect(liste).toMatch(/medias\/logo\.png/)
      execFileSync('unzip', ['-q', fichier, '-d', path.join(dossier, 'x')])
      const organisation = readFileSync(
        path.join(dossier, 'x', 'organisation.yaml'),
        'utf8'
      )
      expect(organisation).toContain('bureau.association@laposte.net')
      expect(organisation).not.toContain(`admin-a-${s}`)
    } finally {
      rmSync(dossier, { recursive: true, force: true })
    }
  })
})
