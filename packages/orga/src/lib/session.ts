import { useApolloClient } from '@apollo/client/react'
import { useNavigate } from 'react-router'

import { seDeconnecter } from './connexion'

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
