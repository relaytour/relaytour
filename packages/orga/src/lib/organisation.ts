import { themeParDefaut, type Theme } from '@relaytour/tokens'
import { createContext, useContext } from 'react'

import { graphql } from '../gql'

// L'identité de l'organisation, servie par l'API sans session (ADR 0006). Elle
// alimente le thème, la marque de la barre latérale, le titre de l'onglet et le
// favicon. Un seul build sert toutes les installations. Avant la connexion, le slug
// de l'organisation mémorisée par le navigateur désigne le thème (ADR 0008).

export const ORGANISATION = graphql(`
  query Organisation($slug: String) {
    organisation(slug: $slug) {
      slug
      nom
      sigle
      logoUrl
      faviconUrl
      pageEquipe
      theme {
        couleurs {
          encre
          primaire
          primaireClair
          accent
          accentClair
          succes
          succesClair
          alerte
          alerteClair
          erreur
          erreurClair
          sol1
          sol2
          sol3
        }
        fond {
          transition
          halo1 {
            couleur
            intensite
          }
          halo2 {
            couleur
            intensite
          }
        }
        polices {
          texte
          titre
          mono
        }
        typographie {
          graisseTitre
          graisseCorps
          espacementTitre
          echelleTitre
        }
      }
    }
  }
`)

export interface Organisation {
  slug: string
  nom: string
  sigle: string | null
  /** Le sigle s'il existe, sinon le nom. */
  nomCourt: string
  logoUrl: string | null
  faviconUrl: string | null
  pageEquipe: string | null
  theme: Theme
}

// Avant la réponse de l'API, ou si elle ne répond pas : le thème de Relaytour.
export const ORGANISATION_PAR_DEFAUT: Organisation = {
  slug: 'defaut',
  nom: 'Relaytour',
  sigle: null,
  nomCourt: 'Relaytour',
  logoUrl: null,
  faviconUrl: null,
  pageEquipe: null,
  theme: themeParDefaut,
}

export const ContexteOrganisation = createContext<Organisation>(
  ORGANISATION_PAR_DEFAUT
)

export function useOrganisation(): Organisation {
  return useContext(ContexteOrganisation)
}
