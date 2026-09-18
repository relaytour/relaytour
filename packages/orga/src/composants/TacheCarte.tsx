import {
  BookOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  MoreOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { useMutation } from '@apollo/client/react'
import {
  Button,
  Card,
  Dropdown,
  Form,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'

import type { TacheChampsFragment } from '../gql/graphql'
import { dateCourte } from '../lib/erreurs'
import {
  ASSIGNER_TACHE,
  CHANGER_STATUT,
  STATUTS,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

export interface Referent {
  id: string
  nom: string
}

export default function TacheCarte({
  tache,
  moiId,
  peutModifier,
  referents,
  estAdmin = false,
  afficherPerimetre = false,
  onModifier,
}: {
  tache: TacheChampsFragment
  moiId: string
  peutModifier: boolean
  referents: Referent[]
  estAdmin?: boolean
  afficherPerimetre?: boolean
  onModifier?: (tache: TacheChampsFragment) => void
}) {
  const executer = useActionTache()
  const [assigner, assignation] = useMutation(ASSIGNER_TACHE, {
    refetchQueries: VUES_TACHES,
  })
  const [changerStatut, changement] = useMutation(CHANGER_STATUT, {
    refetchQueries: VUES_TACHES,
  })
  const [cloture, setCloture] = useState(false)
  const [realiseeParId, setRealiseeParId] = useState<string | null>(null)

  const assignee = tache.assignes.some(p => p.id === moiId)
  const ouverte = tache.statut === 'A_FAIRE' || tache.statut === 'EN_COURS'
  const enAction = assignation.loading || changement.loading
  // Le serveur refuse d'assigner une personne non affectée au périmètre pour l'édition.
  const affectee = referents.some(r => r.id === moiId)
  // Les admins assignent et retirent les autres personnes depuis la carte.
  const gererAssignes = estAdmin && peutModifier && ouverte
  const assignables = referents.filter(
    r => !tache.assignes.some(p => p.id === r.id)
  )

  const assignerPersonne = (
    personneId: string,
    assigne: boolean,
    succes: string
  ) =>
    executer(
      () => assigner({ variables: { id: tache.id, assigne, personneId } }),
      succes
    )

  const statut = (
    nouveau: TacheChampsFragment['statut'],
    succes: string,
    realisee?: string | null
  ) =>
    executer(
      confirmer =>
        changerStatut({
          variables: {
            id: tache.id,
            statut: nouveau,
            realiseeParId: realisee ?? null,
            confirmer,
          },
        }),
      succes
    )

  const terminer = async () => {
    if (await statut('FAITE', 'Tâche marquée comme faite.', realiseeParId)) {
      setCloture(false)
      setRealiseeParId(null)
    }
  }

  return (
    <Card
      size="small"
      style={{
        borderInlineStart: `4px solid ${tache.perimetre.couleur ?? 'var(--rt-primaire)'}`,
        opacity: tache.statut === 'ABANDONNEE' ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <Typography.Text
            strong
            delete={tache.statut === 'ABANDONNEE'}
            style={{ fontSize: 16, display: 'block' }}
          >
            {tache.titre}
          </Typography.Text>
          {tache.description && (
            <Typography.Paragraph
              type="secondary"
              ellipsis={{
                rows: 2,
                expandable: 'collapsible',
                symbol: e => (e ? 'Réduire' : 'Lire la suite'),
              }}
              style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}
            >
              {tache.description}
            </Typography.Paragraph>
          )}
          <Space size={[6, 6]} wrap style={{ marginTop: 8 }}>
            {afficherPerimetre && (
              <Link to={`/perimetres/${tache.perimetre.slug}`}>
                <Tag>{tache.perimetre.nom}</Tag>
              </Link>
            )}
            <Tag color={STATUTS[tache.statut].couleur}>
              {STATUTS[tache.statut].libelle}
            </Tag>
            {tache.fiche && (
              <Link to={`/fiches/${tache.fiche.slug}`}>
                <Tag icon={<BookOutlined />} color="gold">
                  {tache.fiche.titre}
                </Tag>
              </Link>
            )}
            {tache.echeance && (
              <Tag color={tache.enRetard ? 'red' : undefined}>
                {tache.enRetard ? 'En retard : ' : 'Échéance : '}
                {dateCourte(tache.echeance)}
              </Tag>
            )}
            {tache.assignes.length === 0 && ouverte ? (
              <Tag color="orange">Personne n’est assigné·e</Tag>
            ) : (
              tache.assignes.map(p => (
                <Tag
                  key={p.id}
                  closable={gererAssignes}
                  closeIcon={<CloseOutlined aria-label={`Retirer ${p.nom}`} />}
                  onClose={e => {
                    e.preventDefault()
                    void assignerPersonne(
                      p.id,
                      false,
                      p.id === moiId
                        ? 'Vous êtes retiré·e de la tâche.'
                        : 'La personne est retirée de la tâche.'
                    )
                  }}
                >
                  {p.id === moiId ? 'Vous' : p.nom}
                </Tag>
              ))
            )}
          </Space>
          {tache.statut === 'FAITE' &&
            (tache.clotureePar || tache.realiseePar) && (
              <Typography.Paragraph
                type="secondary"
                style={{ margin: '8px 0 0', fontSize: 13 }}
              >
                {tache.clotureePar &&
                  `Cochée par ${tache.clotureePar.id === moiId ? 'vous' : tache.clotureePar.nom}. `}
                {tache.realiseePar &&
                  `Réalisée par ${tache.realiseePar.id === moiId ? 'vous' : tache.realiseePar.nom}.`}
              </Typography.Paragraph>
            )}
        </div>

        {peutModifier && (
          <Space wrap style={{ justifyContent: 'flex-end' }}>
            {gererAssignes && assignables.length > 0 && (
              <Select
                size="small"
                showSearch
                value={null}
                placeholder="Assigner une personne"
                optionFilterProp="label"
                style={{ minWidth: 190 }}
                disabled={enAction}
                options={assignables.map(r => ({
                  value: r.id,
                  label: r.id === moiId ? 'Vous' : r.nom,
                }))}
                onChange={(personneId: string) =>
                  void assignerPersonne(personneId, true, 'Tâche assignée.')
                }
              />
            )}
            {ouverte && (assignee || affectee) && (
              <Button
                size="small"
                loading={assignation.loading}
                onClick={() =>
                  void executer(
                    () =>
                      assigner({
                        variables: { id: tache.id, assigne: !assignee },
                      }),
                    assignee
                      ? 'Vous êtes retiré·e de la tâche.'
                      : 'La tâche vous est assignée.'
                  )
                }
              >
                {assignee ? 'Me retirer' : 'Je m’en occupe'}
              </Button>
            )}
            {ouverte ? (
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                disabled={enAction}
                onClick={() => setCloture(true)}
              >
                Faite
              </Button>
            ) : (
              <Button
                size="small"
                icon={<UndoOutlined />}
                disabled={enAction}
                onClick={() => void statut('A_FAIRE', 'Tâche rouverte.')}
              >
                Rouvrir
              </Button>
            )}
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'modifier',
                    icon: <EditOutlined />,
                    label: 'Modifier',
                  },
                  ...(tache.statut === 'A_FAIRE'
                    ? [{ key: 'EN_COURS', label: 'Marquer en cours' }]
                    : []),
                  ...(tache.statut === 'EN_COURS'
                    ? [{ key: 'A_FAIRE', label: 'Remettre à faire' }]
                    : []),
                  ...(ouverte
                    ? [{ key: 'ABANDONNEE', label: 'Abandonner', danger: true }]
                    : []),
                ],
                onClick: ({ key }) => {
                  if (key === 'modifier') onModifier?.(tache)
                  if (key === 'EN_COURS')
                    void statut('EN_COURS', 'Tâche marquée en cours.')
                  if (key === 'A_FAIRE')
                    void statut('A_FAIRE', 'Tâche remise à faire.')
                  if (key === 'ABANDONNEE')
                    void statut('ABANDONNEE', 'Tâche abandonnée.')
                },
              }}
            >
              <Button
                size="small"
                icon={<MoreOutlined />}
                aria-label="Autres actions"
              />
            </Dropdown>
          </Space>
        )}
      </div>

      <Modal
        open={cloture}
        title="Marquer la tâche comme faite"
        okText="Marquer comme faite"
        cancelText="Annuler"
        confirmLoading={changement.loading}
        onOk={() => void terminer()}
        onCancel={() => setCloture(false)}
        destroyOnHidden
      >
        <Typography.Paragraph>« {tache.titre} »</Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item
            label="Réalisée par (facultatif)"
            extra="Cette information n’est visible que par vous et par les admins."
          >
            <Select
              allowClear
              placeholder="Choisir une personne"
              value={realiseeParId}
              onChange={v => setRealiseeParId(v ?? null)}
              options={referents.map(r => ({
                value: r.id,
                label: r.id === moiId ? 'Vous' : r.nom,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
