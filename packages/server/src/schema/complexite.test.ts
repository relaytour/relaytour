import { readFileSync } from 'node:fs'

import { ApolloServer } from '@apollo/server'
import { complexityFromQuery } from '@pothos/plugin-complexity'
import {
  Kind,
  parseType,
  visit,
  type DocumentNode,
  type FieldNode,
  type TypeNode,
} from 'graphql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '../context.ts'

import { schema } from './index.ts'

// Le schéma comporte des cycles (Perimetre.taches → Tache.perimetre). Une personne
// connectée ne doit pas pouvoir saturer le serveur avec une requête imbriquée.
// Ce test n'ouvre aucune connexion : le refus intervient avant tout résolveur.

const contexteConnecte: AppContext = {
  ip: '127.0.0.1',
  administration: false,
  jeton: null,
  refus: null,
  personne: {
    id: 'p1',
    nom: 'Test',
    email: 'test@exemple.fr',
    estAdmin: false,
  },
  perimetresAffectes: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  perimetresConnus: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  organisation: {
    id: 'o1',
    slug: 'rencontres',
    role: 'MEMBRE',
    statut: 'ACTIVE',
    fuseauHoraire: 'Europe/Paris',
  },
  activitesAdministrees: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  equipeAdministree: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  oublierLesEquipes: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  activitesVisibles: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  activitesDecouvertes: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  exigerActiviteDecouverte: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  estAdminDe: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  exigerAdminDe: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  exigerActivite: () => {
    throw new Error('Un résolveur a été appelé.')
  },
  exigerEdition: () => {
    throw new Error('Un résolveur a été appelé.')
  },
}

/** `perimetre { taches { perimetre { … } } }` sur `niveaux` niveaux de sélection. */
function requeteImbriquee(niveaux: number): string {
  // Sous la racine, le premier niveau est toujours `taches` ; on construit de l'intérieur.
  const enveloppes = niveaux - 2
  let selection = 'id'
  for (let i = 0; i < enveloppes; i += 1) {
    const rang = enveloppes - 1 - i
    selection =
      rang % 2 === 0
        ? `taches(editionId: "e1") { ${selection} }`
        : `perimetre { ${selection} }`
  }
  return `{ perimetre(slug: "x") { ${selection} } }`
}

const apollo = new ApolloServer<AppContext>({ schema })

beforeAll(() => apollo.start())
afterAll(() => apollo.stop())

async function executer(query: string) {
  const reponse = await apollo.executeOperation(
    { query },
    { contextValue: contexteConnecte }
  )
  if (reponse.body.kind !== 'single')
    throw new Error('Réponse incrémentale inattendue.')
  return reponse.body.singleResult
}

describe('limites de complexité des requêtes', () => {
  it('refuse une requête de profondeur 12 avant toute exécution', async () => {
    const resultat = await executer(requeteImbriquee(12))
    expect(resultat.data).toEqual({ perimetre: null })
    expect(resultat.errors).toHaveLength(1)
    const erreur = resultat.errors?.[0]
    expect(erreur?.extensions?.code).toBe('REQUETE_TROP_PROFONDE')
    expect(erreur?.extensions?.profondeur).toBe(12)
    expect(erreur?.message).toBe(
      'La requête est trop profonde (12 niveaux, maximum 8).'
    )
  })

  it('refuse une requête qui sélectionne plus de 100 champs', async () => {
    const champs = Array.from(
      { length: 101 },
      (_, i) => `c${i}: baremeScore { tacheRealisee }`
    )
    const resultat = await executer(`{ ${champs.join(' ')} }`)
    expect(resultat.errors?.[0]?.extensions?.code).toBe('REQUETE_TROP_LARGE')
  })

  it('refuse une requête trop coûteuse même sous la profondeur maximale', async () => {
    // Profondeur 8 (la limite), mais chaque niveau de liste multiplie le coût par 10 : 2 222 > 2 000.
    const resultat = await executer(requeteImbriquee(8))
    expect(resultat.errors?.[0]?.extensions?.code).toBe('REQUETE_TROP_COMPLEXE')
  })

  // Tâches partagées (ADR 0026) : l'espace organisateur lit le détail des
  // déclinaisons par la requête d'une seule tâche. Dans une liste de tâches, le
  // même détail dépasse le plafond avant tout résolveur.
  const DETAIL = `declinaisons {
    id titre echeance statut enRetard accord
    perimetre { id slug nom couleur }
    historiqueAccord { etape le par { id nom } }
  }`

  it('refuse le détail des déclinaisons dans une liste de tâches', async () => {
    const resultat = await executer(
      `{ perimetre(slug: "x") { taches(editionId: "e") { id ${DETAIL} } } }`
    )
    expect(resultat.errors?.[0]?.extensions?.code).toBe('REQUETE_TROP_COMPLEXE')
  })

  it('laisse passer le détail des déclinaisons d’une seule tâche', async () => {
    const resultat = await executer(`{ tache(id: "t") { id ${DETAIL} } }`)
    // La requête franchit les limites : elle atteint le résolveur, qui refuse faute
    // de contexte complet dans ce test.
    expect((resultat.errors ?? []).map(e => e.extensions?.code)).not.toContain(
      'REQUETE_TROP_COMPLEXE'
    )
  })

  // Appels à bénévoles (ADR 0041) : la file des candidatures et les bénévoles à
  // répartir portent des listes dans une liste. L'espace organisateur les lit en
  // entier, avec le __typename qu'ajoute Apollo.
  it.each([
    [
      'la file des candidatures',
      `{ candidatures(editionId: "e") { __typename id statut nom courriel telephone message precisionsDisponibilite ouAilleurs deposeeLe appelNom benevoleId peutEcarter
        plages { __typename jour heureDebut jourFin heureFin }
        choix { __typename id statut sequenceId titre jour heureDebut heureFin lieu peutTraiter perimetre { __typename id nom couleur } } } }`,
    ],
    [
      'les bénévoles à répartir',
      `{ benevolesARepartir(editionId: "e") { __typename cle candidatureId benevoleId nom precisionsDisponibilite message origine ouAilleurs adequation note
        plages { __typename debut fin jour heureDebut jourFin heureFin }
        choix { __typename sequenceId statut }
        places { __typename sequenceId debut fin } } }`,
    ],
  ])('laisse passer %s', async (_nom, requete) => {
    const resultat = await executer(requete)
    expect((resultat.errors ?? []).map(e => e.extensions?.code)).not.toContain(
      'REQUETE_TROP_COMPLEXE'
    )
  })

  it('laisse passer une requête simple jusqu’au résolveur', async () => {
    const resultat = await executer('{ baremeScore { tacheRealisee } }')
    expect(resultat.errors).toBeUndefined()
    const bareme = resultat.data?.baremeScore as { tacheRealisee: number }
    expect(typeof bareme.tacheRealisee).toBe('number')
  })
})

