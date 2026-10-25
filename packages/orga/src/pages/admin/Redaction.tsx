import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Card, Form, Popconfirm, Select, Space, Tag } from 'antd'

import { Section } from '../../composants/Panneau'
import Tableau from '../../composants/Tableau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { DroitsRedactionQuery } from '../../gql/graphql'
import { useActivite } from '../../lib/activite'
import { messageErreur } from '../../lib/erreurs'
import { PERIMETRES } from '../../lib/requetes'
import { useSession } from '../../lib/session'
import { comparer } from '../../lib/tableau'
import { comparerTextes, langueActive } from '../../lib/langue'

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
  comparerTextes(a.nom, b.nom)

export default function Redaction() {
  const { t } = useLingui()
  const toutesLesFiches = t`Toutes les fiches`
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
        (a.perimetre?.nom ?? '').localeCompare(
          b.perimetre?.nom ?? '',
          langueActive()
        )
    )

  const ajouter = async (v: { personneId: string; perimetre: string }) => {
    try {
      await accorder({
        variables: {
          personneId: v.personneId,
          perimetreId: v.perimetre === TOUTES ? null : v.perimetre,
        },
      })
      message.success(t`Droit accordé.`)
      form.resetFields()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre
        sousTitre={t`Les admins rédigent toutes les fiches. Les autres personnes ont besoin d’un droit de rédaction.`}
      >
        <Trans>Rédaction des fiches</Trans>
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
            rules={[{ required: true, message: t`Choisissez une personne.` }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t`Personne`}
              style={{ minWidth: 200 }}
              options={autres.map(p => ({
                value: p.id,
                label: p.nom,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="perimetre"
            rules={[{ required: true, message: t`Choisissez un périmètre.` }]}
          >
            <Select
              placeholder={t`Fiches concernées`}
              style={{ minWidth: 220 }}
              options={[
                ...(gereOrganisation
                  ? [
                      {
                        value: TOUTES,
                        label: t`Toutes les fiches, communes comprises`,
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
              <Trans>Accorder</Trans>
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <div className="rt-colonne" style={{ gap: 26 }}>
        <Section titre={t`Droits accordés`} compte={droits.length}>
          <Tableau<Droit>
            id="redaction"
            rowKey="id"
            loading={loading}
            dataSource={droits}
            pagination={false}
            colonnes={[
              {
                key: 'personne',
                title: t`Personne`,
                render: (_, d) => d.personne.nom,
                tri: d => d.personne.nom,
                recherche: d => d.personne.nom,
              },
              {
                key: 'fiches',
                title: t`Fiches`,
                render: (_, d) => d.perimetre?.nom ?? toutesLesFiches,
                tri: d => d.perimetre?.nom ?? toutesLesFiches,
                filtre: {
                  // La valeur est l'identifiant du périmètre : deux périmètres
                  // de même nom restent deux options.
                  options: [
                    ...new Map(
                      droits.map(d => [
                        d.perimetre?.id ?? TOUTES,
                        d.perimetre?.nom ?? toutesLesFiches,
                      ])
                    ),
                  ]
                    .sort((a, b) => comparer(a[1], b[1]))
                    .map(([value, text]) => ({ text, value })),
                  valeurs: d => d.perimetre?.id ?? TOUTES,
                },
              },
              {
                title: '',
                key: 'actions',
                redimensionnable: false,
                render: (_, d) => (
                  <Space>
                    <Popconfirm
                      title={t`Retirer ce droit ?`}
                      okText={t`Retirer`}
                      cancelText={t`Annuler`}
                      onConfirm={async () => {
                        try {
                          await retirer({ variables: { id: d.id } })
                          message.success(t`Droit retiré.`)
                        } catch (e) {
                          message.error(messageErreur(e))
                        }
                      }}
                    >
                      <Button size="small" danger>
                        <Trans>Retirer</Trans>
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Section>

        <Section titre={t`Admins`} compte={admins.length}>
          <p className="rt-texte-secondaire">
            {gereOrganisation ? (
              <Trans>
                Le rôle d’admin donne déjà la rédaction des fiches. Il se
                modifie depuis l’écran Admins.
              </Trans>
            ) : (
              <Trans>
                Le rôle d’admin donne déjà la rédaction des fiches. Il se
                modifie depuis l’écran Personnes.
              </Trans>
            )}
          </p>
          <Tableau<Admin>
            id="redaction-admins"
            rowKey="id"
            loading={loading}
            dataSource={admins}
            pagination={false}
            colonnes={[
              {
                key: 'personne',
                title: t`Personne`,
                dataIndex: 'nom',
                tri: p => p.nom,
              },
              {
                title: t`Rôle`,
                key: 'role',
                filtre: {
                  options: [
                    { text: t`Admin de l’organisation`, value: 'organisation' },
                    { text: t`Admin de l’activité`, value: 'activite' },
                  ],
                  valeurs: p => (p.organisation ? 'organisation' : 'activite'),
                },
                render: (_, p) =>
                  p.organisation ? (
                    <Tag color="blue">
                      <Trans>Admin de l’organisation</Trans>
                    </Tag>
                  ) : (
                    <Tag color="geekblue">
                      <Trans>Admin de l’activité</Trans>
                    </Tag>
                  ),
              },
              {
                title: t`Fiches`,
                key: 'fiches',
                render: (_, p) =>
                  p.organisation
                    ? t`Toutes les fiches de l’organisation`
                    : t`Toutes les fiches de l’activité`,
              },
              {
                title: '',
                key: 'actions',
                redimensionnable: false,
                render: () => (
                  <Button size="small" disabled>
                    <Trans>Rédaction déjà accordée</Trans>
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
