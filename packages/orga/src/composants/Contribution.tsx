import { InfoCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Button, Popover, Skeleton } from 'antd'

import { graphql } from '../gql'

import { Panneau } from './Panneau'

const MON_SCORE = graphql(`
  query MonScore($editionId: ID!) {
    monScore(editionId: $editionId) {
      points
      tachesRealisees
      tachesATemps
      tachesCreees
      fichesCreees
      fichesModifiees
    }
    baremeScore {
      tacheRealisee
      bonusATemps
      tacheCreee
      ficheCreee
      ficheModifiee
    }
  }
`)

/** Score personnel d'une édition. Il n'est visible que par la personne et par les admins. */
export default function Contribution({
  editionId,
  nomEdition,
}: {
  editionId: string
  nomEdition: string
}) {
  const { data, loading } = useQuery(MON_SCORE, { variables: { editionId } })
  const score = data?.monScore
  const bareme = data?.baremeScore

  return (
    <Panneau
      titre="Votre contribution"
      extra={
        bareme && (
          <Popover
            trigger={['hover', 'click']}
            title="Comment les points se calculent"
            content={
              <ul style={{ margin: 0, paddingInlineStart: 18, maxWidth: 320 }}>
                <li>
                  Tâche réalisée : {bareme.tacheRealisee} points, +
                  {bareme.bonusATemps} si elle est faite à temps.
                </li>
                <li>Tâche créée : {bareme.tacheCreee} point.</li>
                <li>Fiche créée : {bareme.ficheCreee} points.</li>
                <li>
                  Fiche modifiée : {bareme.ficheModifiee} points, une fois par
                  jour au plus.
                </li>
                <li>Une tâche rouverte ou abandonnée perd ses points.</li>
              </ul>
            }
          >
            <Button
              type="text"
              shape="circle"
              size="small"
              icon={<InfoCircleOutlined aria-hidden />}
              aria-label="Comment les points se calculent"
            />
          </Popover>
        )
      }
    >
      {loading || !score ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              className="rt-grand-nombre"
              style={{ color: 'var(--rt-primaire)' }}
            >
              {score.points}
            </span>
            <span className="rt-texte-secondaire">
              {score.points > 1 ? 'points' : 'point'} sur l’édition {nomEdition}
            </span>
          </div>
          <dl className="rt-tuiles" style={{ margin: 0 }}>
            {[
              ['Tâches réalisées', score.tachesRealisees],
              ['Dont à temps', score.tachesATemps],
              ['Tâches créées', score.tachesCreees],
              ['Fiches', score.fichesCreees + score.fichesModifiees],
            ].map(([libelle, valeur]) => (
              <div key={libelle} className="rt-tuile">
                <dt className="rt-libelle">{libelle}</dt>
                <dd className="rt-tuile-valeur" style={{ margin: 0 }}>
                  {valeur}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <p className="rt-note">
        Ce score n’est visible que par vous et par les admins.
      </p>
    </Panneau>
  )
}
