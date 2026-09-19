import { graphql } from '../gql'
import gabaritBrut from '../../../../content/exemple/modeles/fiche.md?raw'

/** Le gabarit commun (content/orga/modeles/fiche.md), sans son en-tête. */
export const GABARIT_FICHE = gabaritBrut.replace(/^---\n[\s\S]*?\n---\n+/, '')

export const FICHE = graphql(`
  query Fiche($slug: String!) {
    moi {
      id
      estAdmin
    }
    fiche(slug: $slug) {
      id
      slug
      titre
      contenu
      source
      archive
      modifieeLe
      modifieePar
      peutModifier
      donneesPersonnelles
      nombreVersions
      perimetre {
        id
        slug
        nom
        couleur
      }
    }
  }
`)

export const TACHES_FICHE = graphql(`
  query TachesFiche($slug: String!, $editionId: ID!) {
    fiche(slug: $slug) {
      id
      taches(editionId: $editionId) {
        id
        titre
        echeance
        statut
        enRetard
        perimetre {
          id
          slug
          nom
          couleur
        }
      }
    }
  }
`)

export const VERSIONS_FICHE = graphql(`
  query VersionsFiche($slug: String!) {
    fiche(slug: $slug) {
      id
      versionCouranteId
      versions {
        id
        titre
        contenu
        source
        resume
        creeLe
        auteur {
          id
          nom
        }
      }
    }
  }
`)

export const LISTE_FICHES = graphql(`
  query ListeFiches {
    fiches {
      id
      slug
      titre
      modifieeLe
      modifieePar
      source
      perimetre {
        id
        slug
        nom
        couleur
      }
    }
    peutRedigerFichesCommunes
  }
`)

export const CREER_FICHE = graphql(`
  mutation CreerFiche(
    $slug: String!
    $titre: String!
    $contenu: String!
    $perimetreId: ID
  ) {
    creerFiche(
      slug: $slug
      titre: $titre
      contenu: $contenu
      perimetreId: $perimetreId
    ) {
      id
      slug
    }
  }
`)

export const MODIFIER_FICHE = graphql(`
  mutation ModifierFiche(
    $id: ID!
    $titre: String!
    $contenu: String!
    $resume: String
  ) {
    modifierFiche(id: $id, titre: $titre, contenu: $contenu, resume: $resume) {
      id
      slug
      titre
      contenu
      modifieeLe
      modifieePar
      source
      donneesPersonnelles
    }
  }
`)

export const RESTAURER_VERSION = graphql(`
  mutation RestaurerVersionFiche($versionId: ID!) {
    restaurerVersionFiche(versionId: $versionId) {
      id
      titre
      contenu
      modifieeLe
      modifieePar
      source
    }
  }
`)

/** « Réserver la piscine » → « reserver-la-piscine ». */
export function slugDepuisTitre(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}
