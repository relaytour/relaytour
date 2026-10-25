import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Form, Input, Modal, Select, Typography } from 'antd'
import { Link } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { EDITION_COURANTE, PERIMETRES } from '../lib/requetes'

// Invitation courte de la liste « Premiers pas » (ADR 0048) : un nom, une adresse
// et, si besoin, les périmètres de la période courante. Sans périmètre, la personne
// est rattachée à l'activité (ADR 0045). L'écran Personnes garde les autres
// réglages (plusieurs activités, rôles d'admin, souhaits).

const INVITER = graphql(`
  mutation InviterDansLActivite(
    $email: String!
    $nom: String!
    $activiteId: ID
    $editionId: ID
    $perimetresAffectes: [ID!]
  ) {
    inviterPersonne(
      email: $email
      nom: $nom
      activiteId: $activiteId
      editionId: $editionId
      perimetresAffectes: $perimetresAffectes
    ) {
      enAttente
    }
  }
`)

interface Valeurs {
  nom: string
  email: string
  perimetres?: string[]
}

export default function InvitationRapide({
  ouverte,
  onFermer,
  onInvitee,
}: {
  ouverte: boolean
  onFermer: () => void
  /** Appelé après une invitation réussie, pour relire ce qui en dépend. */
  onInvitee?: () => void
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { activite, lien, periode } = useActivite()
  const { cette } = periode
  const [form] = Form.useForm<Valeurs>()
  const { data: courante } = useQuery(EDITION_COURANTE, { skip: !ouverte })
  const { data: listes } = useQuery(PERIMETRES, { skip: !ouverte })
  const edition = courante?.editionCourante
  const perimetres = listes?.perimetres ?? []
  const [inviter, invitation] = useMutation(INVITER)

  const envoyer = async (v: Valeurs, encore: boolean) => {
    const choisis = v.perimetres ?? []
    try {
      const r = await inviter({
        variables: {
          email: v.email.trim(),
          nom: v.nom.trim(),
          ...(choisis.length > 0 && edition
            ? { editionId: edition.id, perimetresAffectes: choisis }
            : { activiteId: activite.id }),
        },
      })
      message.success(
        r.data?.inviterPersonne.enAttente
          ? t`Invitation envoyée. Cette adresse a déjà un compte : la personne accepte ou refuse depuis son compte.`
          : t`Invitation enregistrée. Une personne sans compte reçoit un mail avec le lien de connexion.`
      )
      onInvitee?.()
      if (encore) form.resetFields()
      else onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const soumettre = (encore: boolean) =>
    void form.validateFields().then(v => envoyer(v, encore))

  return (
    <Modal
      open={ouverte}
      title={t`Inviter une personne`}
      okText={t`Inviter`}
      cancelText={t`Fermer`}
      confirmLoading={invitation.loading}
      onOk={() => soumettre(false)}
      onCancel={onFermer}
      destroyOnHidden
      footer={(_, { OkBtn, CancelBtn }) => (
        <>
          <CancelBtn />
          <Button loading={invitation.loading} onClick={() => soumettre(true)}>
            {t`Inviter et continuer`}
          </Button>
          <OkBtn />
        </>
      )}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          label={t`Nom`}
          name="nom"
          rules={[{ required: true, message: t`Saisissez un nom.` }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          label={t`Adresse mail`}
          name="email"
          rules={[
            {
              required: true,
              type: 'email',
              message: t`Saisissez une adresse mail valide.`,
            },
          ]}
        >
          <Input type="email" autoComplete="off" />
        </Form.Item>
        {edition && perimetres.length > 0 && (
          <Form.Item
            label={t`Référent·e des périmètres`}
            name="perimetres"
            extra={t`Facultatif. Sans périmètre, la personne rejoint l’équipe de l’activité, et vous l’affectez plus tard pour ${cette}.`}
          >
            <Select
              mode="multiple"
              allowClear
              optionFilterProp="label"
              options={perimetres
                .filter(p => !p.archive)
                .map(p => ({ value: p.id, label: p.nom }))}
            />
          </Form.Item>
        )}
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <Trans>
            Pour nommer un admin ou inviter dans plusieurs activités, passez par
            l’écran{' '}
            <Link to={lien('/admin/personnes')} onClick={onFermer}>
              Personnes
            </Link>
            .
          </Trans>
        </Typography.Paragraph>
      </Form>
    </Modal>
  )
}
