import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { createTransport } from 'nodemailer'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { schema } from '../schema/index.ts'
import { contexteDeTest } from '../test/contexte.ts'

import {
  envoyerLienDExport,
  preparerExportPourAdmin,
} from './export-pour-admin.ts'
import { invaliderConfigurationOrganisation } from './organisation.ts'

// Export pour un admin d'une installation en sommeil (ADR 0057) : seule une adresse
// d'admin actif mène à un export, un lien part au plus une fois par 24 heures, et
// le dernier export part à tous les admins. Seul le jeton de l'installation ouvre
// les deux mutations. Un admin exporte aussi depuis l'application en lecture seule.

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const slug = `sommeil-${s}`
const slugAutre = `sommeil-autre-${s}`
const ids = {
  organisation: '',
  autre: '',
  adminFr: '',
  adminEn: '',
  archive: '',
  membre: '',
  adminAutre: '',
}
const adresse = (nom: string) => `${nom}-${s}@exemple.org`
let dossier = ''

async function creerOrganisation(
  slugOrganisation: string,
  statut: 'ACTIVE' | 'LECTURE_SEULE'
) {
  const configuration = {
    slug: slugOrganisation,
    nom: `Sommeil ${slugOrganisation}`,
    fuseauHoraire: 'Europe/Paris',
    domainesCourrielAutorises: ['exemple.org'],
    adressesRoleAutorisees: [],
  }
  return (
    await prisma.organisation.create({
      data: {
        slug: slugOrganisation,
        nom: configuration.nom,
        configuration,
        statut,
      },
      select: { id: true },
    })
  ).id
}

async function creerCompte(
  nom: string,
  role: 'ADMIN' | 'MEMBRE',
  options: { archiveLe?: Date; langue?: string } = {}
) {
  const id = randomUUID()
  await prisma.user.create({
    data: {
      id,
      name: nom,
      email: adresse(nom),
      langue: options.langue ?? null,
      appartenances: {
        create: {
          organisationId: ids.organisation,
          role,
          archiveLe: options.archiveLe ?? null,
        },
      },
    },
  })
  return id
}

/** Un transport qui garde les mails bruts, sans rien envoyer. */
function transportDeTest() {
  const transport = createTransport({ streamTransport: true, buffer: true })
  const envoi = vi.spyOn(transport, 'sendMail')
  const mails = () =>
    envoi.mock.calls.map(([options]) => ({
      a: options.to as string,
      sujet: options.subject ?? '',
      texte: options.text as string,
      repondreA: options.replyTo,
    }))
  return { transport, mails }
}

const fichiersEcrits = async () => readdir(dossier)

beforeAll(async () => {
  await apollo.start()
  ids.organisation = await creerOrganisation(slug, 'LECTURE_SEULE')
  ids.autre = await creerOrganisation(slugAutre, 'ACTIVE')
  invaliderConfigurationOrganisation()
  ids.adminFr = await creerCompte('admin-fr', 'ADMIN')
  ids.adminEn = await creerCompte('admin-en', 'ADMIN', { langue: 'en' })
  ids.archive = await creerCompte('archive', 'ADMIN', { archiveLe: new Date() })
  ids.membre = await creerCompte('membre', 'MEMBRE')
  dossier = await mkdtemp(path.join(os.tmpdir(), 'relaytour-sommeil-'))
})

afterAll(async () => {
  const comptes = [
    ids.adminFr,
    ids.adminEn,
    ids.archive,
    ids.membre,
    ids.adminAutre,
  ]
  await prisma.appartenance.deleteMany({ where: { userId: { in: comptes } } })
  await prisma.user.deleteMany({ where: { id: { in: comptes } } })
  await prisma.organisation.deleteMany({
    where: { id: { in: [ids.organisation, ids.autre] } },
  })
  invaliderConfigurationOrganisation()
  const { connection } = await import('../jobs/queues.ts')
  await connection.del(
    `export-admin:dernier-envoi:${ids.organisation}`,
    `export-admin:dernier-envoi:${ids.autre}`
  )
  await rm(dossier, { recursive: true, force: true })
  await apollo.stop()
})

