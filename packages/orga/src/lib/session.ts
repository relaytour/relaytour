import { useApolloClient } from '@apollo/client/react'
import { createContext, useContext } from 'react'
import { useNavigate } from 'react-router'

import type { MesOrganisationsQuery, MoiQuery } from '../gql/graphql'

import { seDeconnecter } from './connexion'
import { choisirOrganisation } from './selection'

export type OrganisationDeLaPersonne =
  MesOrganisationsQuery['mesOrganisations'][number]

/** La session des écrans connectés : la personne, ses organisations, l'active. */
export interface Session {
  moi: NonNullable<MoiQuery['moi']>
  organisations: OrganisationDeLaPersonne[]
  active: OrganisationDeLaPersonne
}

export const ContexteSession = createContext<Session | null>(null)

/** La session des écrans connectés. Disponible sous la coquille seulement. */
export function useSession(): Session {
  const session = useContext(ContexteSession)
  if (session === null) throw new Error('useSession exige la coquille.')
  return session
}

/** Change l'organisation active (ADR 0008) : le cache repart de zéro, puis l'accueil s'ouvre. */
export function useChangerOrganisation(): (slug: string) => Promise<void> {
  const apollo = useApolloClient()
  const navigate = useNavigate()
  return async slug => {
    choisirOrganisation(slug)
    await apollo.resetStore()
    navigate('/', { replace: true })
  }
}

/** Ferme la session, vide le cache et renvoie vers la page de connexion. */
export function useDeconnexion(): () => Promise<void> {
  const apollo = useApolloClient()
  const navigate = useNavigate()
  return async () => {
    await seDeconnecter().catch(() => undefined)
    await apollo.clearStore()
    navigate('/connexion', { replace: true })
  }
}
