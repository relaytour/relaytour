import { CloseOutlined, CopyOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  type SelectProps,
} from 'antd'
import { useRef, useState } from 'react'

import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { EtatPostes } from '../../gql/graphql'
import { messageErreur } from '../../lib/erreurs'
import { EDITIONS } from '../../lib/requetes'

const POSTES = graphql(`
  query PostesAPourvoir($editionId: ID!) {
    postesAPourvoir(editionId: $editionId) {
      effectif
      aPourvoir
      etat
      perimetre {
        id
        slug
        nom
        type
        couleur
      }
      affectations {
        id
        personne {
          id
          nom
        }
      }
      souhaits {
        id
        personne {
          id
          nom
        }
      }
    }
    appelPostes(editionId: $editionId)
    personnes {
      id
      nom
    }
  }
`)

const DEFINIR_EFFECTIF = graphql(`
  mutation DefinirEffectif(
    $perimetreId: ID!
    $editionId: ID!
    $effectif: Int!
  ) {
    definirEffectif(
      perimetreId: $perimetreId
      editionId: $editionId
      effectif: $effectif
    )
  }
`)

const AFFECTER = graphql(`
  mutation Affecter($personneId: ID!, $perimetreId: ID!, $editionId: ID!) {
    affecter(
      personneId: $personneId
      perimetreId: $perimetreId
      editionId: $editionId
    ) {
      id
    }
  }
`)

const RETIRER = graphql(`
  mutation RetirerAffectation($id: ID!) {
    retirerAffectation(id: $id)
  }
`)

const RETIRER_SOUHAIT = graphql(`
  mutation RetirerSouhait($id: ID!) {
    retirerSouhait(id: $id)
  }
`)

const EFFECTIF_MAX = 50

const ETATS: Record<EtatPostes, { couleur: string }> = {
  SANS_PERSONNE: { couleur: 'red' },
  INCOMPLET: { couleur: 'orange' },
  COMPLET: { couleur: 'green' },
}

type Filtre = 'tous' | 'aPourvoir'

/** Libellé lu par les lecteurs d'écran à la place de « 1 / 2 ». */
function libelleCompte(affectes: number, effectif: number | null): string {
  const personnes =
    affectes === 0
      ? 'Aucune personne affectée'
      : `${affectes} ${affectes > 1 ? 'personnes affectées' : 'personne affectée'}`
  if (effectif === null) return `${personnes}. Effectif à définir.`
  return `${personnes} sur ${effectif} ${effectif > 1 ? 'souhaitées' : 'souhaitée'}.`
}

// Effectif souhaité d'un périmètre, enregistré à la sortie du champ ou avec Entrée.
function ChampEffectif({
  id,
  perimetre,
  effectif,
  desactive,
  enregistrer,
}: {
  id: string
  perimetre: string
  effectif: number | null
  desactive: boolean
  enregistrer: (valeur: number) => Promise<boolean>
}) {
  const [valeur, setValeur] = useState<number | null>(effectif)
  // Les références évitent un double envoi quand Entrée précède la sortie du champ.
  const saisie = useRef<number | null>(effectif)
  const connue = useRef<number | null>(effectif)

  const valider = async () => {
    const nouvelle = saisie.current
    if (nouvelle === null) {
      saisie.current = connue.current
      setValeur(connue.current)
      return
    }
    if (nouvelle === connue.current) return
    const precedente = connue.current
    connue.current = nouvelle
    if (!(await enregistrer(nouvelle))) {
      connue.current = precedente
      saisie.current = precedente
      setValeur(precedente)
    }
  }

  return (
    <Space>
      <label htmlFor={id}>Effectif souhaité</label>
      <InputNumber
        id={id}
        aria-label={`Effectif souhaité pour ${perimetre}`}
        size="small"
        min={0}
        max={EFFECTIF_MAX}
        precision={0}
        value={valeur}
        placeholder="?"
        disabled={desactive}
        onChange={v => {
          saisie.current = v
          setValeur(v)
        }}
        onBlur={() => void valider()}
        onPressEnter={() => void valider()}
        style={{ width: 72 }}
      />
    </Space>
  )
}

