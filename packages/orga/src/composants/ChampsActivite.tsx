import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Checkbox, Col, Form, Input, Row, Select } from 'antd'

import type { ModuleActivite } from '../gql/graphql'
import { NATURES } from '../lib/natures'

// Champs de la description d'une activité, partagés par l'écran Activités et la
// liste « Premiers pas » (ADR 0048) : sa nature, ses groupes de périmètres et ses
// modules (ADR 0052). À placer dans un formulaire antd qui porte les noms
// `nature`, `groupes` et `modules`.

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

/** Les modules d'une activité (ADR 0052), dans l'ordre du menu. */
export function ChampModules({
  autorises,
}: {
  autorises: readonly ModuleActivite[]
}) {
  const { t } = useLingui()
  const modules: { cle: ModuleActivite; titre: string; detail: string }[] = [
    {
      cle: 'AGENDA',
      titre: t`Agenda`,
      detail: t`Réunions, sondages de dates, dates clés et abonnements à un agenda externe.`,
    },
    {
      cle: 'BENEVOLES',
      titre: t`Bénévoles`,
      detail: t`Fiches bénévoles, appels à bénévoles, candidatures et répartition dans le programme.`,
    },
    {
      cle: 'DOCUMENTS',
      titre: t`Documents`,
      detail: t`Documents du fournisseur cloud dans « Ressources » et documents liés aux fiches.`,
    },
  ]
  return (
    <Form.Item
      className="rt-choix"
      label={t`Modules`}
      name="modules"
      extra={t`Un module désactivé quitte le menu de toute l’équipe. Ses données restent enregistrées et réapparaissent quand vous le réactivez.`}
    >
      <Checkbox.Group>
        {modules.map(m => {
          const autorise = autorises.includes(m.cle)
          return (
            <Checkbox key={m.cle} value={m.cle} disabled={!autorise}>
              <span className="rt-choix-titre">{m.titre}</span>
              <span className="rt-choix-detail">
                {autorise
                  ? m.detail
                  : t`Votre hébergeur ne propose pas ce module à votre organisation.`}
              </span>
            </Checkbox>
          )
        })}
      </Checkbox.Group>
    </Form.Item>
  )
}
