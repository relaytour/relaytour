import { useMutation, useQuery } from '@apollo/client/react'
import { Alert, App, Button, Popconfirm, Space, Tag, Typography } from 'antd'

import { graphql } from '../gql'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import { INVITATIONS_EN_ATTENTE } from '../lib/invitations'

const RELANCER = graphql(`
  mutation RelancerInvitation($id: ID!) {
    relancerInvitation(id: $id)
  }
`)

const RETIRER = graphql(`
  mutation RetirerInvitation($id: ID!) {
    retirerInvitation(id: $id)
  }
`)

/**
 * Les invitations qui attendent l'accord d'une personne (ADR 0030) : elle a déjà
 * un compte hors de l'organisation, et rien n'est créé en son nom avant son
 * accord. La liste montre ce que l'organisation a saisi, et rien du compte. Sans
 * invitation en attente, le composant n'affiche rien.
 */
export default function InvitationsEnAttente({
  activiteId,
}: {
  /** L'activité affichée ; sans elle, toutes les invitations de l'organisation. */
  activiteId?: string
}) {
  const { message } = App.useApp()
  const { data } = useQuery(INVITATIONS_EN_ATTENTE, {
    variables: { activiteId: activiteId ?? null },
  })
  const relire = { refetchQueries: [INVITATIONS_EN_ATTENTE] }
  const [relancer, relance] = useMutation(RELANCER)
  const [retirer, retrait] = useMutation(RETIRER, relire)
  const invitations = data?.invitationsEnAttente ?? []
  if (invitations.length === 0) return null

  const agir = async (action: () => Promise<unknown>, succes: string) => {
    try {
      await action()
      message.success(succes)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Alert
      type="info"
      style={{ marginBottom: 16 }}
      title={
        invitations.length === 1
          ? '1 invitation attend un accord'
          : `${invitations.length} invitations attendent un accord`
      }
      description={
        <>
          <p style={{ marginTop: 0 }}>
            Ces adresses ont déjà un compte hors de votre organisation. Chaque
            personne accepte ou refuse l’invitation depuis son compte. Rien
            n’est créé en son nom avant son accord, et elle n’apparaît pas dans
            l’équipe.
          </p>
          <ul className="rt-invitations">
            {invitations.map(i => (
              <li key={i.id}>
                <div>
                  <span style={{ fontWeight: 600 }}>{i.nom}</span>{' '}
                  <Typography.Text type="secondary">{i.email}</Typography.Text>
                  <div style={{ marginTop: 4 }}>
                    <Space size={[4, 4]} wrap>
                      {i.estAdmin && <Tag>Admin de l’organisation</Tag>}
                      {i.perimetresAffectes.map(p => (
                        <Tag
                          key={p.id}
                          style={{
                            borderInlineStart: `4px solid ${p.couleur ?? 'var(--rt-primaire)'}`,
                          }}
                        >
                          {p.nom}
                        </Tag>
                      ))}
                      {i.perimetresSouhaites.map(p => (
                        <Tag key={p.id} style={{ borderStyle: 'dashed' }}>
                          Souhait : {p.nom}
                        </Tag>
                      ))}
                      <Typography.Text type="secondary">
                        Expire le {jourDeLInstant(i.expireLe)}
                      </Typography.Text>
                    </Space>
                  </div>
                </div>
                <Space wrap>
                  <Button
                    size="small"
                    loading={relance.loading}
                    onClick={() =>
                      void agir(
                        () => relancer({ variables: { id: i.id } }),
                        'L’invitation est renvoyée.'
                      )
                    }
                  >
                    Relancer
                  </Button>
                  <Popconfirm
                    title="Retirer cette invitation ?"
                    description="La personne ne pourra plus l’accepter."
                    okText="Retirer"
                    cancelText="Annuler"
                    onConfirm={() =>
                      agir(
                        () => retirer({ variables: { id: i.id } }),
                        'L’invitation est retirée.'
                      )
                    }
                  >
                    <Button size="small" danger loading={retrait.loading}>
                      Retirer
                    </Button>
                  </Popconfirm>
                </Space>
              </li>
            ))}
          </ul>
        </>
      }
    />
  )
}
