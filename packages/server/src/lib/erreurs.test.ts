import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { GraphQLError } from 'graphql'
import { describe, expect, it } from 'vitest'

import { EspaceIndisponible, erreurEspace } from '../espace-fichiers/index.ts'
import { FournisseurIndisponible } from '../espace-fichiers/types.ts'
import {
  accesRefuse,
  erreurSaisie,
  formaterErreur,
  moduleInactif,
} from './erreurs.ts'

const SOURCES = fileURLToPath(new URL('..', import.meta.url))

/** Les fichiers TypeScript du serveur, hors tests. */
function sources(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(entree => {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) return sources(chemin)
    return entree.name.endsWith('.ts') && !entree.name.endsWith('.test.ts')
      ? [chemin]
      : []
  })
}

const formatee = (erreur: GraphQLError) => ({
  message: erreur.message,
  path: ['creerTache'],
  extensions: erreur.extensions,
})

describe('formaterErreur', () => {
  it('laisse passer une erreur à code connu', () => {
    for (const erreur of [
      erreurSaisie('Le titre est obligatoire.'),
      accesRefuse(),
    ]) {
      const f = formatee(erreur)
      expect(formaterErreur(f, erreur)).toBe(f)
    }
  })

  it('laisse passer un module inactif, avec son message et son code', () => {
    for (const erreur of [moduleInactif(), moduleInactif('hebergeur')]) {
      const f = formatee(erreur)
      const sortie = formaterErreur(f, erreur)
      expect(sortie.message).toBe(erreur.message)
      expect(sortie.message).not.toContain('référence')
      expect(sortie.extensions?.code).toBe('MODULE_INACTIF')
    }
  })

  it('laisse passer les erreurs de l’espace de fichiers', () => {
    for (const [cause, code] of [
      [new EspaceIndisponible(), 'ESPACE_FICHIERS_INDISPONIBLE'],
      [
        new FournisseurIndisponible('délai dépassé'),
        'FOURNISSEUR_INDISPONIBLE',
      ],
    ] as const) {
      const erreur = erreurEspace(cause)
      if (!(erreur instanceof GraphQLError)) throw erreur
      const f = formatee(erreur)
      const sortie = formaterErreur(f, erreur)
      expect(sortie.message).toBe(erreur.message)
      expect(sortie.extensions?.code).toBe(code)
    }
  })

  it('laisse passer chaque code qu’une erreur GraphQL du serveur pose', () => {
    const codes = new Set<string>()
    for (const fichier of sources(SOURCES)) {
      const texte = readFileSync(fichier, 'utf8')
      for (const [, code] of texte.matchAll(
        /extensions:\s*\{\s*code:\s*'([A-Z_]+)'/g
      )) {
        if (code && code !== 'INTERNAL_SERVER_ERROR') codes.add(code)
      }
    }
    expect(codes).toContain('MODULE_INACTIF')
    const masques = [...codes].filter(code => {
      const erreur = new GraphQLError('Message prévu.', {
        extensions: { code },
      })
      return formaterErreur(formatee(erreur), erreur).message !== erreur.message
    })
    expect(masques).toEqual([])
  })

  it('laisse passer une confirmation demandée, avec ses extensions', () => {
    const erreur = new GraphQLError(
      'Cette tâche est assignée à d’autres personnes.',
      {
        extensions: { code: 'CONFIRMATION_REQUISE', personnes: ['Camille'] },
      }
    )
    const f = formatee(erreur)
    expect(formaterErreur(f, erreur)).toBe(f)
    expect(f.extensions).toMatchObject({ personnes: ['Camille'] })
  })

  it('masque une erreur interne et garde une référence', () => {
    const prisma = new Error(
      "Invalid `prisma.tache.create()` invocation: The provided value for the column is too long for the column's type. Column: titre"
    )
    const erreur = new GraphQLError(prisma.message, { originalError: prisma })
    const f = {
      ...formatee(erreur),
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    }
    const masquee = formaterErreur(f, erreur)
    expect(masquee.message).not.toContain('prisma')
    expect(masquee.message).not.toContain('titre')
    expect(masquee.path).toEqual(['creerTache'])
    expect(masquee.extensions?.code).toBe('INTERNAL_SERVER_ERROR')
    const reference = masquee.extensions?.reference
    expect(reference).toMatch(/^[0-9a-f]{8}$/)
    expect(masquee.message).toContain(String(reference))
  })

  it('masque aussi une erreur sans code', () => {
    const erreur = new GraphQLError('No record found for findUniqueOrThrow')
    const masquee = formaterErreur(formatee(erreur), erreur)
    expect(masquee.message).not.toContain('findUniqueOrThrow')
    expect(masquee.extensions?.code).toBe('INTERNAL_SERVER_ERROR')
  })
})
