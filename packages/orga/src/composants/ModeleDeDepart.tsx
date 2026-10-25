import { useMutation, useQuery } from '@apollo/client/react'
import { plural, t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Alert, App, Modal, Space, Spin, Tag, Typography } from 'antd'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { ACTIVITES, EDITION_COURANTE, PERIMETRES } from '../lib/requetes'

// Modèle de départ (ADR 0048) : la fenêtre décrit les périmètres, les tâches types
// et les fiches du modèle, puis les crée dans l'activité, qui n'a encore aucun
// périmètre. L'admin les modifie ensuite comme les siens.

const SIMULER = graphql(`
  query SimulerModeleDeDepart {
    simulerModeleDeDepart(modele: EVENEMENT_MULTISPORTS) {
      perimetres {
        slug
        nom
        groupe
        tachesTypes
      }
      fiches
      groupesAjoutes
      fichesEnConflit
      periode
      tachesCreees
    }
  }
`)

const APPLIQUER = graphql(`
  mutation AppliquerModeleDeDepart {
    appliquerModeleDeDepart(modele: EVENEMENT_MULTISPORTS) {
      perimetres {
        slug
      }
      tachesCreees
    }
  }
`)

function nombreTachesTypes(n: number): string {
  return t`${plural(n, { one: '# tâche type', other: '# tâches types' })}`
}

export default function ModeleDeDepart({
  ouverte,
  onFermer,
}: {
  ouverte: boolean
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { libelleGroupe } = useActivite()
  const { data, loading, error } = useQuery(SIMULER, {
    skip: !ouverte,
    fetchPolicy: 'network-only',
  })
  const [appliquer, application] = useMutation(APPLIQUER, {
    refetchQueries: [ACTIVITES, PERIMETRES, EDITION_COURANTE],
  })
  const rapport = data?.simulerModeleDeDepart
  const nombreTaches = rapport?.tachesCreees.length ?? 0
  const nomPeriode = rapport?.periode ?? ''
  const conflits = rapport?.fichesEnConflit.join(', ') ?? ''
  const fiches = rapport?.fiches.join(' · ') ?? ''

  const valider = async () => {
    try {
      const r = await appliquer()
      const perimetres = r.data?.appliquerModeleDeDepart.perimetres.length ?? 0
      message.success(
        t`${plural(perimetres, { one: '# périmètre créé.', other: '# périmètres créés.' })}`
      )
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={ouverte}
      title={t`Partir d’un modèle : événement multisports`}
      width={640}
      okText={t`Appliquer le modèle`}
      okButtonProps={{ disabled: rapport === undefined }}
      cancelText={t`Annuler`}
      confirmLoading={application.loading}
      onOk={() => void valider()}
      onCancel={onFermer}
      destroyOnHidden
    >
      {error ? (
        <Alert type="error" showIcon title={messageErreur(error)} />
      ) : loading || rapport === undefined ? (
        <Spin />
      ) : (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {t`Le modèle décrit un rassemblement sportif fictif. Vous renommez, archivez ou complétez ensuite chaque élément comme le vôtre.`}
          </Typography.Paragraph>
          <ul className="rt-liste-modele">
            {rapport.perimetres.map(p => (
              <li key={p.slug}>
                <strong>{p.nom}</strong> <Tag>{libelleGroupe(p.groupe)}</Tag>
                <span className="rt-texte-secondaire">
                  {nombreTachesTypes(p.tachesTypes)}
                </span>
              </li>
            ))}
          </ul>
          {rapport.fiches.length > 0 && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {t`Fiches : ${fiches}.`}
            </Typography.Paragraph>
          )}
          {rapport.periode !== null && (
            <Alert
              type="info"
              showIcon
              title={t`${plural(nombreTaches, { one: '# tâche sera créée', other: '# tâches seront créées' })} dans ${nomPeriode}.`}
            />
          )}
          {rapport.fichesEnConflit.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={t`Une autre activité porte déjà ces fiches, qui ne seront pas reprises : ${conflits}.`}
            />
          )}
        </Space>
      )}
    </Modal>
  )
}
