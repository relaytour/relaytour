import { UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
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

const STATUTS: Record<StatutDemande, { libelle: string; couleur?: string }> = {
  EN_ATTENTE: { libelle: 'En attente', couleur: 'gold' },
  ACCEPTEE: { libelle: 'Acceptée', couleur: 'green' },
  REFUSEE: { libelle: 'Refusée' },
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
      message.success('Votre proposition est transmise aux admins.')
      setOuvert(false)
      form.resetFields()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Panneau titre="Proposer une personne">
      <p className="rt-texte-secondaire" style={{ margin: 0 }}>
        Vous pouvez proposer une personne pour ce périmètre. Un admin examine la
        proposition, puis invite la personne.
      </p>
      <div>
        <Button icon={<UserAddOutlined />} onClick={() => setOuvert(true)}>
          Proposer une personne
        </Button>
      </div>
      {propositions.length > 0 && (
        <>
          <h3
            id="vos-propositions"
            style={{ margin: 0, fontSize: 14, fontWeight: 700 }}
          >
            Vos propositions
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
            {propositions.map(p => (
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
                  {STATUTS[p.statut].libelle}
                </Tag>
                {p.statut === 'EN_ATTENTE' && (
                  <Popconfirm
                    title="Retirer cette proposition ?"
                    okText="Retirer"
                    cancelText="Annuler"
                    onConfirm={() =>
                      retirer({ variables: { id: p.id } }).catch((e: unknown) =>
                        message.error(messageErreur(e))
                      )
                    }
                  >
                    <Button
                      size="small"
                      type="link"
                      aria-label={`Retirer la proposition de ${p.nom}`}
                      style={{ marginInlineStart: 'auto' }}
                    >
                      Retirer
                    </Button>
                  </Popconfirm>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        open={ouvert}
        title={`Proposer une personne pour ${perimetreNom}`}
        okText="Envoyer la proposition"
        cancelText="Annuler"
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
            label="Prénom et nom"
            name="nom"
            rules={[{ required: true, message: 'Saisissez un nom.' }]}
          >
            <Input maxLength={120} autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Adresse mail"
            name="email"
            extra="La personne ne reçoit aucun mail avant la décision d’un admin."
            rules={[
              {
                required: true,
                type: 'email',
                message: 'Saisissez une adresse mail valide.',
              },
            ]}
          >
            <Input type="email" autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Mot pour les admins (facultatif)"
            name="mot"
            extra="Par exemple sa disponibilité. Les admins de l’activité lisent ce mot."
          >
            <Input.TextArea rows={2} maxLength={280} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Panneau>
  )
}
