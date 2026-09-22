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
      groupe
      couleur
      ordre
      archive
    }
  }
`)

// Les activités de l'organisation active, archivées comprises : une adresse peut
// désigner une activité archivée, toujours consultable (ADR 0008).
export const ACTIVITES = graphql(`
  query Activites {
    activites(inclureArchives: true) {
      id
      slug
      nom
      sigle
      nature
      ordre
      archive
      groupes {
        cle
        libelle
        libellePluriel
      }
    }
  }
`)

// Les organisations de la personne connectée, pour choisir l'organisation active.
export const MES_ORGANISATIONS = graphql(`
  query MesOrganisations {
    mesOrganisations {
      slug
      nom
      sigle
      estAdmin
      statut
      active
    }
  }
`)
