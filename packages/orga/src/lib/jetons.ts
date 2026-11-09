import { graphql } from '../gql'
import type { EtatApi } from '../gql/graphql'

// Module « API » de l'organisation (ADR 0064), lu par les préférences et par
// l'écran « Organisation ».

export const API_ORGANISATION = graphql(`
  query ApiOrganisation {
    apiOrganisation {
      etat
      suspensionMotif
    }
  }
`)

/** Vrai quand les jetons de l'organisation répondent. */
export const apiOuverte = (etat: EtatApi | undefined): boolean =>
  etat === 'ACTIVE' || etat === 'IMPOSEE'
