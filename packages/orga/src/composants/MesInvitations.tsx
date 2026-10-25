import { useMutation } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Modal, Popconfirm, Space, Tag, Typography } from 'antd'

import { graphql } from '../gql'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import { MES_INVITATIONS, useMesInvitations } from '../lib/invitations'
import { useChangerOrganisation } from '../lib/session'

const ACCEPTER = graphql(`
  mutation AccepterInvitation($id: ID!) {
    accepterInvitation(id: $id)
  }
`)

const REFUSER = graphql(`
  mutation RefuserInvitation($id: ID!) {
    refuserInvitation(id: $id)
  }
`)

/**
 * La liste des invitations de la personne, avec « Accepter » et « Refuser ».
 * Accepter fait de la personne une membre de l'organisation, puis l'y emmène.
 * Refuser efface l'invitation, sans rien dire à l'organisation.
 */
export function InvitationsRecues() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const invitations = useMesInvitations()
  const changerOrganisation = useChangerOrganisation()
  const [accepter, acceptation] = useMutation(ACCEPTER)
  const [refuser, refus] = useMutation(REFUSER, {
    refetchQueries: [MES_INVITATIONS],
  })

  if (invitations.length === 0) {
    return (
      <Typography.Paragraph type="secondary">
        <Trans>Aucune invitation n’attend votre accord.</Trans>
      </Typography.Paragraph>
    )
  }
  return (
    <>
      <Typography.Paragraph>
        <Trans>
          Vous avez déjà un compte. Une organisation qui vous invite ne lit rien
          de ce compte et ne vous compte pas dans son équipe avant votre accord.
        </Trans>
      </Typography.Paragraph>
      <ul className="rt-invitations">
        {invitations.map(i => {
          const nomOrganisation = i.organisationNom
          const jourExpiration = jourDeLInstant(i.expireLe)
          return (
            <li key={i.id}>
              <div>
                <span style={{ fontWeight: 600 }}>{i.organisationNom}</span>
                <div style={{ marginTop: 4 }}>
                  <Space size={[4, 4]} wrap>
                    {i.estAdmin && (
                      <Tag>
                        <Trans>Rôle d’admin</Trans>
                      </Tag>
                    )}
                    {i.perimetres.map(p => (
                      <Tag key={p}>{p}</Tag>
                    ))}
                    <Typography.Text type="secondary">
                      <Trans>Expire le {jourExpiration}</Trans>
                    </Typography.Text>
                  </Space>
                </div>
              </div>
              <Space wrap>
                <Button
                  type="primary"
                  size="small"
                  loading={acceptation.loading}
                  onClick={() =>
                    void accepter({ variables: { id: i.id } }).then(
                      r => {
                        const slug = r.data?.accepterInvitation
                        message.success(
                          t`Vous faites partie de ${nomOrganisation}.`
                        )
                        if (slug !== undefined) return changerOrganisation(slug)
                      },
                      (e: unknown) => message.error(messageErreur(e))
                    )
                  }
                >
                  <Trans>Accepter</Trans>
                </Button>
                <Popconfirm
                  title={t`Refuser cette invitation ?`}
                  description={t`L’organisation n’en est pas informée.`}
                  okText={t`Refuser`}
                  cancelText={t`Annuler`}
                  onConfirm={() =>
                    refuser({ variables: { id: i.id } }).then(
                      () => message.success(t`L’invitation est refusée.`),
                      (e: unknown) => message.error(messageErreur(e))
                    )
                  }
                >
                  <Button size="small" loading={refus.loading}>
                    <Trans>Refuser</Trans>
                  </Button>
                </Popconfirm>
              </Space>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** La fenêtre des invitations, ouverte depuis le menu du compte. */
export default function MesInvitations({
  ouvert,
  onFermer,
}: {
  ouvert: boolean
  onFermer: () => void
}) {
  const { t } = useLingui()
  return (
    <Modal
      title={t`Vos invitations`}
      open={ouvert}
      onCancel={onFermer}
      footer={null}
      destroyOnHidden
    >
      <InvitationsRecues />
    </Modal>
  )
}
