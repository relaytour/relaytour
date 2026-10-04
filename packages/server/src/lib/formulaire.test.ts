import { describe, expect, it } from 'vitest'

import {
  contientUnLien,
  descriptionPubliable,
  FormulaireSchema,
  formulaireVide,
  lireFormulaire,
} from './formulaire.ts'

describe('contientUnLien', () => {
  it.each([
    'Voir https://exemple.org/page',
    'ftp://exemple.org',
    'mailto:personne@exemple.org',
    'www.exemple.org',
    'exemple.org',
    'Mon site : mon-club.fr',
    'Écrivez à personne@exemple.com',
  ])('refuse « %s »', texte => {
    expect(contientUnLien(texte)).toBe(true)
  })

  it.each([
    'J’ai déjà tenu une buvette.',
    'Disponible le samedi. Le dimanche aussi.',
    // Une espace manque après le point : ce n'est pas un nom de domaine.
    'Je tiens la table de marque.Merci',
    'Niveau : débutante, 2 h par semaine.',
  ])('accepte « %s »', texte => {
    expect(contientUnLien(texte)).toBe(false)
  })
})

describe('descriptionPubliable', () => {
  const role = { domaines: ['exemple.org'], adresses: [] }

  it('ne publie pas une description qui cite une adresse personnelle ou un numéro', () => {
    expect(
      descriptionPubliable('Écrire à jean@messagerie.example.', role)
    ).toBeNull()
    expect(descriptionPubliable('Appeler le 06 12 34 56 78.', role)).toBeNull()
  })

  it('publie une description sans coordonnée, ou avec une adresse de rôle', () => {
    expect(descriptionPubliable('Le pôle tient la buvette.', role)).toBe(
      'Le pôle tient la buvette.'
    )
    expect(descriptionPubliable('Écrire à buvette@exemple.org.', role)).toBe(
      'Écrire à buvette@exemple.org.'
    )
    expect(descriptionPubliable(null, role)).toBeNull()
  })
})

describe('réglage du formulaire', () => {
  it('borne l’introduction, la question et le nombre de paliers', () => {
    expect(
      FormulaireSchema.safeParse({ introduction: 'a'.repeat(601) }).success
    ).toBe(false)
    expect(
      FormulaireSchema.safeParse({ question: 'a'.repeat(121) }).success
    ).toBe(false)
    expect(
      FormulaireSchema.safeParse({
        paliers: Array.from({ length: 9 }, (_, i) => `Palier ${i}`),
      }).success
    ).toBe(false)
    expect(FormulaireSchema.safeParse({ inconnu: true }).success).toBe(false)
  })

  it('lit un réglage illisible comme un réglage vide', () => {
    expect(lireFormulaire(null)).toEqual({})
    expect(lireFormulaire({ paliers: 'pas une liste' })).toEqual({})
    expect(formulaireVide(lireFormulaire(null))).toBe(true)
    expect(formulaireVide({ paliers: ['Un soir'] })).toBe(false)
  })
})
