import { useQuery } from '@apollo/client/react'
import { Alert, Empty, Select, Space, Table } from 'antd'
import { useState } from 'react'

import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { ClassementQuery } from '../../gql/graphql'
import { EDITIONS } from '../../lib/requetes'

const CLASSEMENT = graphql(`
  query Classement($editionId: ID!) {
    classement(editionId: $editionId) {
      rang
      personne {
        id
        nom
      }
      score {
        points
        tachesRealisees
        tachesATemps
        tachesCreees
        fichesCreees
        fichesModifiees
      }
    }
  }
`)

type Ligne = ClassementQuery['classement'][number]

export default function Classement() {
  const { data: editions } = useQuery(EDITIONS)
  const [choix, setChoix] = useState<string | undefined>()
  const editionId =
    choix ?? editions?.editions.find(e => e.statut !== 'ARCHIVEE')?.id
  const { data, loading } = useQuery(CLASSEMENT, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
  })

  return (
    <>
      <Titre sousTitre="Les contributions de chaque personne sur une édition.">
        Classement
      </Titre>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Ce classement n’est visible que par les admins."
        description="Chaque personne voit seulement son propre score. Un palmarès public se décide en fin d’édition."
      />
      <Space style={{ marginBottom: 16 }}>
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
      ) : (
        <Table<Ligne>
          rowKey={l => l.personne.id}
          loading={loading}
          dataSource={data?.classement ?? []}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Aucune contribution pour cette édition.' }}
          columns={[
            { title: 'Rang', dataIndex: 'rang', width: 70 },
            { title: 'Personne', render: (_, l) => l.personne.nom },
            {
              title: 'Points',
              render: (_, l) => <strong>{l.score.points}</strong>,
            },
            {
              title: 'Tâches réalisées',
              render: (_, l) => l.score.tachesRealisees,
            },
            { title: 'Dont à temps', render: (_, l) => l.score.tachesATemps },
            { title: 'Tâches créées', render: (_, l) => l.score.tachesCreees },
            {
              title: 'Fiches créées ou modifiées',
              render: (_, l) => l.score.fichesCreees + l.score.fichesModifiees,
            },
          ]}
        />
      )}
    </>
  )
}
