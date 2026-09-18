import { graphql } from '../gql'

// Requêtes partagées par plusieurs écrans.

export const MOI = graphql(`
  query Moi {
    moi {
      id
      nom
      email
      estAdmin
    }
  }
`)

// Réservée aux personnes connectées : elle ne fait pas partie de la requête de session.
export const EDITION_COURANTE = graphql(`
  query EditionCourante {
    editionCourante {
      id
      annee
      nom
      debut
      fin
      statut
    }
  }
`)

export const EDITIONS = graphql(`
  query Editions {
    editions {
      id
      annee
      nom
      debut
      fin
      statut
    }
  }
`)

export const PERIMETRES = graphql(`
  query Perimetres($inclureArchives: Boolean) {
    perimetres(inclureArchives: $inclureArchives) {
      id
      slug
      nom
      type
      couleur
      ordre
      archive
    }
  }
`)
