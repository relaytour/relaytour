import { themeParDefaut, type Theme } from '@relaytour/tokens'
import { createContext, useContext } from 'react'

import { graphql } from '../gql'
import type { ThemeChampsFragment } from '../gql/graphql'

// L'identité de l'organisation, servie par l'API sans session (ADR 0006). Elle
// alimente le thème, la marque de la barre latérale, le titre de l'onglet et le
// favicon. Un seul build sert toutes les installations. Avant la connexion, le slug
// de l'organisation mémorisée par le navigateur désigne le thème (ADR 0008).

// Les champs d'un thème résolu : celui de l'organisation, ou celui d'une activité
// qui en surcharge les couleurs et le fond (ADR 0009).
export const THEME_CHAMPS = graphql(`
  fragment ThemeChamps on Theme {
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
`)

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
        ...ThemeChamps
      }
      codeSource
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
  /** Adresse du code source de l'installation (AGPL, article 13). */
  codeSource: string
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
  codeSource: 'https://github.com/relaytour/relaytour',
  theme: themeParDefaut,
}

export const ContexteOrganisation = createContext<Organisation>(
  ORGANISATION_PAR_DEFAUT
)

export function useOrganisation(): Organisation {
  return useContext(ContexteOrganisation)
}

/** Le thème servi par l'API, sous la forme attendue par les jetons. */
export function themeDepuisApi(theme: ThemeChampsFragment): Theme {
  return {
    couleurs: theme.couleurs,
    fond: theme.fond,
    polices: theme.polices,
    typographie: theme.typographie,
  } as Theme
}
