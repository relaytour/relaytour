import { useQuery } from '@apollo/client/react'
import { useLingui } from '@lingui/react/macro'
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
  const { t } = useLingui()
  const { periode, aModule } = useActivite()
  const periodeUne = periode.une
  const periodeCette = periode.cette
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
        sousTitre={t`Les contributions de chaque personne sur ${periodeUne}.`}
      >
        {t`Classement`}
      </Titre>
      {/* Le module « Classement » ouvre la page à toute l'équipe (ADR 0056). */}
      {aModule('CLASSEMENT') ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={t`Ce classement est visible par toute l’équipe de l’activité.`}
          description={t`Les admins de l’activité ont activé le module « Classement ». Le classement montre des totaux par personne, jamais le détail des tâches.`}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={t`Ce classement n’est visible que par les admins.`}
          description={t`Chaque personne voit seulement son propre score. Le module « Classement », dans l’écran « Activités », ouvre ce classement à toute l’équipe.`}
        />
      )}
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
        <Empty description={t`Créez d’abord ${periodeUne}.`} />
      ) : (
        <Tableau<Ligne>
          id="classement"
          rowKey={l => l.personne.id}
          loading={loading && !data}
          dataSource={data?.classement ?? []}
          pagination={false}
          locale={{ emptyText: t`Aucune contribution pour ${periodeCette}.` }}
          colonnes={[
            {
              key: 'rang',
              title: t`Rang`,
              dataIndex: 'rang',
              width: 90,
              tri: l => l.rang,
            },
            {
              key: 'personne',
              title: t`Personne`,
              render: (_, l) => l.personne.nom,
              tri: l => l.personne.nom,
              recherche: l => l.personne.nom,
            },
            {
              key: 'points',
              title: t`Points`,
              render: (_, l) => <strong>{l.score.points}</strong>,
              tri: l => l.score.points,
            },
            {
              key: 'tachesRealisees',
              title: t`Tâches réalisées`,
              render: (_, l) => l.score.tachesRealisees,
              tri: l => l.score.tachesRealisees,
            },
            {
              key: 'tachesATemps',
              title: t`Dont à temps`,
              render: (_, l) => l.score.tachesATemps,
              tri: l => l.score.tachesATemps,
            },
            {
              key: 'tachesCreees',
              title: t`Tâches créées`,
              render: (_, l) => l.score.tachesCreees,
              tri: l => l.score.tachesCreees,
            },
            {
              key: 'fiches',
              title: t`Fiches créées ou modifiées`,
              render: (_, l) => l.score.fichesCreees + l.score.fichesModifiees,
              tri: l => l.score.fichesCreees + l.score.fichesModifiees,
            },
          ]}
        />
      )}
    </>
  )
}
