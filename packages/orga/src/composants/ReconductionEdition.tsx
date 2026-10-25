import { useMutation, useQuery } from '@apollo/client/react'
import { plural, t } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, App, Form, Modal, Select, Space, Table, Tag } from 'antd'
import { useMemo, useState } from 'react'

import Tableau from './Tableau'
import { graphql } from '../gql'
import type { SimulerReconductionQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { dateCourte, messageErreur } from '../lib/erreurs'
import { EDITION_COURANTE } from '../lib/requetes'

// Reconduction d'une période (ADR 0048) : l'admin choisit la période source, lit
// ses tâches, toutes retenues sauf les tâches abandonnées, et décoche celles qu'il
// ne reprend pas. Les échéances gardent leur écart avec le premier jour.

const SIMULER = graphql(`
  query SimulerReconduction($sourceId: ID!, $cibleId: ID!) {
    simulerReconduction(sourceId: $sourceId, cibleId: $cibleId) {
      lignes {
        tacheId
        perimetre
        titre
        statutSource
        echeance
        declinaisons
        retenue
        etat
        raison
      }
      effectifsCrees
    }
  }
`)

const RECONDUIRE = graphql(`
  mutation ReconduireEdition($sourceId: ID!, $cibleId: ID!, $tacheIds: [ID!]) {
    reconduireEdition(
      sourceId: $sourceId
      cibleId: $cibleId
      tacheIds: $tacheIds
    ) {
      lignes {
        tacheId
        etat
      }
    }
  }
`)

type Ligne = SimulerReconductionQuery['simulerReconduction']['lignes'][number]

export interface PeriodeReconduction {
  id: string
  nom: string
}

interface Props {
  /** La période qui reçoit les tâches ; null ferme la fenêtre. */
  cible: PeriodeReconduction | null
  /** Les périodes de l'activité, la plus récente d'abord. */
  periodes: PeriodeReconduction[]
  /** La période source proposée à l'ouverture. */
  sourceInitiale?: string
  onFermer: () => void
}

function nombreTaches(n: number): string {
  return t`${plural(n, { one: '# tâche', other: '# tâches' })}`
}

export default function ReconductionEdition({
  cible,
  periodes,
  sourceInitiale,
  onFermer,
}: Props) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { periode } = useActivite()
  const { cette, nom: mot } = periode
  const sources = periodes.filter(p => p.id !== cible?.id)
  // L'écran parent remonte la fenêtre à chaque ouverture (clé) : la source et le
  // choix des tâches repartent de leur valeur initiale.
  const [sourceId, setSourceId] = useState<string | undefined>(
    sourceInitiale ?? sources[0]?.id
  )
  // null : les tâches retenues par défaut, tant que l'admin n'a rien coché.
  const [choix, setChoix] = useState<string[] | null>(null)

  const { data, loading, error } = useQuery(SIMULER, {
    variables: { sourceId: sourceId ?? '', cibleId: cible?.id ?? '' },
    skip: cible === null || sourceId === undefined,
    fetchPolicy: 'network-only',
  })
  const lignes = useMemo(() => data?.simulerReconduction.lignes ?? [], [data])
  const selection =
    choix ??
    lignes.filter(l => l.retenue && l.etat === 'A_CREER').map(l => l.tacheId)

  const [reconduire, reconduction] = useMutation(RECONDUIRE, {
    refetchQueries: [EDITION_COURANTE],
  })

  const valider = async () => {
    if (cible === null || sourceId === undefined) return
    try {
      const resultat = await reconduire({
        variables: { sourceId, cibleId: cible.id, tacheIds: selection },
      })
      const creees =
        resultat.data?.reconduireEdition.lignes.filter(
          l => selection.includes(l.tacheId) && l.etat === 'A_CREER'
        ).length ?? 0
      message.success(
        t`${plural(creees, { one: '# tâche reprise.', other: '# tâches reprises.' })}`
      )
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const effectifs = data?.simulerReconduction.effectifsCrees.length ?? 0
  const nomCible = cible?.nom ?? ''
  const aReprendre = nombreTaches(selection.length)

  return (
    <Modal
      open={cible !== null}
      title={t`Reprendre des tâches dans ${nomCible}`}
      width={960}
      okText={t`Reprendre ${aReprendre}`}
      okButtonProps={{ disabled: selection.length === 0 }}
      cancelText={t`Annuler`}
      confirmLoading={reconduction.loading}
      onOk={() => void valider()}
      onCancel={onFermer}
      destroyOnHidden
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {sources.length === 0 ? (
          <Alert
            type="info"
            showIcon
            title={t`L’activité n’a pas d’autre ${mot}.`}
          />
        ) : (
          <Form layout="vertical">
            <Form.Item
              label={t`Reprendre les tâches de`}
              extra={t`Chaque échéance garde le même écart avec le premier jour. Une tâche reprise repart à faire, sans personne assignée ni commentaire.`}
              style={{ marginBottom: 0 }}
            >
              <Select
                value={sourceId}
                onChange={id => {
                  setSourceId(id)
                  setChoix(null)
                }}
                options={sources.map(p => ({ value: p.id, label: p.nom }))}
              />
            </Form.Item>
          </Form>
        )}
        {error && (
          <Alert type="error" showIcon title={messageErreur(error)} />
        )}
        {effectifs > 0 && (
          <Alert
            type="info"
            showIcon
            title={t`Les effectifs souhaités de ${plural(effectifs, { one: '# périmètre', other: '# périmètres' })} sont aussi repris.`}
          />
        )}
        {sourceId !== undefined && (
          <Tableau<Ligne>
            id="reconduction"
            rowKey="tacheId"
            size="small"
            loading={loading}
            dataSource={lignes}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            locale={{ emptyText: t`Aucune tâche dans ${cette}.` }}
            rowSelection={{
              selectedRowKeys: selection,
              onChange: cles => setChoix(cles.map(String)),
              selections: [Table.SELECTION_ALL, Table.SELECTION_NONE],
              getCheckboxProps: l => {
                const titre = l.titre
                return {
                  disabled: l.etat !== 'A_CREER',
                  'aria-label': t`Reprendre ${titre}`,
                }
              },
            }}
            colonnes={[
              {
                key: 'perimetre',
                title: t`Périmètre`,
                width: 150,
                dataIndex: 'perimetre',
                tri: l => l.perimetre,
                filtre: {
                  options: [...new Set(lignes.map(l => l.perimetre))]
                    .sort()
                    .map(p => ({ text: p, value: p })),
                  valeurs: l => l.perimetre,
                },
              },
              {
                key: 'titre',
                title: t`Tâche`,
                tri: l => l.titre,
                recherche: l => l.titre,
                render: (_, l) => {
                  const n = l.declinaisons
                  return (
                    <Space size={4} wrap>
                      {l.titre}
                      {n > 0 && (
                        <Tag>
                          {t`partagée avec ${plural(n, { one: '# périmètre', other: '# périmètres' })}`}
                        </Tag>
                      )}
                      {l.etat === 'DEJA_PRESENTE' ? (
                        <Tag>
                          <Trans>Déjà présente</Trans>
                        </Tag>
                      ) : l.etat === 'ECARTEE' ? (
                        <Tag color="warning">{l.raison}</Tag>
                      ) : (
                        l.statutSource === 'ABANDONNEE' && (
                          <Tag>
                            <Trans>Abandonnée</Trans>
                          </Tag>
                        )
                      )}
                    </Space>
                  )
                },
              },
              {
                key: 'echeance',
                title: t`Échéance`,
                width: 130,
                tri: l => l.echeance ?? '',
                render: (_, l) => (l.echeance ? dateCourte(l.echeance) : '—'),
              },
            ]}
          />
        )}
      </Space>
    </Modal>
  )
}