describe('préparation d’un export pour un admin', () => {
  it('ne prépare rien pour une adresse qui n’est pas celle d’un admin actif', async () => {
    for (const brut of [
      adresse('inconnu'),
      adresse('membre'),
      adresse('archive'),
      'pas une adresse',
    ]) {
      expect(
        await preparerExportPourAdmin(prisma, slug, brut, dossier),
        brut
      ).toBeNull()
    }
    expect(await fichiersEcrits()).toEqual([])
  })

  it('écrit l’export et envoie le lien au seul admin qui l’a demandé, une fois par 24 heures', async () => {
    const prepare = await preparerExportPourAdmin(
      prisma,
      slug,
      `  ${adresse('admin-fr').toUpperCase()} `,
      dossier
    )
    expect(prepare).not.toBeNull()
    const { fichier, jeton } = prepare!
    // 32 octets en base64url : 43 caractères sans remplissage.
    expect(jeton).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await fichiersEcrits()).toEqual([fichier])
    const contenu = JSON.parse(
      await readFile(path.join(dossier, fichier), 'utf8')
    ) as { format: string; membres: { email: string }[] }
    expect(contenu.format).toBe('relaytour-export')
    expect(contenu.membres.map(m => m.email)).toContain(adresse('admin-en'))

    const { transport, mails } = transportDeTest()
    await envoyerLienDExport(prisma, slug, jeton, transport)
    const envoyes = mails()
    expect(envoyes.map(m => m.a)).toEqual([adresse('admin-fr')])
    const mail = envoyes[0]!
    expect(mail.texte).toContain(`/sommeil/telechargement/${jeton}`)
    expect(mail.texte).toContain('Vous avez demandé l’export des données')
    expect(mail.sujet).toContain('l’export de vos données')
    expect(mail.repondreA).toBeUndefined()

    // Le jeton ne sert qu'une fois.
    await expect(
      envoyerLienDExport(prisma, slug, jeton, transport)
    ).rejects.toThrow(/inconnu ou expiré/)
    // Un second export ne part pas avant 24 heures, même pour un autre admin.
    expect(
      await preparerExportPourAdmin(prisma, slug, adresse('admin-en'), dossier)
    ).toBeNull()
    expect(await fichiersEcrits()).toHaveLength(1)
  })

  it('envoie le dernier export à chaque admin actif, dans sa langue, sans limite de 24 heures', async () => {
    const prepare = await preparerExportPourAdmin(prisma, slug, null, dossier)
    expect(prepare).not.toBeNull()
    const { transport, mails } = transportDeTest()
    await envoyerLienDExport(prisma, slug, prepare!.jeton, transport)
    const envoyes = mails()
    expect(envoyes.map(m => m.a).sort()).toEqual(
      [adresse('admin-en'), adresse('admin-fr')].sort()
    )
    const anglais = envoyes.find(m => m.a === adresse('admin-en'))!
    expect(anglais.sujet).toContain('your data export')
    expect(anglais.texte).toContain('Here is the last export')
    const francais = envoyes.find(m => m.a === adresse('admin-fr'))!
    expect(francais.texte).toContain('Voici le dernier export')
  })

  it('refuse le jeton d’une autre organisation', async () => {
    const prepare = await preparerExportPourAdmin(prisma, slug, null, dossier)
    await expect(
      envoyerLienDExport(prisma, slugAutre, prepare!.jeton, null)
    ).rejects.toThrow(/inconnu ou expiré/)
  })

  it('ne prépare aucun dernier export pour une organisation sans admin', async () => {
    expect(
      await preparerExportPourAdmin(prisma, slugAutre, null, dossier)
    ).toBeNull()
  })
})

describe('mutations d’administration', () => {
  const PREPARER = `mutation ($o: String!, $c: String) {
    preparerExportPourAdmin(organisation: $o, courriel: $c) { fichier jeton }
  }`
  const ENVOYER = `mutation ($o: String!, $j: String!) {
    envoyerLienDExport(organisation: $o, jeton: $j)
  }`

  async function executer(
    contextValue: AppContext,
    query: string,
    variables: Record<string, unknown>
  ) {
    const reponse = await apollo.executeOperation(
      { query, variables },
      { contextValue }
    )
    if (reponse.body.kind !== 'single')
      throw new Error('Réponse incrémentale inattendue.')
    return reponse.body.singleResult
  }

  it('s’ouvrent au seul jeton de l’installation', async () => {
    // Un admin d'une organisation active : en lecture seule, toute mutation est
    // déjà refusée pour une session.
    ids.adminAutre = randomUUID()
    await prisma.user.create({
      data: {
        id: ids.adminAutre,
        name: 'admin autre',
        email: adresse('admin-autre'),
        appartenances: { create: { organisationId: ids.autre, role: 'ADMIN' } },
      },
    })
    for (const contexte of [
      await buildContext('127.0.0.1', null),
      await contexteDeTest(ids.adminAutre, slugAutre),
    ]) {
      for (const [query, variables] of [
        [PREPARER, { o: slugAutre, c: adresse('admin-autre') }],
        [ENVOYER, { o: slugAutre, j: 'jeton' }],
      ] as const) {
        const r = await executer(contexte, query, variables)
        expect(r.errors?.[0]?.extensions?.code, query).toBe('FORBIDDEN')
      }
    }
  })

  it('répond nul pour une adresse inconnue, sans rien écrire', async () => {
    const avant = await fichiersEcrits()
    const r = await executer(
      await buildContext('127.0.0.1', null, null, true),
      PREPARER,
      { o: slug, c: adresse('inconnu') }
    )
    expect(r.errors).toBeUndefined()
    expect(r.data).toEqual({ preparerExportPourAdmin: null })
    expect(await fichiersEcrits()).toEqual(avant)
  })
})

describe('export depuis l’application en lecture seule', () => {
  const EXPORT = 'query { exportOrganisation { nomFichier donnees } }'

  it('livre l’export complet à un admin, et le refuse à un membre', async () => {
    const admin = await apollo.executeOperation(
      { query: EXPORT },
      { contextValue: await contexteDeTest(ids.adminFr, slug) }
    )
    if (admin.body.kind !== 'single') throw new Error('Réponse inattendue.')
    expect(admin.body.singleResult.errors).toBeUndefined()
    const { nomFichier, donnees } = (
      admin.body.singleResult.data as {
        exportOrganisation: { nomFichier: string; donnees: string }
      }
    ).exportOrganisation
    expect(nomFichier).toMatch(
      new RegExp(`^export-${slug}-\\d{4}-\\d{2}-\\d{2}\\.json$`)
    )
    const contenu = JSON.parse(donnees) as {
      format: string
      membres: { email: string }[]
    }
    expect(contenu.format).toBe('relaytour-export')
    expect(contenu.membres.map(m => m.email)).toContain(adresse('membre'))

    const membre = await apollo.executeOperation(
      { query: EXPORT },
      { contextValue: await contexteDeTest(ids.membre, slug) }
    )
    if (membre.body.kind !== 'single') throw new Error('Réponse inattendue.')
    expect(membre.body.singleResult.errors?.[0]?.extensions?.code).toBe(
      'FORBIDDEN'
    )
  })
})