// Chaque requête de l'espace organisateur passe les limites du serveur, avec le
// __typename qu'Apollo ajoute à chaque sélection. Un fragment enrichi peut sinon
// faire échouer en silence un écran qui le lit plusieurs fois : « Mon espace » a
// ainsi dépassé le plafond de complexité en 0.24.0, et ses listes restaient vides.
const DOCUMENTS = [
  ...readFileSync(
    new URL('../../../orga/src/gql/graphql.ts', import.meta.url),
    'utf8'
  ).matchAll(
    /^export const (\w+)Document = (\{.*\}) as unknown as DocumentNode/gm
  ),
].map(([, nom, json]) => [nom!, JSON.parse(json!) as DocumentNode] as const)

const TYPENAME: FieldNode = {
  kind: Kind.FIELD,
  name: { kind: Kind.NAME, value: '__typename' },
}

/** Le document tel qu'Apollo l'envoie : un __typename dans chaque sélection. */
function avecTypename(document: DocumentNode): DocumentNode {
  return visit(document, {
    SelectionSet(selection, _cle, parent) {
      const racine =
        parent !== undefined &&
        !Array.isArray(parent) &&
        (parent as { kind?: string }).kind === Kind.OPERATION_DEFINITION
      const deja = selection.selections.some(
        s => s.kind === Kind.FIELD && s.name.value === '__typename'
      )
      return racine || deja
        ? undefined
        : { ...selection, selections: [...selection.selections, TYPENAME] }
    },
  })
}

/**
 * Une valeur factice d'un type d'entrée : seuls les champs requis sont remplis.
 * Le type se lit dans sa syntaxe : les classes du schéma viennent d'un autre
 * exemplaire du module `graphql`.
 */
function valeurFactice(type: TypeNode): unknown {
  if (type.kind === Kind.NON_NULL_TYPE) return valeurFactice(type.type)
  if (type.kind === Kind.LIST_TYPE) return [valeurFactice(type.type)]
  const nom = type.name.value
  const nomme = schema.getType(nom) as unknown as {
    getValues?: () => { name: string }[]
    getFields?: () => Record<
      string,
      { name: string; type: { toString(): string } }
    >
  } | null
  if (nomme?.getValues) return nomme.getValues()[0]!.name
  if (nomme?.getFields && !['ID', 'String'].includes(nom)) {
    return Object.fromEntries(
      Object.values(nomme.getFields())
        .filter(champ => champ.type.toString().endsWith('!'))
        .map(champ => [
          champ.name,
          valeurFactice(parseType(champ.type.toString())),
        ])
    )
  }
  if (nom === 'Int' || nom === 'Float') return 1
  if (nom === 'Boolean') return false
  if (nom === 'Date') return '2026-01-01'
  if (nom === 'DateTime') return '2026-01-01T00:00:00.000Z'
  if (nom === 'JSONObject') return {}
  return 'x'
}

function variablesFactices(document: DocumentNode): Record<string, unknown> {
  const variables: Record<string, unknown> = {}
  for (const definition of document.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue
    for (const v of definition.variableDefinitions ?? []) {
      variables[v.variable.name.value] = valeurFactice(v.type)
    }
  }
  return variables
}

describe('requêtes de l’espace organisateur', () => {
  it('trouve les documents générés', () => {
    expect(DOCUMENTS.length).toBeGreaterThan(100)
  })

  it.each(DOCUMENTS)('%s passe les limites du serveur', (_nom, document) => {
    const { complexity, breadth, depth } = complexityFromQuery(
      avecTypename(document),
      { schema, variables: variablesFactices(document) }
    )
    expect(complexity).toBeLessThanOrEqual(2_000)
    expect(breadth).toBeLessThanOrEqual(100)
    expect(depth).toBeLessThanOrEqual(8)
  })
})
