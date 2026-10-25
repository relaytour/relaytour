import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Col, Form, Input, Row, Select } from 'antd'

import { NATURES } from '../lib/natures'

// Champs de la description d'une activité, partagés par l'écran Activités et la
// liste « Premiers pas » (ADR 0048) : sa nature et ses groupes de périmètres. À
// placer dans un formulaire antd qui porte les noms `nature` et `groupes`.

export function ChampNature() {
  const { t } = useLingui()
  return (
    <Form.Item
      label={t`Nature`}
      name="nature"
      extra={
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const aide = NATURES.find(
              n => n.value === getFieldValue('nature')
            )?.aide
            return aide ? t(aide) : undefined
          }}
        </Form.Item>
      }
    >
      <Select
        options={NATURES.map(({ value, label }) => ({
          value,
          label: t(label),
        }))}
      />
    </Form.Item>
  )
}

export function ChampGroupes() {
  const { t } = useLingui()
  return (
    <Form.Item
      label={t`Groupes de périmètres`}
      extra={t`Chaque périmètre appartient à un groupe : un sport, un pôle, une équipe, une commission…`}
    >
      <Form.List name="groupes">
        {(champs, { add, remove }) => (
          <>
            {champs.map(champ => (
              <Row gutter={8} key={champ.key} align="top">
                <Col xs={24} sm={7}>
                  <Form.Item
                    name={[champ.name, 'cle']}
                    rules={[
                      { required: true, message: t`Clé requise.` },
                      {
                        pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                        message: t`Minuscules, chiffres, tirets.`,
                      },
                    ]}
                  >
                    <Input placeholder={t`clé`} aria-label={t`Clé du groupe`} />
                  </Form.Item>
                </Col>
                <Col xs={11} sm={7}>
                  <Form.Item
                    name={[champ.name, 'libelle']}
                    rules={[{ required: true, message: t`Libellé requis.` }]}
                  >
                    <Input
                      placeholder={t`Équipe`}
                      aria-label={t`Libellé du groupe`}
                    />
                  </Form.Item>
                </Col>
                <Col xs={11} sm={8}>
                  <Form.Item
                    name={[champ.name, 'libellePluriel']}
                    rules={[{ required: true, message: t`Pluriel requis.` }]}
                  >
                    <Input
                      placeholder={t`Équipes`}
                      aria-label={t`Libellé pluriel du groupe`}
                    />
                  </Form.Item>
                </Col>
                <Col xs={2} sm={2}>
                  <Button
                    icon={<DeleteOutlined />}
                    aria-label={t`Retirer le groupe`}
                    disabled={champs.length === 1}
                    onClick={() => remove(champ.name)}
                  />
                </Col>
              </Row>
            ))}
            <Button
              icon={<PlusOutlined />}
              onClick={() => add({ cle: '', libelle: '', libellePluriel: '' })}
              disabled={champs.length >= 10}
            >
              <Trans>Ajouter un groupe</Trans>
            </Button>
          </>
        )}
      </Form.List>
    </Form.Item>
  )
}