export default function Postes() {
  const { message } = App.useApp()
  const { data: editions } = useQuery(EDITIONS)
  const [choix, setChoix] = useState<string | undefined>()
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [appelOuvert, setAppelOuvert] = useState(false)
  const edition =
    editions?.editions.find(e => e.id === choix) ??
    editions?.editions.find(e => e.statut !== 'ARCHIVEE')
  const editionId = edition?.id
  const archivee = edition?.statut === 'ARCHIVEE'
  const { data, loading } = useQuery(POSTES, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
  })
  const rafraichir = { refetchQueries: ['PostesAPourvoir'] }
  const [definirEffectif] = useMutation(DEFINIR_EFFECTIF, rafraichir)
  const [affecter] = useMutation(AFFECTER, rafraichir)
  const [retirer] = useMutation(RETIRER, rafraichir)
  const [retirerSouhait] = useMutation(RETIRER_SOUHAIT, rafraichir)

  const postes = data?.postesAPourvoir ?? []
  const affiches =
    filtre === 'aPourvoir' ? postes.filter(p => p.aPourvoir > 0) : postes
  const appel = data?.appelPostes ?? null
  const totalAPourvoir = postes.reduce((total, p) => total + p.aPourvoir, 0)
  const sansPersonne = postes.filter(p => p.etat === 'SANS_PERSONNE').length
  const souhaitsEnAttente = postes.reduce(
    (total, p) => total + p.souhaits.length,
    0
  )

  const executer = async (action: () => Promise<unknown>) => {
    try {
      await action()
      return true
    } catch (e) {
      message.error(messageErreur(e))
      return false
    }
  }

  const copierAppel = async () => {
    if (appel === null) return
    try {
      await navigator.clipboard.writeText(appel)
      message.success('L’appel est copié.')
      setAppelOuvert(false)
    } catch {
      message.error(
        'La copie a échoué. Utilisez l’icône de copie à la fin du texte.'
      )
    }
  }

  return (
    <>
      <Titre sousTitre="Les périmètres qui manquent de référentes et de référents s’affichent en premier.">
        Postes à pourvoir
      </Titre>
      <Space wrap size={[16, 12]} style={{ marginBottom: 24 }}>
        <Space>
          <span>Édition</span>
          <Select
            style={{ minWidth: 200 }}
            value={editionId}
            onChange={setChoix}
            placeholder="Choisir une édition"
            options={(editions?.editions ?? []).map(e => ({
              value: e.id,
              label: e.nom,
            }))}
          />
        </Space>
        <Segmented<Filtre>
          value={filtre}
          onChange={setFiltre}
          options={[
            { value: 'tous', label: 'Tous' },
            { value: 'aPourvoir', label: 'À pourvoir' },
          ]}
        />
        <Button
          icon={<CopyOutlined />}
          disabled={appel === null}
          onClick={() => setAppelOuvert(true)}
        >
          Copier l’appel
        </Button>
      </Space>

      {editionId === undefined ? (
        <Empty description="Créez d’abord une édition." />
      ) : loading && data === undefined ? (
        <Skeleton active />
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="Postes à pourvoir"
                  value={totalAPourvoir}
                  styles={
                    totalAPourvoir > 0
                      ? { content: { color: 'var(--rt-erreur)' } }
                      : undefined
                  }
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="Périmètres sans personne"
                  value={sansPersonne}
                  styles={
                    sansPersonne > 0
                      ? { content: { color: 'var(--rt-erreur)' } }
                      : undefined
                  }
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="Souhaits en attente"
                  value={souhaitsEnAttente}
                />
              </Card>
            </Col>
          </Row>

          {affiches.length === 0 ? (
            <Empty
              description={
                filtre === 'aPourvoir'
                  ? 'Tous les périmètres ont leurs référentes et référents.'
                  : 'Créez d’abord un périmètre.'
              }
            />
          ) : (
            <Row gutter={[16, 16]}>
              {affiches.map(poste => {
                const { perimetre, affectations, effectif, souhaits } = poste
                const dejaAffectes = new Set(
                  affectations.map(a => a.personne.id)
                )
                const interesses = new Set(souhaits.map(x => x.personne.id))
                const affecterPersonne = (personneId: string) =>
                  executer(() =>
                    affecter({
                      variables: {
                        personneId,
                        perimetreId: perimetre.id,
                        editionId,
                      },
                    })
                  )
                const autres = (data?.personnes ?? [])
                  .filter(p => !dejaAffectes.has(p.id) && !interesses.has(p.id))
                  .map(p => ({ value: p.id, label: p.nom }))
                // Les personnes intéressées apparaissent en premier dans la liste.
                const options: SelectProps['options'] =
                  souhaits.length === 0
                    ? autres
                    : [
                        {
                          label: 'Intéressé·es',
                          options: souhaits.map(x => ({
                            value: x.personne.id,
                            label: x.personne.nom,
                          })),
                        },
                        { label: 'Autres personnes', options: autres },
                      ]
                const compte = (
                  <Tag
                    color={ETATS[poste.etat].couleur}
                    role="img"
                    aria-label={libelleCompte(affectations.length, effectif)}
                    style={{ marginInlineEnd: 0 }}
                  >
                    {affectations.length} / {effectif ?? '?'}
                  </Tag>
                )
                return (
                  <Col key={perimetre.id} xs={24} md={12} xl={8}>
                    <Card
                      title={
                        <Space wrap size={8}>
                          <span>{perimetre.nom}</span>
                          <Tag>
                            {perimetre.type === 'SPORT' ? 'Sport' : 'Pôle'}
                          </Tag>
                        </Space>
                      }
                      extra={
                        effectif === null ? (
                          <Tooltip title="Effectif à définir">{compte}</Tooltip>
                        ) : (
                          compte
                        )
                      }
                      style={{
                        borderTop: `6px solid ${perimetre.couleur ?? 'var(--rt-primaire)'}`,
                        height: '100%',
                      }}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <ChampEffectif
                          key={`${editionId}-${perimetre.id}-${effectif}`}
                          id={`effectif-${perimetre.slug}`}
                          perimetre={perimetre.nom}
                          effectif={effectif ?? null}
                          desactive={archivee}
                          enregistrer={valeur =>
                            executer(() =>
                              definirEffectif({
                                variables: {
                                  perimetreId: perimetre.id,
                                  editionId,
                                  effectif: valeur,
                                },
                              })
                            )
                          }
                        />
                      </div>
                      <Space wrap style={{ marginBottom: 12, minHeight: 24 }}>
                        {affectations.length === 0 && (
                          <Typography.Text type="secondary">
                            Aucune personne affectée.
                          </Typography.Text>
                        )}
                        {affectations.map(a => (
                          <Tag
                            key={a.id}
                            closable
                            closeIcon={
                              <CloseOutlined
                                aria-label={`Retirer ${a.personne.nom}`}
                              />
                            }
                            onClose={e => {
                              e.preventDefault()
                              void executer(() =>
                                retirer({ variables: { id: a.id } })
                              )
                            }}
                          >
                            {a.personne.nom}
                          </Tag>
                        ))}
                      </Space>
                      {souhaits.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Typography.Text
                            strong
                            id={`interesses-${perimetre.slug}`}
                          >
                            Intéressé·es
                          </Typography.Text>
                          <ul
                            aria-labelledby={`interesses-${perimetre.slug}`}
                            style={{
                              listStyle: 'none',
                              margin: '4px 0 0',
                              padding: 0,
                            }}
                          >
                            {souhaits.map(souhait => (
                              <li
                                key={souhait.id}
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  padding: '4px 0',
                                }}
                              >
                                <span>{souhait.personne.nom}</span>
                                <Space size={4}>
                                  <Button
                                    size="small"
                                    icon={<UserAddOutlined />}
                                    aria-label={`Affecter ${souhait.personne.nom} à ${perimetre.nom}`}
                                    onClick={() =>
                                      void affecterPersonne(souhait.personne.id)
                                    }
                                  >
                                    Affecter
                                  </Button>
                                  <Popconfirm
                                    title="Retirer ce souhait ?"
                                    okText="Retirer"
                                    cancelText="Annuler"
                                    disabled={archivee}
                                    onConfirm={() =>
                                      executer(() =>
                                        retirerSouhait({
                                          variables: { id: souhait.id },
                                        })
                                      )
                                    }
                                  >
                                    <Button
                                      size="small"
                                      type="text"
                                      icon={<CloseOutlined />}
                                      aria-label={`Retirer le souhait de ${souhait.personne.nom}`}
                                      disabled={archivee}
                                    />
                                  </Popconfirm>
                                </Space>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Select
                        showSearch
                        style={{ width: '100%' }}
                        placeholder="Affecter une personne"
                        aria-label={`Affecter une personne à ${perimetre.nom}`}
                        value={null}
                        optionFilterProp="label"
                        options={options}
                        onChange={(personneId: string) =>
                          void affecterPersonne(personneId)
                        }
                      />
                    </Card>
                  </Col>
                )
              })}
            </Row>
          )}
        </>
      )}

      <Modal
        open={appelOuvert}
        title="Appel aux référentes et référents"
        okText="Copier"
        okButtonProps={{ icon: <CopyOutlined /> }}
        cancelText="Fermer"
        onOk={() => void copierAppel()}
        onCancel={() => setAppelOuvert(false)}
        destroyOnHidden
      >
        <Typography.Paragraph
          copyable={appel === null ? false : { text: appel }}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {appel}
        </Typography.Paragraph>
      </Modal>
    </>
  )
}
