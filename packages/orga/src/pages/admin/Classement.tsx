import { useQuery } from '@apollo/client/react'
import { Alert, Empty, Select, Space } from 'antd'
import { useState } from 'react'

import Tableau from '../../composants/Tableau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { ClassementQuery } from '../../gql/graphql'
import { EDITIONS } from '../../lib/requetes'
import { useActivite } from '../../lib/activite'

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
  const { periode } = useActivite()
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
      <Titre
        sousTitre={`Les contributions de chaque personne sur ${periode.une}.`}
      >
        Classement
      </Titre>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Ce classement n’est visible que par les admins."
        description={`Chaque personne voit seulement son propre score. Un palmarès public se décide en fin ${periode.de}.`}
      />
      <Space style={{ marginBottom: 16 }}>
        <span>{periode.Nom}</span>
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
        <Empty description={`Créez d’abord ${periode.une}.`} />
      ) : (
        <Tableau<Ligne>
          id="classement"
          rowKey={l => l.personne.id}
          loading={loading}
          dataSource={data?.classement ?? []}
          pagination={false}
          locale={{ emptyText: `Aucune contribution pour ${periode.cette}.` }}
          colonnes={[
            {
              key: 'rang',
              title: 'Rang',
              dataIndex: 'rang',
              width: 90,
              tri: l => l.rang,
            },
            {
              key: 'personne',
              title: 'Personne',
              render: (_, l) => l.personne.nom,
              tri: l => l.personne.nom,
              recherche: l => l.personne.nom,
            },
            {
              key: 'points',
              title: 'Points',
              render: (_, l) => <strong>{l.score.points}</strong>,
              tri: l => l.score.points,
            },
            {
              key: 'tachesRealisees',
              title: 'Tâches réalisées',
              render: (_, l) => l.score.tachesRealisees,
              tri: l => l.score.tachesRealisees,
            },
            {
              key: 'tachesATemps',
              title: 'Dont à temps',
              render: (_, l) => l.score.tachesATemps,
              tri: l => l.score.tachesATemps,
            },
            {
              key: 'tachesCreees',
              title: 'Tâches créées',
              render: (_, l) => l.score.tachesCreees,
              tri: l => l.score.tachesCreees,
            },
            {
              key: 'fiches',
              title: 'Fiches créées ou modifiées',
              render: (_, l) => l.score.fichesCreees + l.score.fichesModifiees,
              tri: l => l.score.fichesCreees + l.score.fichesModifiees,
            },
          ]}
        />
      )}
    </>
  )
}
