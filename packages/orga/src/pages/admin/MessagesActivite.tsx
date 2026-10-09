import { useQuery } from '@apollo/client/react'
import { useMemo } from 'react'
import { Link } from 'react-router'

import Messages from '../../composants/Messages'
import Titre from '../../composants/Titre'
import { useActivite } from '../../lib/activite'
import { ADRESSES_EQUIPE } from '../../lib/requetes-messages'
import { useSession } from '../../lib/session'

/**
 * L'historique des messages de l'activité affichée (ADR 0020, 0027). Les adresses
 * de l'équipe servent à rouvrir un message dans la messagerie.
 */
export default function MessagesActivite() {
  const { lien } = useActivite()
  const moiId = useSession().moi.id
  const { data } = useQuery(ADRESSES_EQUIPE, {
    fetchPolicy: 'cache-and-network',
  })
  // Un message ne s'écrit jamais à soi-même (ADR 0020).
  const personnes = useMemo(
    () =>
      (data?.equipe ?? [])
        .filter(p => p.id !== moiId)
        .map(p => ({ id: p.id, nom: p.nom, email: p.email })),
    [data, moiId]
  )

  return (
    <>
      <Titre
        sousTitre={
          <>
            Vous écrivez un message depuis l’écran{' '}
            <Link to={lien('/admin/equipe')}>Équipe</Link> ou depuis l’écran{' '}
            <Link to={lien('/admin/personnes')}>Personnes</Link>.
          </>
        }
      >
        Messages
      </Titre>
      <Messages annuaire={false} personnes={personnes} />
    </>
  )
}
