import { useQuery } from '@apollo/client/react'
import { Card, Col, Empty, Row, Skeleton, Space, Tag, Typography } from 'antd'
import { Link } from 'react-router'

import Avancement from '../composants/Avancement'
import Contribution from '../composants/Contribution'
import TacheCarte from '../composants/TacheCarte'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import { dateCourte } from '../lib/erreurs'
import { EDITION_COURANTE, MOI } from '../lib/requetes'

const MES_TACHES = graphql(`
  query MesTaches($editionId: ID!) {
    moi {
      id
      affectations(editionId: $editionId) {
        id
        perimetre {
          id
          slug
          nom
          type
          couleur
          referents(editionId: $editionId) {
            id
            nom
          }
          avancement(editionId: $editionId) {
            total
            faites
            abandonnees
            enRetard
            sansPersonne
          }
        }
      }
    }
    mesTaches(editionId: $editionId) {
      ...TacheChamps
    }
    tachesAPrendre(editionId: $editionId) {
      ...TacheChamps
    }
  }
`)

export default function MonEspace() {
  const { data: session } = useQuery(MOI)
  const { data: courante, loading: chargementEdition } =
    useQuery(EDITION_COURANTE)
  const edition = courante?.editionCourante
  const { data, loading } = useQuery(MES_TACHES, {
    variables: { editionId: edition?.id ?? '' },
    skip: !edition,
  })
  const moiId = session?.moi?.id ?? ''
  const estAdmin = session?.moi?.estAdmin ?? false
  const affectations = data?.moi?.affectations ?? []
  const referentsDe = (perimetreId: string) =>
    affectations.find(a => a.perimetre.id === perimetreId)?.perimetre
      .referents ?? []

  return (
    <>
      <Titre
        sousTitre={
          edition
            ? `${edition.nom}, du ${dateCourte(edition.debut)} au ${dateCourte(edition.fin)}`
            : chargementEdition
              ? ' '
              : 'Aucune édition n’est en préparation.'
        }
      >
        Bonjour {session?.moi?.nom}
      </Titre>

      {loading || chargementEdition ? (
        <Skeleton active />
      ) : !edition ? null : (
        <Space orientation="vertical" size={32} style={{ width: '100%' }}>
          <section>
            <Typography.Title level={4}>Vos tâches</Typography.Title>
            {(data?.mesTaches ?? []).length === 0 ? (
              <Card>
                <Empty description="Aucune tâche ouverte ne vous est assignée." />
              </Card>
            ) : (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                {data!.mesTaches.map(tache => (
                  <TacheCarte
                    key={tache.id}
                    tache={tache}
                    moiId={moiId}
                    peutModifier
                    referents={referentsDe(tache.perimetre.id)}
                    estAdmin={estAdmin}
                    afficherPerimetre
                  />
                ))}
              </Space>
            )}
          </section>

          {(data?.tachesAPrendre ?? []).length > 0 && (
            <section>
              <Typography.Title level={4}>
                À prendre dans vos périmètres
              </Typography.Title>
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                {data!.tachesAPrendre.map(tache => (
                  <TacheCarte
                    key={tache.id}
                    tache={tache}
                    moiId={moiId}
                    peutModifier
                    referents={referentsDe(tache.perimetre.id)}
                    estAdmin={estAdmin}
                    afficherPerimetre
                  />
                ))}
              </Space>
            </section>
          )}

          <section>
            <Typography.Title level={4}>Vos périmètres</Typography.Title>
            {affectations.length === 0 ? (
              <Card>
                <Empty description="Vous n’êtes affecté·e à aucun périmètre pour cette édition. Les admins gèrent les affectations." />
              </Card>
            ) : (
              <Row gutter={[16, 16]}>
                {affectations.map(({ id, perimetre }) => (
                  <Col key={id} xs={24} sm={12} lg={8}>
                    <Link to={`/perimetres/${perimetre.slug}`}>
                      <Card
                        hoverable
                        style={{
                          borderTop: `6px solid ${perimetre.couleur ?? '#2F6B4F'}`,
                        }}
                        title={perimetre.nom}
                        extra={
                          <Tag>
                            {perimetre.type === 'SPORT' ? 'Sport' : 'Pôle'}
                          </Tag>
                        }
                      >
                        <Avancement avancement={perimetre.avancement} compact />
                      </Card>
                    </Link>
                  </Col>
                ))}
              </Row>
            )}
          </section>

          <section>
            <Typography.Title level={4}>Votre contribution</Typography.Title>
            <Contribution editionId={edition.id} />
          </section>
        </Space>
      )}
    </>
  )
}
