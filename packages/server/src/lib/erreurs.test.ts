import { GraphQLError } from 'graphql'
import { describe, expect, it } from 'vitest'

import { accesRefuse, erreurSaisie, formaterErreur } from './erreurs.ts'

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
