import { useMutation, useQuery } from '@apollo/client/react'
import { plural, t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Alert, App, Modal, Space, Spin, Typography } from 'antd'

import { graphql } from '../gql'
import { messageErreur } from '../lib/erreurs'
import { EDITION_COURANTE, PREMIERS_PAS } from '../lib/requetes'

// Tâches types appliquées à une période (ADR 0048) : la fenêtre montre d'abord la
// simulation, puis crée les tâches et les effectifs qui manquent. Une tâche déjà
// créée depuis sa tâche type ne change pas.

const SIMULER = graphql(`
  query SimulerTachesTypes($editionId: ID!) {
    simulerTachesTypes(editionId: $editionId) {
      tachesCreees
      tachesDejaPresentes
      effectifsCrees
      conflits
      illisibles
    }
  }
`)

const APPLIQUER = graphql(`
  mutation AppliquerTachesTypes($editionId: ID!) {
    appliquerTachesTypes(editionId: $editionId) {
      tachesCreees
    }
  }
`)

interface Props {
  /** La période qui reçoit les tâches ; null ferme la fenêtre. */
  edition: { id: string; nom: string } | null
  onFermer: () => void
}

function nombreTaches(n: number): string {
  return t`${plural(n, { one: '# tâche', other: '# tâches' })}`
}

export default function TachesTypesEdition({ edition, onFermer }: Props) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { data, loading, error } = useQuery(SIMULER, {
    variables: { editionId: edition?.id ?? '' },
    skip: edition === null,
    fetchPolicy: 'network-only',
  })
  const [appliquer, application] = useMutation(APPLIQUER, {
    refetchQueries: [EDITION_COURANTE, PREMIERS_PAS],
  })
  const rapport = data?.simulerTachesTypes
  const aCreer = rapport?.tachesCreees.length ?? 0
  const effectifs = rapport?.effectifsCrees.length ?? 0
  const presentes = rapport?.tachesDejaPresentes.length ?? 0
  const illisibles = rapport?.illisibles.join(', ') ?? ''

  const valider = async () => {
    if (edition === null) return
    try {
      const resultat = await appliquer({ variables: { editionId: edition.id } })
      const creees =
        resultat.data?.appliquerTachesTypes.tachesCreees.length ?? 0
      message.success(
        t`${plural(creees, { one: '# tâche créée.', other: '# tâches créées.' })}`
      )
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const nomEdition = edition?.nom ?? ''
  const libelleACreer = nombreTaches(aCreer)

  return (
    <Modal
      open={edition !== null}
      title={t`Appliquer les tâches types à ${nomEdition}`}
      okText={aCreer === 0 ? t`Créer` : t`Créer ${libelleACreer}`}
      okButtonProps={{ disabled: aCreer === 0 && effectifs === 0 }}
      cancelText={t`Annuler`}
      confirmLoading={application.loading}
      onOk={() => void valider()}
      onCancel={onFermer}
      destroyOnHidden
    >
      {loading || rapport === undefined ? (
        error ? (
          <Alert type="error" showIcon title={messageErreur(error)} />
        ) : (
          <Spin />
        )
      ) : (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {aCreer === 0 && presentes === 0
              ? t`Les périmètres de l’activité n’ont aucune tâche type.`
              : t`${libelleACreer} à créer, ${plural(presentes, { one: '# déjà présente', other: '# déjà présentes' })}. Une tâche déjà présente ne change pas.`}
          </Typography.Paragraph>
          {effectifs > 0 && (
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {t`Les effectifs souhaités de ${plural(effectifs, { one: '# périmètre', other: '# périmètres' })} sont aussi créés.`}
            </Typography.Paragraph>
          )}
          {rapport.conflits.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={t`Certaines tâches partagées ne seront pas déclinées.`}
              description={
                <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                  {rapport.conflits.map(c => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              }
            />
          )}
          {rapport.illisibles.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={t`Les tâches types de ces périmètres sont illisibles et ne seront pas créées : ${illisibles}.`}
            />
          )}
        </Space>
      )}
    </Modal>
  )
}
