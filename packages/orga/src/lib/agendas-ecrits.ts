import { useQuery } from '@apollo/client/react'
import { useMemo } from 'react'

import { graphql } from '../gql'

import { useActivite } from './activite'
import { EDITIONS, PERIMETRES } from './requetes'

// Les agendas où la personne écrit pour une période (ADR 0037 et 0038) : l'agenda
// global et tous les périmètres pour un admin de l'activité, ses périmètres de la
// période sinon. Une période archivée n'en a aucun. Le serveur vérifie chaque
// écriture.

const AFFECTATIONS = graphql(`
  query AgendasEcrits($editionId: ID!) {
    moi {
      id
      affectations(editionId: $editionId) {
        id
        perimetre {
          id
        }
      }
    }
  }
`)

export interface AgendaEcrit {
  perimetreId: string | null
  nom: string
}

export function useAgendasEcrits(
  editionId: string | undefined,
  libelleGlobal = 'Toute l’activité'
): AgendaEcrit[] {
  const { gere } = useActivite()
  const { data: perimetres } = useQuery(PERIMETRES)
  const { data: editions } = useQuery(EDITIONS)
  const { data } = useQuery(AFFECTATIONS, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
  })
  return useMemo(() => {
    const edition = editions?.editions.find(e => e.id === editionId)
    if (!edition || edition.statut === 'ARCHIVEE') return []
    const tous = (perimetres?.perimetres ?? []).filter(p => !p.archive)
    if (gere) {
      return [
        { perimetreId: null, nom: libelleGlobal },
        ...tous.map(p => ({ perimetreId: p.id, nom: p.nom })),
      ]
    }
    const miens = new Set(
      (data?.moi?.affectations ?? []).map(a => a.perimetre.id)
    )
    return tous
      .filter(p => miens.has(p.id))
      .map(p => ({ perimetreId: p.id, nom: p.nom }))
  }, [gere, perimetres, editions, editionId, data, libelleGlobal])
}
