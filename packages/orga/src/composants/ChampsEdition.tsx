import { useLingui } from '@lingui/react/macro'
import { Col, Form, Input, InputNumber, Row } from 'antd'

import { useActivite } from '../lib/activite'

/**
 * Champs communs à la création et à la modification d'une période : l'année, le
 * nom et les deux dates. À placer dans un formulaire antd qui porte les noms
 * `annee`, `nom`, `debut` et `fin`.
 */
export default function ChampsEdition({
  anneeModifiable,
}: {
  /** L'année ne change plus après la création. */
  anneeModifiable: boolean
}) {
  const { t } = useLingui()
  const { Nom: Mot } = useActivite().periode
  return (
    <>
      <Form.Item label={t`Année`} name="annee" rules={[{ required: true }]}>
        <InputNumber min={2020} max={2100} disabled={!anneeModifiable} />
      </Form.Item>
      <Form.Item
        label={t`Nom`}
        name="nom"
        rules={[{ required: true, message: t`Saisissez un nom.` }]}
      >
        <Input placeholder={t`${Mot} 2027`} />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t`Premier jour`}
            name="debut"
            rules={[{ required: true, message: t`Choisissez une date.` }]}
          >
            <Input type="date" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t`Dernier jour`}
            name="fin"
            dependencies={['debut']}
            rules={[
              { required: true, message: t`Choisissez une date.` },
              ({ getFieldValue }) => ({
                validator: (_, fin: string) =>
                  !fin || fin >= (getFieldValue('debut') as string)
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(t`Le dernier jour suit le premier.`)
                      ),
              }),
            ]}
          >
            <Input type="date" />
          </Form.Item>
        </Col>
      </Row>
    </>
  )
}
