import { CalendarOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { libelleJours } from '../lib/agenda'

import { Panneau } from './Panneau'

const REUNIONS = graphql(`
  query ReunionsDuPerimetre($editionId: ID!, $perimetreId: ID!) {
    reunions(editionId: $editionId, perimetreId: $perimetreId) {
      id
      titre
      jour
      heureDebut
      fin
      statut
      lieu
    }
  }
`)

/** Les cinq prochaines réunions d'un périmètre, dans la colonne de sa page (ADR 0037). */
export default function ReunionsDuPerimetre({
  perimetreId,
  editionId,
  peutModifier,
  onNouvelle,
}: {
  perimetreId: string
  editionId: string
  peutModifier: boolean
  onNouvelle: () => void
}) {
  const { t } = useLingui()
  const { lien } = useActivite()
  const { data } = useQuery(REUNIONS, {
    variables: { editionId, perimetreId },
    fetchPolicy: 'cache-and-network',
  })
  // Une réunion terminée quitte la liste, même le jour même : la comparaison
  // porte sur l'instant de fin, sans dépendre du fuseau du navigateur.
  const [maintenant] = useState(() => Date.now())
  const prochaines = (data?.reunions ?? [])
    .filter(
      r =>
        r.statut === 'PREVUE' &&
        new Date(r.fin as string).getTime() > maintenant
    )
    .slice(0, 5)

  return (
    <Panneau
      titre={t`Prochaines réunions`}
      icone={<CalendarOutlined aria-hidden />}
      extra={
        peutModifier && (
          <Button size="small" icon={<PlusOutlined />} onClick={onNouvelle}>
            {t({ message: 'Nouvelle', comment: 'Bouton : créer une réunion' })}
          </Button>
        )
      }
    >
      {prochaines.length === 0 ? (
        <p className="rt-texte-secondaire">
          <Trans>Aucune réunion à venir pour ce périmètre.</Trans>
        </p>
      ) : (
        <ul className="rt-liste-liens">
          {prochaines.map(r => (
            <li key={r.id}>
              <Link
                className="rt-ligne-lien"
                style={{ fontSize: 13.5 }}
                to={lien(`/agenda?edition=${editionId}&reunion=${r.id}`)}
              >
                <span className="rt-agenda-compacte-texte">
                  <span>{r.titre}</span>
                  <span className="rt-note" style={{ fontWeight: 400 }}>
                    {libelleJours(r.jour)} · {r.heureDebut}
                    {r.lieu ? ` · ${r.lieu}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        className="rt-note"
        to={lien(`/agenda?edition=${editionId}`)}
        style={{ alignSelf: 'flex-start' }}
      >
        <Trans>Voir l’agenda</Trans>
      </Link>
    </Panneau>
  )
}
