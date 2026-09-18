import { InfoCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import {
  Button,
  Card,
  Col,
  Popover,
  Row,
  Skeleton,
  Statistic,
  Typography,
} from 'antd'

import { graphql } from '../gql'

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
export default function Contribution({ editionId }: { editionId: string }) {
  const { data, loading } = useQuery(MON_SCORE, { variables: { editionId } })
  if (loading || !data) return <Skeleton active />
  const score = data.monScore
  const bareme = data.baremeScore

  return (
    <Card>
      <Row gutter={[24, 16]} align="middle">
        <Col xs={24} sm={8}>
          <div
            className="rt-titre"
            style={{
              fontSize: 'calc(56px * var(--rt-titre-echelle))',
              color: 'var(--rt-primaire)',
            }}
          >
            {score.points}
          </div>
          <Typography.Text type="secondary">
            points{' '}
            <Popover
              trigger={['hover', 'click']}
              title="Comment les points se calculent"
              content={
                <ul
                  style={{ margin: 0, paddingInlineStart: 18, maxWidth: 320 }}
                >
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
                size="small"
                icon={<InfoCircleOutlined aria-hidden />}
                aria-label="Comment les points se calculent"
              />
            </Popover>
          </Typography.Text>
        </Col>
        <Col xs={12} sm={4}>
          <Statistic title="Tâches réalisées" value={score.tachesRealisees} />
        </Col>
        <Col xs={12} sm={4}>
          <Statistic title="Dont à temps" value={score.tachesATemps} />
        </Col>
        <Col xs={12} sm={4}>
          <Statistic title="Tâches créées" value={score.tachesCreees} />
        </Col>
        <Col xs={12} sm={4}>
          <Statistic
            title="Fiches"
            value={score.fichesCreees + score.fichesModifiees}
          />
        </Col>
      </Row>
      <Typography.Paragraph
        type="secondary"
        style={{ margin: '16px 0 0', fontSize: 13 }}
      >
        Ce score n’est visible que par vous et par les admins.
      </Typography.Paragraph>
    </Card>
  )
}
