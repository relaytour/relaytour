import {
  CopyOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, t } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Result,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'

import { graphql } from '../gql'
import type { AppelsBenevolesQuery, PorteeAppel } from '../gql/graphql'
import { jourLocal, libelleJours } from '../lib/agenda'
import { useAgendasEcrits } from '../lib/agendas-ecrits'
import { lireConflit } from '../lib/conflit'
import { dateCourte, jourDeLInstant, messageErreur } from '../lib/erreurs'
import { EDITIONS } from '../lib/requetes'
import { APPELS } from '../lib/requetes-benevoles'

import Tableau from './Tableau'

// Appels à bénévoles d'une période (ADR 0041). Un admin de l'activité ouvre un
// appel sur toute la période ; une personne qui écrit dans un périmètre, sur son
// périmètre ou une de ses séquences. L'adresse publique se recopie à tout
// moment par les personnes qui gèrent l'appel.

const SEQUENCES = graphql(`
  query SequencesPourAppel($editionId: ID!) {
    programme(editionId: $editionId) {
      id
      titre
      jour
      heureDebut
      besoinBenevoles
      perimetre {
        id
      }
    }
  }
`)

const CREER = graphql(`
  mutation CreerAppelBenevoles(
    $editionId: ID!
    $portee: PorteeAppel!
    $perimetreId: ID
    $sequenceId: ID
    $nom: String!
    $introduction: String
    $ouvertLe: DateTime!
    $fermeLe: DateTime!
  ) {
    creerAppelBenevoles(
      editionId: $editionId
      portee: $portee
      perimetreId: $perimetreId
      sequenceId: $sequenceId
      nom: $nom
      introduction: $introduction
      ouvertLe: $ouvertLe
      fermeLe: $fermeLe
    ) {
      adresse
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierAppelBenevoles(
    $id: ID!
    $nom: String!
    $introduction: String
    $ouvertLe: DateTime!
    $fermeLe: DateTime!
    $versionAttendue: Int!
  ) {
    modifierAppelBenevoles(
      id: $id
      nom: $nom
      introduction: $introduction
      ouvertLe: $ouvertLe
      fermeLe: $fermeLe
      versionAttendue: $versionAttendue
    ) {
      id
    }
  }
`)

const FERMER = graphql(`
  mutation FermerAppelBenevoles($id: ID!) {
    fermerAppelBenevoles(id: $id) {
      id
    }
  }
`)

const ROUVRIR = graphql(`
  mutation RouvrirAppelBenevoles($id: ID!) {
    rouvrirAppelBenevoles(id: $id) {
      id
    }
  }
`)

const RENOUVELER = graphql(`
  mutation RenouvelerAdresseAppelBenevoles($id: ID!) {
    renouvelerAdresseAppelBenevoles(id: $id) {
      adresse
    }
  }
`)

type Appel = AppelsBenevolesQuery['appelsBenevoles'][number]

interface Valeurs {
  nom: string
  portee: PorteeAppel
  perimetreId?: string
  sequenceId?: string
  introduction?: string
  ouvertLe: string
  fermeLe: string
}

const ETATS: Record<
  Appel['etat'],
  { libelle: MessageDescriptor; couleur: string }
> = {
  A_VENIR: {
    libelle: msg({
      message: 'À venir',
      comment: 'État d’un appel à bénévoles qui n’est pas encore ouvert',
    }),
    couleur: 'default',
  },
  OUVERT: {
    libelle: msg({
      message: 'Ouvert',
      comment: 'État d’un appel à bénévoles',
    }),
    couleur: 'success',
  },
  FERME: {
    libelle: msg({
      message: 'Fermé',
      comment: 'État d’un appel à bénévoles',
    }),
    couleur: 'default',
  },
}

const RELIRE = ['AppelsBenevoles']

/** Un instant ISO pour un champ `datetime-local`, dans le fuseau du navigateur. */
function versChamp(iso: string): string {
  const d = new Date(iso)
  const decale = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return decale.toISOString().slice(0, 16)
}

/** La portée d'un appel en clair. */
function portee(a: Appel): string {
  if (a.portee === 'PERIODE') return t`Toute la période`
  if (a.portee === 'SEQUENCE') {
    const titreSequence = a.sequenceTitre
    return titreSequence
      ? t`Séquence « ${titreSequence} »`
      : t`Séquence supprimée`
  }
  return (
    a.perimetre?.nom ??
    t({
      message: 'Périmètre',
      comment: 'Portée d’un appel à bénévoles dont le périmètre est inconnu',
    })
  )
}

