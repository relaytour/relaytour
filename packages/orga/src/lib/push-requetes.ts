import { graphql } from '../gql'

/** Retire du serveur l'abonnement push de cet appareil (ADR 0024). */
export const DESABONNER_PUSH = graphql(`
  mutation DesabonnerPush($adresse: String!) {
    desabonnerPush(adresse: $adresse)
  }
`)
