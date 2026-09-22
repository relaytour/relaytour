import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { ApolloServer } from '@apollo/server'
import { prisma } from '@relaytour/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildContext, type AppContext } from '../context.ts'
import { construireExport, ecrireExport } from '../lib/export.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'
import { contexteDeTest } from '../test/contexte.ts'

import { schema } from './index.ts'

// Administration de l'installation (ADR 0008) : le jeton seul ouvre ces champs, et
// il n'ouvre rien d'autre. Un contrôle d'accès se prouve par le refus (invariant 11).

const s = randomUUID().slice(0, 8)
const apollo = new ApolloServer<AppContext>({ schema })
const slugA = `inst-a-${s}`
const slugB = `inst-b-${s}`
let adminDefaut = ''
let dossier = ''

type Contexte = 'anonyme' | 'administration' | 'session'

async function executer(
  qui: Contexte,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const contextValue =
    qui === 'administration'
      ? await buildContext('127.0.0.1', null, null, true)
      : qui === 'session'
        ? await contexteDeTest(adminDefaut)
        : await buildContext('127.0.0.1', null)
  const reponse = await apollo.executeOperation(
    { query, variables },
    { contextValue }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

const code = (r: Awaited<ReturnType<typeof executer>>) =>
  r.errors?.[0]?.extensions?.code

const ORGANISATIONS = `{ organisations { slug statut nombreMembres limites { activites periodesOuvertes }
  activites { slug nature archive periodesOuvertes { annee } } } }`
const CREER = `mutation ($slug: String!, $nom: String!, $limites: LimitesOrganisationInput) {
  creerOrganisation(slug: $slug, nom: $nom, domainesCourrielAutorises: ["exemple.org"], limites: $limites) {
    slug statut limites { activites periodesOuvertes } activites { slug nature }
  }
}`

beforeAll(async () => {
  await apollo.start()
  adminDefaut = randomUUID()
  await prisma.user.create({
    data: {
      id: adminDefaut,
      email: `admin-${s}@exemple.fr`,
      name: `admin ${s}`,
      isAdmin: true,
    },
  })
  dossier = await mkdtemp(path.join(os.tmpdir(), 'relaytour-export-'))
})

afterAll(async () => {
  const organisations = await prisma.organisation.findMany({
    where: { slug: { in: [slugA, slugB] } },
    select: { id: true },
  })
  const ids = organisations.map(o => o.id)
  await prisma.edition.deleteMany({ where: { organisationId: { in: ids } } })
  await prisma.perimetre.deleteMany({ where: { organisationId: { in: ids } } })
  await prisma.activite.deleteMany({ where: { organisationId: { in: ids } } })
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-${s}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({ where: { id: { in: ids } } })
  invaliderConfigurationOrganisation()
  await rm(dossier, { recursive: true, force: true })
  await apollo.stop()
})

describe('accès à l’administration de l’installation', () => {
  it('refuse une requête sans jeton', async () => {
    expect(code(await executer('anonyme', ORGANISATIONS))).toBe('FORBIDDEN')
  })

  it('refuse la session d’un admin d’organisation', async () => {
    expect(code(await executer('session', ORGANISATIONS))).toBe('FORBIDDEN')
    const r = await executer('session', CREER, {
      slug: `pirate-${s}`,
      nom: 'Pirate',
    })
    expect(code(r)).toBe('FORBIDDEN')
    expect(
      await prisma.organisation.count({ where: { slug: `pirate-${s}` } })
    ).toBe(0)
  })

  it('ne donne accès à aucune donnée d’organisation avec le jeton', async () => {
    for (const requete of [
      '{ personnes { id } }',
      '{ fiches { id } }',
      '{ activites { id } }',
      '{ moi { id } }',
    ]) {
      const r = await executer('administration', requete)
      if (requete === '{ moi { id } }') {
        expect(r.data?.moi).toBeNull()
      } else {
        expect(code(r)).toBe('FORBIDDEN')
      }
    }
  })

  it('n’expose aucun champ personnel dans ses types', () => {
    // Déroulé à la main : le test et le schéma peuvent charger deux copies de graphql.
    interface TypeGraphQL {
      name?: string
      ofType?: TypeGraphQL
      getFields?: () => Record<string, { type: TypeGraphQL }>
    }
    const nomme = (type: TypeGraphQL): TypeGraphQL =>
      type.ofType === undefined ? type : nomme(type.ofType)
    const racine = (champ: { type: unknown } | undefined) =>
      nomme(champ!.type as TypeGraphQL)
    const aVisiter: TypeGraphQL[] = [
      racine(schema.getQueryType()!.getFields().organisations),
      racine(schema.getMutationType()!.getFields().creerOrganisation),
      racine(
        schema.getMutationType()!.getFields().modifierOrganisationInstallation
      ),
    ]
    const champs: Record<string, string[]> = {}
    while (aVisiter.length > 0) {
      const type = aVisiter.pop()!
      const nom = type.name ?? ''
      // Les scalaires et les énumérations n'ont pas de champs.
      if (nom in champs || type.getFields === undefined) continue
      if (!('getInterfaces' in type)) continue
      const fields = type.getFields()
      champs[nom] = Object.keys(fields).sort()
      for (const def of Object.values(fields)) aVisiter.push(nomme(def.type))
    }
    // Liste fermée : un champ ajouté ici doit être relu au regard de l'ADR 0008.
    expect(champs).toEqual({
      OrganisationInstallation: [
        'activites',
        'creeLe',
        'limites',
        'nom',
        'nombreMembres',
        'slug',
        'statut',
      ],
      LimitesOrganisation: ['activites', 'periodesOuvertes'],
      ActiviteInstallation: [
        'archive',
        'nature',
        'nom',
        'periodesOuvertes',
        'slug',
      ],
      PeriodeInstallation: ['annee', 'debut', 'fin', 'nom', 'statut'],
    })
  })
})

describe('cycle de vie d’une organisation', () => {
  it('crée une organisation avec sa première activité et ses limites', async () => {
    const r = await executer('administration', CREER, {
      slug: slugA,
      nom: 'Association A',
      limites: { activites: 1, periodesOuvertes: 1 },
    })
    expect(r.errors).toBeUndefined()
    expect(r.data?.creerOrganisation).toEqual({
      slug: slugA,
      statut: 'ACTIVE',
      limites: { activites: 1, periodesOuvertes: 1 },
      activites: [{ slug: slugA, nature: 'EVENEMENT' }],
    })
  })

  it('refuse un slug déjà pris et une déclaration invalide', async () => {
    const doublon = await executer('administration', CREER, {
      slug: slugA,
      nom: 'Autre',
    })
    expect(code(doublon)).toBe('SAISIE_INVALIDE')
    const invalide = await executer('administration', CREER, {
      slug: 'Pas Un Slug',
      nom: 'X',
    })
    expect(code(invalide)).toBe('SAISIE_INVALIDE')
  })

  it('invite le premier admin sans renvoyer de donnée du compte', async () => {
    const r = await executer(
      'administration',
      `mutation ($o: String!, $e: String!) { inviterPremierAdmin(organisation: $o, email: $e, nom: "Première Admin") }`,
      { o: slugA, e: `premiere-${s}@exemple.fr` }
    )
    expect(r.data).toEqual({ inviterPremierAdmin: true })
    const appartenance = await prisma.appartenance.findFirst({
      where: {
        user: { email: `premiere-${s}@exemple.fr` },
        organisation: { slug: slugA },
      },
    })
    expect(appartenance?.role).toBe('ADMIN')
    // Le compte invité ouvre sa propre organisation, avec le rôle d'admin.
    const ctx = await buildContext('127.0.0.1', appartenance!.userId)
    expect(ctx.organisation?.slug).toBe(slugA)
    expect(ctx.personne?.estAdmin).toBe(true)
  })

  it('change le statut et retire une limite', async () => {
    const r = await executer(
      'administration',
      `mutation ($s: String!) {
        modifierOrganisationInstallation(slug: $s, statut: LECTURE_SEULE, limites: { periodesOuvertes: null }) {
          statut limites { activites periodesOuvertes }
        }
      }`,
      { s: slugA }
    )
    expect(r.errors).toBeUndefined()
    expect(r.data?.modifierOrganisationInstallation).toEqual({
      statut: 'LECTURE_SEULE',
      limites: { activites: 1, periodesOuvertes: null },
    })
  })

  it('liste les organisations avec leurs compteurs', async () => {
    const r = await executer('administration', ORGANISATIONS)
    const a = (
      r.data?.organisations as { slug: string; nombreMembres: number }[]
    ).find(o => o.slug === slugA)
    expect(a).toMatchObject({ slug: slugA, nombreMembres: 1 })
  })

  // La configuration de test ne définit pas EXPORTS_DIR.
  it.runIf(process.env.EXPORTS_DIR === undefined)(
    'refuse un export sans dossier configuré',
    async () => {
      const r = await executer(
        'administration',
        'mutation ($o: String!) { demanderExport(organisation: $o) }',
        { o: slugA }
      )
      expect(code(r)).toBe('SAISIE_INVALIDE')
    }
  )
})

describe('export d’une organisation', () => {
  it('écrit un fichier qui ne contient que l’organisation exportée', async () => {
    await executer('administration', CREER, {
      slug: slugB,
      nom: 'Association B',
    })
    await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `membre-b-${s}@exemple.fr`,
        name: 'Membre B',
        appartenances: {
          create: { organisation: { connect: { slug: slugB } } },
        },
      },
    })
    const { chemin } = await ecrireExport(slugA, dossier)
    const contenu = JSON.parse(await readFile(chemin, 'utf8')) as Awaited<
      ReturnType<typeof construireExport>
    >
    expect(contenu.format).toBe('relaytour-export')
    expect(contenu.version).toBe(1)
    expect(contenu.organisation.slug).toBe(slugA)
    expect(contenu.membres.map(m => m.email)).toEqual([
      `premiere-${s}@exemple.fr`,
    ])
    expect(JSON.stringify(contenu)).not.toContain(slugB)
    expect(JSON.stringify(contenu)).not.toContain(`membre-b-${s}`)
    expect(path.basename(chemin)).toMatch(new RegExp(`^${slugA}-`))
  })

  it('ne remplace jamais un fichier existant', async () => {
    const premier = await ecrireExport(slugA, dossier)
    const second = await ecrireExport(slugA, dossier)
    expect(second.chemin).not.toBe(premier.chemin)
  })
})