export default function AppelsBenevoles({
  editionId,
  archivee,
}: {
  editionId: string
  archivee: boolean
}) {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<Valeurs>()
  const { data, loading, error } = useQuery(APPELS, {
    variables: { editionId },
    fetchPolicy: 'cache-and-network',
  })
  const { data: editions } = useQuery(EDITIONS)
  const agendas = useAgendasEcrits(editionId, t`Toute la période`)
  const [appel, setAppel] = useState<Appel | 'nouveau' | null>(null)
  // Relue à chaque ouverture de la fenêtre : une séquence ajoutée par une autre
  // personne entre dans le choix.
  const { data: programme } = useQuery(SEQUENCES, {
    variables: { editionId },
    skip: appel === null,
    fetchPolicy: 'network-only',
  })
  const relire = { refetchQueries: RELIRE }
  const [creer, creation] = useMutation(CREER, relire)
  const [modifier, modification] = useMutation(MODIFIER, relire)
  const [fermer] = useMutation(FERMER, relire)
  const [rouvrir] = useMutation(ROUVRIR, relire)
  const [renouveler] = useMutation(RENOUVELER, relire)
  const porteeChoisie = Form.useWatch('portee', form)

  const edition = editions?.editions.find(e => e.id === editionId)
  const finEdition = edition ? dateCourte(edition.fin) : undefined
  const admin = agendas.some(a => a.perimetreId === null)
  const perimetres = agendas.filter(a => a.perimetreId !== null)
  const ecrits = new Set(perimetres.map(p => p.perimetreId))
  // Les séquences qui cherchent des bénévoles et que la personne écrit.
  const sequences = (programme?.programme ?? []).filter(
    s =>
      (s.besoinBenevoles ?? 0) > 0 &&
      (s.perimetre ? ecrits.has(s.perimetre.id) : admin)
  )

  useEffect(() => {
    if (appel === null) return
    form.setFieldsValue(
      appel === 'nouveau'
        ? {
            nom: '',
            portee: admin ? 'PERIODE' : 'PERIMETRE',
            perimetreId: perimetres[0]?.perimetreId ?? undefined,
            sequenceId: undefined,
            introduction: '',
            ouvertLe: versChamp(new Date().toISOString()),
            fermeLe: edition
              ? `${edition.fin.slice(0, 10)}T20:00`
              : versChamp(new Date().toISOString()),
          }
        : {
            nom: appel.nom,
            portee: appel.portee,
            introduction: appel.introduction ?? '',
            ouvertLe: versChamp(appel.ouvertLe),
            fermeLe: versChamp(appel.fermeLe),
          }
    )
    // Les valeurs par défaut se lisent à l'ouverture de la fenêtre seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, appel])

  // Un navigateur peut refuser le presse-papiers : l'adresse s'affiche alors
  // dans une fenêtre, avec son bouton de copie.
  const copier = async (adresse: string, texte = t`Adresse copiée.`) => {
    try {
      await navigator.clipboard.writeText(adresse)
      message.success(texte)
    } catch {
      void modal.info({
        title: t`Adresse de l’appel`,
        content: (
          <Typography.Paragraph copyable={{ text: adresse }}>
            <code>{adresse}</code>
          </Typography.Paragraph>
        ),
        okText: t`Fermer`,
      })
    }
  }

  const enregistrer = async (v: Valeurs) => {
    const dates = {
      ouvertLe: new Date(v.ouvertLe).toISOString(),
      fermeLe: new Date(v.fermeLe).toISOString(),
    }
    try {
      if (appel === 'nouveau') {
        const { data: cree } = await creer({
          variables: {
            editionId,
            portee: v.portee,
            perimetreId: v.portee === 'PERIMETRE' ? v.perimetreId : null,
            sequenceId: v.portee === 'SEQUENCE' ? v.sequenceId : null,
            nom: v.nom,
            introduction: v.introduction ?? '',
            ...dates,
          },
        })
        const adresse = cree?.creerAppelBenevoles.adresse
        if (adresse)
          await copier(adresse, t`Appel ouvert. Son adresse est copiée.`)
      } else if (appel) {
        await modifier({
          variables: {
            id: appel.id,
            nom: v.nom,
            introduction: v.introduction ?? '',
            versionAttendue: appel.version,
            ...dates,
          },
        })
        message.success(t`Appel enregistré.`)
      }
      setAppel(null)
    } catch (e) {
      message.error(
        lireConflit(e) !== null
          ? t`Une autre personne a modifié cet appel. Rouvrez-le pour reprendre.`
          : messageErreur(e)
      )
    }
  }

  const agir = async (action: () => Promise<unknown>, ok: string) => {
    try {
      await action()
      message.success(ok)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const confirmerRenouvellement = (a: Appel) =>
    void modal.confirm({
      title: t`Donner une nouvelle adresse à cet appel ?`,
      content: t`L’ancienne adresse cesse de répondre. Les candidatures déjà reçues restent.`,
      okText: t`Nouvelle adresse`,
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          const { data: renouvele } = await renouveler({
            variables: { id: a.id },
          })
          const adresse = renouvele?.renouvelerAdresseAppelBenevoles.adresse
          if (adresse) await copier(adresse, t`Nouvelle adresse copiée.`)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })

  if (error && !data) {
    return (
      <Result
        status="warning"
        title={t`Les appels n’ont pas pu être chargés.`}
        subTitle={messageErreur(error)}
      />
    )
  }

  const optionsPortee = [
    ...(admin ? [{ value: 'PERIODE', label: t`Toute la période` }] : []),
    { value: 'PERIMETRE', label: t`Un périmètre` },
    { value: 'SEQUENCE', label: t`Une séquence` },
  ]

  return (
    <div className="rt-appels">
      {!archivee && agendas.length > 0 && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAppel('nouveau')}
        >
          <Trans>Nouvel appel</Trans>
        </Button>
      )}
      <Tableau<Appel>
        id="appels-benevoles"
        rowKey="id"
        loading={loading && !data}
        dataSource={data?.appelsBenevoles ?? []}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              description={t`Aucun appel à bénévoles pour cette période.`}
            />
          ),
        }}
        colonnes={[
          {
            key: 'nom',
            title: t({
              message: 'Appel',
              comment: 'Colonne du tableau des appels à bénévoles',
            }),
            render: (_, a) => (
              <span>
                <strong>{a.nom}</strong>
                <br />
                <span className="rt-note">{portee(a)}</span>
              </span>
            ),
            tri: a => a.nom,
            recherche: a => a.nom,
          },
          {
            key: 'dates',
            title: t({
              message: 'Ouvert',
              comment: 'Colonne des dates d’ouverture d’un appel à bénévoles',
            }),
            render: (_, a) => {
              const jourOuverture = jourDeLInstant(a.ouvertLe)
              const jourFermeture = jourDeLInstant(a.fermeLe)
              return t`du ${jourOuverture} au ${jourFermeture}`
            },
          },
          {
            key: 'etat',
            title: t({
              message: 'État',
              comment: 'Colonne du tableau des appels à bénévoles',
            }),
            width: 110,
            render: (_, a) => (
              <Tag color={ETATS[a.etat].couleur}>
                {t(ETATS[a.etat].libelle)}
              </Tag>
            ),
          },
          {
            key: 'attente',
            title: t({
              message: 'En attente',
              comment:
                'Colonne : nombre de candidatures qui attendent une revue',
            }),
            width: 110,
            dataIndex: 'candidaturesEnAttente',
            tri: a => a.candidaturesEnAttente,
          },
          {
            key: 'actions',
            title: '',
            redimensionnable: false,
            render: (_, a) => {
              const nomAppel = a.nom
              return (
                a.peutModifier && (
                  <Space wrap size={4}>
                    {a.adresse && (
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => void copier(a.adresse!)}
                      >
                        {t`Copier l’adresse`}
                      </Button>
                    )}
                    {!archivee && (
                      <>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          aria-label={t`Modifier l’appel ${nomAppel}`}
                          onClick={() => setAppel(a)}
                        />
                        {a.etat === 'FERME' ? (
                          <Button
                            size="small"
                            onClick={() =>
                              void agir(
                                () => rouvrir({ variables: { id: a.id } }),
                                t`Appel rouvert.`
                              )
                            }
                          >
                            {t`Rouvrir`}
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            onClick={() =>
                              void agir(
                                () => fermer({ variables: { id: a.id } }),
                                t`Appel fermé.`
                              )
                            }
                          >
                            {t({
                              message: 'Fermer',
                              context: 'appel à bénévoles',
                            })}
                          </Button>
                        )}
                        <Button
                          size="small"
                          icon={<ReloadOutlined />}
                          aria-label={t`Nouvelle adresse pour ${nomAppel}`}
                          title={t`Nouvelle adresse`}
                          onClick={() => confirmerRenouvellement(a)}
                        />
                      </>
                    )}
                  </Space>
                )
              )
            },
          },
        ]}
      />
      <p className="rt-note">
        <Trans>
          Une personne qui ouvre l’adresse choisit les séquences qui cherchent
          des bénévoles et donne ses disponibilités. Aucun mail ne part au dépôt
          : la candidature attend votre revue dans l’onglet « Candidatures ».
        </Trans>
      </p>

      <Modal
        open={appel !== null}
        title={
          appel === 'nouveau'
            ? t`Nouvel appel à bénévoles`
            : t`Modifier l’appel`
        }
        okText={appel === 'nouveau' ? t`Ouvrir l’appel` : t`Enregistrer`}
        cancelText={t`Annuler`}
        confirmLoading={creation.loading || modification.loading}
        onOk={() => form.submit()}
        onCancel={() => setAppel(null)}
        destroyOnHidden
        rootClassName="rt-modale-pleine"
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={v => void enregistrer(v)}
        >
          <Form.Item
            label={t`Nom de l’appel`}
            name="nom"
            extra={t`Pour l’équipe seulement : la page publique ne l’affiche pas.`}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t`Saisissez un nom.`,
              },
              { max: 120, message: t`Le nom dépasse 120 caractères.` },
            ]}
          >
            <Input placeholder={t`Bénévoles du samedi`} />
          </Form.Item>
          <Form.Item label={t`Portée`} name="portee">
            <Select options={optionsPortee} disabled={appel !== 'nouveau'} />
          </Form.Item>
          {appel === 'nouveau' && porteeChoisie === 'PERIMETRE' && (
            <Form.Item
              label={t({
                message: 'Périmètre',
                comment: 'Champ du formulaire d’un appel à bénévoles',
              })}
              name="perimetreId"
              rules={[{ required: true, message: t`Choisissez un périmètre.` }]}
            >
              <Select
                options={perimetres.map(p => ({
                  value: p.perimetreId!,
                  label: p.nom,
                }))}
              />
            </Form.Item>
          )}
          {appel === 'nouveau' && porteeChoisie === 'SEQUENCE' && (
            <Form.Item
              label={t({
                message: 'Séquence',
                comment: 'Champ du formulaire d’un appel à bénévoles',
              })}
              name="sequenceId"
              extra={t`Seules les séquences qui cherchent des renforts se proposent.`}
              rules={[{ required: true, message: t`Choisissez une séquence.` }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                notFoundContent={t`Aucune séquence ne cherche de bénévoles.`}
                options={sequences.map(s => {
                  const titreSequence = s.titre
                  const jourSequence = libelleJours(s.jour)
                  const heureSequence = s.heureDebut
                  return {
                    value: s.id,
                    label: t`${titreSequence} · ${jourSequence}, ${heureSequence}`,
                  }
                })}
              />
            </Form.Item>
          )}
          <Form.Item
            label={t`Texte d’introduction (facultatif)`}
            name="introduction"
            extra={t`Ce texte est public : il ouvre la page de l’appel.`}
            rules={[
              {
                max: 2000,
                message: t`L’introduction dépasse 2 000 caractères.`,
              },
            ]}
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
          </Form.Item>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16 }}>
            <Form.Item
              label={t`Ouverture`}
              name="ouvertLe"
              rules={[{ required: true, message: t`Choisissez une date.` }]}
            >
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item
              label={t`Fermeture`}
              name="fermeLe"
              rules={[{ required: true, message: t`Choisissez une date.` }]}
              extra={
                finEdition
                  ? t`Au plus tard à la fin du ${finEdition}.`
                  : undefined
              }
            >
              <Input type="datetime-local" min={jourLocal() + 'T00:00'} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
