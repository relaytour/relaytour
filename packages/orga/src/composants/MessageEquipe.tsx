import { useQuery } from '@apollo/client/react'
import { useMemo } from 'react'

import { ADRESSES_EQUIPE } from '../lib/requetes-messages'

import EcrireMessage, { type CibleMessage } from './EcrireMessage'

/** Des personnes de l'équipe, désignées par leur identifiant. */
export interface CibleEquipe {
  personneIds: string[]
  /** Vrai quand le message va à toute l'équipe de la période. */
  toutLeMonde: boolean
  perimetreId?: string
}

interface Props {
  /** Les personnes à qui écrire, ou null quand la fenêtre est fermée. */
  cible: CibleEquipe | null
  fermer: () => void
  editionId?: string
  contactsPrincipaux: readonly string[]
}

/**
 * Fenêtre de rédaction ouverte depuis l'écran « Équipe » (ADR 0020). Cet écran ne
 * lit que des noms : les adresses de l'équipe se lisent ici, à l'ouverture.
 */
export default function MessageEquipe({ cible, ...reste }: Props) {
  const { data } = useQuery(ADRESSES_EQUIPE, {
    skip: cible === null,
    fetchPolicy: 'cache-and-network',
  })
  const equipe = data?.equipe
  const cibleMessage = useMemo<CibleMessage | null>(() => {
    if (cible === null || equipe === undefined) return null
    const choisies = new Set(cible.personneIds)
    return {
      destinataires: equipe
        .filter(p => choisies.has(p.id))
        .map(p => ({ id: p.id, nom: p.nom, email: p.email })),
      toutLeMonde: cible.toutLeMonde,
      perimetreId: cible.perimetreId,
    }
  }, [cible, equipe])
  return <EcrireMessage cible={cibleMessage} {...reste} />
}
