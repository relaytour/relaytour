import { InfoCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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

/** Score personnel d'une période. Il n'est visible que par la personne et par les admins. */
export default function Contribution({
  editionId,
  nomEdition,
}: {
  editionId: string
  nomEdition: string
}) {
  const { t } = useLingui()
  const { data, loading } = useQuery(MON_SCORE, { variables: { editionId } })
  const score = data?.monScore
  const bareme = data?.baremeScore
  const pointsTacheRealisee = bareme?.tacheRealisee
  const pointsBonusATemps = bareme?.bonusATemps
  const pointsTacheCreee = bareme?.tacheCreee
  const pointsFicheCreee = bareme?.ficheCreee
  const pointsFicheModifiee = bareme?.ficheModifiee
  const points = score?.points ?? 0

  return (
    <Panneau
      titre={t`Votre contribution`}
      extra={
        bareme && (
          <Popover
            trigger={['hover', 'click']}
            title={t`Comment les points se calculent`}
            content={
              <ul style={{ margin: 0, paddingInlineStart: 18, maxWidth: 320 }}>
                <li>
                  <Trans>
                    Tâche réalisée : {pointsTacheRealisee} points, +
                    {pointsBonusATemps} si elle est faite à temps.
                  </Trans>
                </li>
                <li>
                  <Trans>Tâche créée : {pointsTacheCreee} point.</Trans>
                </li>
                <li>
                  <Trans>Fiche créée : {pointsFicheCreee} points.</Trans>
                </li>
                <li>
                  <Trans>
                    Fiche modifiée : {pointsFicheModifiee} points, une fois par
                    jour au plus.
                  </Trans>
                </li>
                <li>
                  <Trans>
                    Une tâche rouverte ou abandonnée perd ses points.
                  </Trans>
                </li>
              </ul>
            }
          >
            <Button
              type="text"
              shape="circle"
              size="small"
              icon={<InfoCircleOutlined aria-hidden />}
              aria-label={t`Comment les points se calculent`}
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
              {t`${plural(points, { one: 'point', other: 'points' })} pour ${nomEdition}`}
            </span>
          </div>
          <dl className="rt-tuiles" style={{ margin: 0 }}>
            {[
              [t`Tâches réalisées`, score.tachesRealisees],
              [t`Dont à temps`, score.tachesATemps],
              [t`Tâches créées`, score.tachesCreees],
              [t`Fiches`, score.fichesCreees + score.fichesModifiees],
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
        <Trans>Ce score n’est visible que par vous et par les admins.</Trans>
      </p>
    </Panneau>
  )
}
