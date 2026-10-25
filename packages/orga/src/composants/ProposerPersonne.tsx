import { UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Form, Input, Modal, Popconfirm, Tag } from 'antd'
import { useState } from 'react'

import { graphql } from '../gql'
import type { StatutDemande } from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'

import { Panneau } from './Panneau'

// Une personne affectée à un périmètre y propose une personne (ADR 0015). Un admin
// examine ensuite la proposition : aucun compte n'existe avant sa décision. Le panneau
// ne montre que les propositions de la personne connectée, sans adresse.

const MES_PROPOSITIONS = graphql(`
  query MesPropositions($perimetreId: ID!, $editionId: ID!) {
    mesPropositions(perimetreId: $perimetreId, editionId: $editionId) {
      id
      nom
      statut
    }
  }
`)

const PROPOSER = graphql(`
  mutation ProposerPersonne(
    $perimetreId: ID!
    $editionId: ID!
    $nom: String!
    $email: String!
    $mot: String
  ) {
    proposerPersonne(
      perimetreId: $perimetreId
      editionId: $editionId
      nom: $nom
      email: $email
      mot: $mot
    )
  }
`)

const RETIRER = graphql(`
  mutation RetirerProposition($id: ID!) {
    retirerProposition(id: $id)
  }
`)

const STATUTS: Record<
  StatutDemande,
  { libelle: MessageDescriptor; couleur?: string }
> = {
  EN_ATTENTE: {
    libelle: msg({
      message: 'En attente',
      comment: 'Statut d’une demande pour rejoindre l’équipe',
    }),
    couleur: 'gold',
  },
  ACCEPTEE: {
    libelle: msg({
      message: 'Acceptée',
      comment: 'Statut d’une demande pour rejoindre l’équipe',
    }),
    couleur: 'green',
  },
  REFUSEE: {
    libelle: msg({
      message: 'Refusée',
      comment: 'Statut d’une demande pour rejoindre l’équipe',
    }),
  },
}

interface Valeurs {
  nom: string
  email: string
  mot?: string
}

export default function ProposerPersonne({
  perimetreId,
  perimetreNom,
  editionId,
}: {
  perimetreId: string
  perimetreNom: string
  editionId: string
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const [ouvert, setOuvert] = useState(false)
  const [form] = Form.useForm<Valeurs>()
  const { data } = useQuery(MES_PROPOSITIONS, {
    variables: { perimetreId, editionId },
  })
  const rafraichir = { refetchQueries: ['MesPropositions'] }
  const [proposer, proposition] = useMutation(PROPOSER, rafraichir)
  const [retirer] = useMutation(RETIRER, rafraichir)
  const propositions = data?.mesPropositions ?? []

  const envoyer = async (v: Valeurs) => {
    try {
      await proposer({
        variables: {
          perimetreId,
          editionId,
          nom: v.nom,
          email: v.email,
          mot: v.mot ?? null,
        },
      })
      message.success(t`Votre proposition est transmise aux admins.`)
      setOuvert(false)
      form.resetFields()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Panneau titre={t`Proposer une personne`}>
      <p className="rt-texte-secondaire" style={{ margin: 0 }}>
        <Trans>
          Vous pouvez proposer une personne pour ce périmètre. Un admin examine
          la proposition, puis invite la personne.
        </Trans>
      </p>
      <div>
        <Button icon={<UserAddOutlined />} onClick={() => setOuvert(true)}>
          <Trans>Proposer une personne</Trans>
        </Button>
      </div>
      {propositions.length > 0 && (
        <>
          <h3
            id="vos-propositions"
            style={{ margin: 0, fontSize: 14, fontWeight: 700 }}
          >
            <Trans>Vos propositions</Trans>
          </h3>
          <ul
            aria-labelledby="vos-propositions"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              margin: 0,
              padding: 0,
              listStyle: 'none',
            }}
          >
            {propositions.map(p => {
              const nomPersonne = p.nom
              return (
                <li
                  key={p.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{p.nom}</span>
                  <Tag
                    color={STATUTS[p.statut].couleur}
                    style={{ marginInlineEnd: 0 }}
                  >
                    {t(STATUTS[p.statut].libelle)}
                  </Tag>
                  {p.statut === 'EN_ATTENTE' && (
                    <Popconfirm
                      title={t`Retirer cette proposition ?`}
                      okText={t`Retirer`}
                      cancelText={t`Annuler`}
                      onConfirm={() =>
                        retirer({ variables: { id: p.id } }).catch(
                          (e: unknown) => message.error(messageErreur(e))
                        )
                      }
                    >
                      <Button
                        size="small"
                        type="link"
                        aria-label={t`Retirer la proposition de ${nomPersonne}`}
                        style={{ marginInlineStart: 'auto' }}
                      >
                        <Trans>Retirer</Trans>
                      </Button>
                    </Popconfirm>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Modal
        open={ouvert}
        title={t`Proposer une personne pour ${perimetreNom}`}
        okText={t`Envoyer la proposition`}
        cancelText={t`Annuler`}
        confirmLoading={proposition.loading}
        onOk={() => form.submit()}
        onCancel={() => setOuvert(false)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={v => void envoyer(v)}
          requiredMark={false}
        >
          <Form.Item
            label={t`Prénom et nom`}
            name="nom"
            rules={[{ required: true, message: t`Saisissez un nom.` }]}
          >
            <Input maxLength={120} autoComplete="off" />
          </Form.Item>
          <Form.Item
            label={t`Adresse mail`}
            name="email"
            extra={t`La personne ne reçoit aucun mail avant la décision d’un admin.`}
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
          <Form.Item
            label={t`Mot pour les admins (facultatif)`}
            name="mot"
            extra={t`Par exemple sa disponibilité. Les admins de l’activité lisent ce mot.`}
          >
            <Input.TextArea rows={2} maxLength={280} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Panneau>
  )
}
