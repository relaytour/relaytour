import { useMutation, useQuery } from '@apollo/client/react'
import {
  App,
  Button,
  Card,
  Form,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'

import { Section } from '../../composants/Panneau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { DroitsRedactionQuery } from '../../gql/graphql'
import { useActivite } from '../../lib/activite'
import { messageErreur } from '../../lib/erreurs'
import { PERIMETRES } from '../../lib/requetes'
import { useSession } from '../../lib/session'

const DROITS = graphql(`
  query DroitsRedaction($annuaire: Boolean!) {
    droitsRedaction {
      id
      accordeLe
      personne {
        id
        nom
      }
      perimetre {
        id
        nom
        activite {
          id
        }
      }
    }
    adminsOrganisation {
      id
      nom
    }
    equipe {
      id
      nom
      estAdmin
      activitesAdministrees
    }
    personnes @include(if: $annuaire) {
      id
      nom
      estAdmin
      activitesAdministrees
    }
  }
`)

const ACCORDER = graphql(`
  mutation AccorderDroitRedaction($personneId: ID!, $perimetreId: ID) {
    accorderDroitRedaction(personneId: $personneId, perimetreId: $perimetreId) {
      id
    }
  }
`)

const RETIRER = graphql(`
  mutation RetirerDroitRedaction($id: ID!) {
    retirerDroitRedaction(id: $id)
  }
`)

type Droit = DroitsRedactionQuery['droitsRedaction'][number]
interface Admin {
  id: string
  nom: string
  /** Vrai pour un admin de l'organisation, faux pour un admin de l'activité. */
  organisation: boolean
}
const TOUTES = 'toutes'

const parNom = (a: { nom: string }, b: { nom: string }) =>
  a.nom.localeCompare(b.nom, 'fr')

export default function Redaction() {
  // Un droit sur toutes les fiches vaut pour toute l'organisation : seul un admin de
  // l'organisation l'accorde (ADR 0010).
  const gereOrganisation = useSession().moi.estAdmin === true
  const { message } = App.useApp()
  // Un admin d'activité choisit dans son équipe ; un admin de l'organisation lit
  // l'annuaire (ADR 0018).
  const { data, loading } = useQuery(DROITS, {
    variables: { annuaire: gereOrganisation },
  })
  const { data: perimetres } = useQuery(PERIMETRES)
  const [form] = Form.useForm<{ personneId: string; perimetre: string }>()
  const [accorder, accord] = useMutation(ACCORDER, { refetchQueries: [DROITS] })
  const [retirer] = useMutation(RETIRER, { refetchQueries: [DROITS] })

  // Les admins de l'organisation et ceux de l'activité affichée rédigent déjà ses
  // fiches : ils sortent du choix et figurent dans leur propre liste. Tout admin
  // d'activité lit qui administre l'organisation (ADR 0019).
  const { activite } = useActivite()
  const deLOrganisation = new Set(
    (data?.adminsOrganisation ?? []).map(p => p.id)
  )
  const connues = [...(data?.personnes ?? data?.equipe ?? [])].sort(parNom)
  const admins: Admin[] = [
    ...(data?.adminsOrganisation ?? []).map(p => ({
      ...p,
      organisation: true,
    })),
    ...connues
      .filter(
        p =>
          !deLOrganisation.has(p.id) &&
          p.activitesAdministrees.includes(activite.id)
      )
      .map(p => ({ id: p.id, nom: p.nom, organisation: false })),
  ].sort(parNom)
  const estAdmin = new Set(admins.map(p => p.id))
  const autres = connues.filter(p => !estAdmin.has(p.id))
  // Un admin d'activité ne gère ici que l'activité affichée, même s'il en administre
  // une autre. Un admin de l'organisation lit tous les droits, dont ceux qui portent
  // sur toutes les fiches.
  const droits = (data?.droitsRedaction ?? [])
    .filter(d => gereOrganisation || d.perimetre?.activite.id === activite.id)
    .sort(
      (a, b) =>
        parNom(a.personne, b.personne) ||
        (a.perimetre?.nom ?? '').localeCompare(b.perimetre?.nom ?? '', 'fr')
    )

  const ajouter = async (v: { personneId: string; perimetre: string }) => {
    try {
      await accorder({
        variables: {
          personneId: v.personneId,
          perimetreId: v.perimetre === TOUTES ? null : v.perimetre,
        },
      })
      message.success('Droit accordé.')
      form.resetFields()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre sousTitre="Les admins rédigent toutes les fiches. Les autres personnes ont besoin d’un droit de rédaction.">
        Rédaction des fiches
      </Titre>

      <Card style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={v => void ajouter(v)}
          requiredMark={false}
        >
          <Form.Item
            name="personneId"
            rules={[{ required: true, message: 'Choisissez une personne.' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Personne"
              style={{ minWidth: 200 }}
              options={autres.map(p => ({
                value: p.id,
                label: p.nom,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="perimetre"
            rules={[{ required: true, message: 'Choisissez un périmètre.' }]}
          >
            <Select
              placeholder="Fiches concernées"
              style={{ minWidth: 220 }}
              options={[
                ...(gereOrganisation
                  ? [
                      {
                        value: TOUTES,
                        label: 'Toutes les fiches, communes comprises',
                      },
                    ]
                  : []),
                ...(perimetres?.perimetres ?? []).map(p => ({
                  value: p.id,
                  label: p.nom,
                })),
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={accord.loading}>
              Accorder
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <div className="rt-colonne" style={{ gap: 26 }}>
        <Section titre="Droits accordés" compte={droits.length}>
          <Table<Droit>
            rowKey="id"
            loading={loading}
            dataSource={droits}
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Personne', render: (_, d) => d.personne.nom },
              {
                title: 'Fiches',
                render: (_, d) => d.perimetre?.nom ?? 'Toutes les fiches',
              },
              {
                title: '',
                key: 'actions',
                render: (_, d) => (
                  <Space>
                    <Popconfirm
                      title="Retirer ce droit ?"
                      okText="Retirer"
                      cancelText="Annuler"
                      onConfirm={async () => {
                        try {
                          await retirer({ variables: { id: d.id } })
                          message.success('Droit retiré.')
                        } catch (e) {
                          message.error(messageErreur(e))
                        }
                      }}
                    >
                      <Button size="small" danger>
                        Retirer
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Section>

        <Section titre="Admins" compte={admins.length}>
          <p className="rt-texte-secondaire">
            Le rôle d’admin donne déjà la rédaction des fiches. Il se modifie
            depuis l’écran {gereOrganisation ? 'Admins' : 'Personnes'}.
          </p>
          <Table<Admin>
            rowKey="id"
            loading={loading}
            dataSource={admins}
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Personne', dataIndex: 'nom' },
              {
                title: 'Rôle',
                key: 'role',
                render: (_, p) =>
                  p.organisation ? (
                    <Tag color="blue">Admin de l’organisation</Tag>
                  ) : (
                    <Tag color="geekblue">Admin de l’activité</Tag>
                  ),
              },
              {
                title: 'Fiches',
                key: 'fiches',
                render: (_, p) =>
                  p.organisation
                    ? 'Toutes les fiches de l’organisation'
                    : 'Toutes les fiches de l’activité',
              },
              {
                title: '',
                key: 'actions',
                render: () => (
                  <Button size="small" disabled>
                    Rédaction déjà accordée
                  </Button>
                ),
              },
            ]}
          />
        </Section>
      </div>
    </>
  )
}
