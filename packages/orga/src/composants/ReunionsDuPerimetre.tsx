import { CalendarOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Button } from 'antd'
import { Link } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { jourLocal, libelleJours } from '../lib/agenda'

import { Panneau } from './Panneau'

const REUNIONS = graphql(`
  query ReunionsDuPerimetre($editionId: ID!, $perimetreId: ID!) {
    reunions(editionId: $editionId, perimetreId: $perimetreId) {
      id
      titre
      jour
      heureDebut
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
  const { lien } = useActivite()
  const { data } = useQuery(REUNIONS, {
    variables: { editionId, perimetreId },
    fetchPolicy: 'cache-and-network',
  })
  const aujourdhui = jourLocal()
  const prochaines = (data?.reunions ?? [])
    .filter(r => r.statut === 'PREVUE' && r.jour >= aujourdhui)
    .slice(0, 5)

  return (
    <Panneau
      titre="Prochaines réunions"
      icone={<CalendarOutlined aria-hidden />}
      extra={
        peutModifier && (
          <Button size="small" icon={<PlusOutlined />} onClick={onNouvelle}>
            Nouvelle
          </Button>
        )
      }
    >
      {prochaines.length === 0 ? (
        <p className="rt-texte-secondaire">
          Aucune réunion à venir pour ce périmètre.
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
        Voir l’agenda
      </Link>
    </Panneau>
  )
}
