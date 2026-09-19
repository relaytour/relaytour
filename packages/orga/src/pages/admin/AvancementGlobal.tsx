import { useQuery } from '@apollo/client/react'
import { Card, Col, Empty, Row, Select, Skeleton, Space, Statistic } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'

import Avancement from '../../composants/Avancement'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import { EDITIONS } from '../../lib/requetes'

const AVANCEMENT = graphql(`
  query AvancementGlobal($editionId: ID!) {
    avancementGlobal(editionId: $editionId) {
      perimetre {
        id
        slug
        nom
        couleur
        referents(editionId: $editionId) {
          id
          nom
        }
      }
      avancement {
        total
        aFaire
        enCours
        faites
        abandonnees
        enRetard
        sansPersonne
      }
    }
  }
`)

export default function AvancementGlobal() {
  const { data: editions } = useQuery(EDITIONS)
  const [choix, setChoix] = useState<string | undefined>()
  const editionId =
    choix ?? editions?.editions.find(e => e.statut !== 'ARCHIVEE')?.id
  const { data, loading } = useQuery(AVANCEMENT, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
  })
  const lignes = data?.avancementGlobal ?? []
  const totaux = lignes.reduce(
    (acc, { avancement: a }) => ({
      utiles: acc.utiles + a.total - a.abandonnees,
      faites: acc.faites + a.faites,
      enRetard: acc.enRetard + a.enRetard,
      sansPersonne: acc.sansPersonne + a.sansPersonne,
    }),
    { utiles: 0, faites: 0, enRetard: 0, sansPersonne: 0 }
  )

  return (
    <>
      <Titre sousTitre="Tâches faites, en retard et sans personne, périmètre par périmètre.">
        Avancement
      </Titre>
      <Space style={{ marginBottom: 24 }}>
        <span>Édition</span>
        <Select
          style={{ minWidth: 200 }}
          value={editionId}
          onChange={setChoix}
          options={(editions?.editions ?? []).map(e => ({
            value: e.id,
            label: e.nom,
          }))}
        />
      </Space>

      {editionId === undefined ? (
        <Empty description="Créez d’abord une édition." />
      ) : loading ? (
        <Skeleton active />
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="Tâches faites"
                  value={totaux.faites}
                  suffix={`/ ${totaux.utiles}`}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="En retard"
                  value={totaux.enRetard}
                  styles={
                    totaux.enRetard > 0
                      ? { content: { color: 'var(--rt-erreur)' } }
                      : undefined
                  }
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic title="Sans personne" value={totaux.sansPersonne} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic title="Périmètres" value={lignes.length} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            {lignes.map(({ perimetre, avancement }) => (
              <Col key={perimetre.id} xs={24} md={12} xl={8}>
                <Link to={`/perimetres/${perimetre.slug}?edition=${editionId}`}>
                  <Card
                    hoverable
                    className="rt-carte-lien"
                    title={perimetre.nom}
                    style={{
                      borderTop: `6px solid ${perimetre.couleur ?? 'var(--rt-primaire)'}`,
                      height: '100%',
                    }}
                  >
                    <Avancement avancement={avancement} compact />
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
                      {perimetre.referents.length > 0
                        ? perimetre.referents.map(r => r.nom).join(', ')
                        : 'Aucune personne affectée'}
                    </div>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        </>
      )}
    </>
  )
}
