import {
  BookOutlined,
  CheckOutlined,
  EditOutlined,
  MoreOutlined,
  UndoOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { useMutation } from '@apollo/client/react'
import { Button, Dropdown, Form, Modal, Select, Typography } from 'antd'
import { useState } from 'react'

import type { TacheChampsFragment } from '../gql/graphql'
import { dateCourte } from '../lib/erreurs'
import {
  ASSIGNER_TACHE,
  CHANGER_STATUT,
  estOuverte,
  etatEcheance,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

import EtiquettePerimetre from './EtiquettePerimetre'
import { PastilleEtat, PastilleStatut } from './Etat'
import { PersonneNommee } from './Personne'

export interface Referent {
  id: string
  nom: string
}

/**
 * Une tâche et ses actions : prise en charge, statut, assignation (admins),
 * modification. Le rail porte la couleur du périmètre. `teinte` met en avant
 * une tâche à prendre.
 */
export default function TacheCarte({
  tache,
  moiId,
  peutModifier,
  referents,
  estAdmin = false,
  afficherPerimetre = false,
  teinte = false,
  onModifier,
}: {
  tache: TacheChampsFragment
  moiId: string
  peutModifier: boolean
  referents: Referent[]
  estAdmin?: boolean
  afficherPerimetre?: boolean
  teinte?: boolean
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
  const [choixAssignation, setChoixAssignation] = useState(false)

  const assignee = tache.assignes.some(p => p.id === moiId)
  const ouverte = estOuverte(tache)
  const enAction = assignation.loading || changement.loading
  // Le serveur refuse d'assigner une personne non affectée au périmètre pour l'édition.
  const affectee = referents.some(r => r.id === moiId)
  // Les admins assignent et retirent les autres personnes depuis la carte.
  const gererAssignes = estAdmin && peutModifier && ouverte
  const assignables = referents.filter(
    r => !tache.assignes.some(p => p.id === r.id)
  )
  const echeance = etatEcheance(tache)
  // Le menu « Autres actions » ne s'affiche que s'il propose au moins une entrée :
  // une tâche faite ou abandonnée, hors page du périmètre, n'en a aucune.
  const autresActions = [
    ...(onModifier
      ? [{ key: 'modifier', icon: <EditOutlined />, label: 'Modifier' }]
      : []),
    ...(tache.statut === 'A_FAIRE'
      ? [{ key: 'EN_COURS', label: 'Marquer en cours' }]
      : []),
    ...(tache.statut === 'EN_COURS'
      ? [{ key: 'A_FAIRE', label: 'Remettre à faire' }]
      : []),
    ...(ouverte
      ? [{ key: 'ABANDONNEE', label: 'Abandonner', danger: true }]
      : []),
  ]

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
    <article
      className={`${teinte ? 'rt-verre-teinte' : 'rt-verre'} rt-carte-tache${tache.statut === 'ABANDONNEE' ? ' rt-abandonnee' : ''}`}
    >
      <span
        className="rt-rail"
        style={{ background: tache.perimetre.couleur ?? 'var(--rt-primaire)' }}
        aria-hidden="true"
      />
      <div className="rt-carte-tache-corps">
        <div className="rt-carte-tache-titre">
          <Typography.Text
            delete={tache.statut === 'ABANDONNEE'}
            style={{ fontSize: 16, fontWeight: 600 }}
          >
            {tache.titre}
          </Typography.Text>
          {afficherPerimetre && (
            <EtiquettePerimetre
              nom={tache.perimetre.nom}
              couleur={tache.perimetre.couleur}
              lien={`/perimetres/${tache.perimetre.slug}`}
            />
          )}
        </div>
        {tache.description && (
          <Typography.Paragraph
            className="rt-description-tache"
            ellipsis={{
              rows: 2,
              expandable: 'collapsible',
              symbol: e => (e ? 'Réduire' : 'Lire la suite'),
            }}
          >
            {tache.description}
          </Typography.Paragraph>
        )}
        <div className="rt-meta">
          <PastilleStatut statut={tache.statut} />
          {tache.fiche && (
            <PastilleEtat
              variante="alerte"
              icone={<BookOutlined aria-hidden />}
              lien={`/fiches/${tache.fiche.slug}`}
            >
              {tache.fiche.titre}
            </PastilleEtat>
          )}
          {tache.echeance && (
            <span
              className={`rt-date${echeance === 'retard' ? ' rt-date-retard' : echeance === 'proche' ? ' rt-date-proche' : ''}`}
            >
              {echeance === 'retard' ? 'En retard : ' : 'Échéance '}
              {dateCourte(tache.echeance)}
            </span>
          )}
          {tache.assignes.length === 0 && ouverte ? (
            <PastilleEtat variante="alerte" sansPoint>
              Personne n’est assigné·e
            </PastilleEtat>
          ) : (
            tache.assignes.map(p => (
              <PersonneNommee
                key={p.id}
                nom={p.id === moiId ? 'Vous' : p.nom}
                initialesDe={p.nom}
                desactive={enAction}
                retirer={
                  gererAssignes
                    ? () =>
                        void assignerPersonne(
                          p.id,
                          false,
                          p.id === moiId
                            ? 'Vous êtes retiré·e de la tâche.'
                            : 'La personne est retirée de la tâche.'
                        )
                    : undefined
                }
              />
            ))
          )}
        </div>
        {tache.statut === 'FAITE' &&
          (tache.clotureePar || tache.realiseePar) && (
            <p className="rt-note" style={{ margin: 0 }}>
              {tache.clotureePar &&
                `Cochée par ${tache.clotureePar.id === moiId ? 'vous' : tache.clotureePar.nom}. `}
              {tache.realiseePar &&
                `Réalisée par ${tache.realiseePar.id === moiId ? 'vous' : tache.realiseePar.nom}.`}
            </p>
          )}
      </div>

      {peutModifier && (
        <div className="rt-carte-tache-actions">
          {gererAssignes &&
            assignables.length > 0 &&
            (choixAssignation ? (
              <Select
                size="small"
                showSearch
                autoFocus
                defaultOpen
                value={null}
                placeholder="Assigner une personne"
                optionFilterProp="label"
                style={{ minWidth: 190 }}
                disabled={enAction}
                onBlur={() => setChoixAssignation(false)}
                options={assignables.map(r => ({
                  value: r.id,
                  label: r.id === moiId ? 'Vous' : r.nom,
                }))}
                onChange={(personneId: string) => {
                  setChoixAssignation(false)
                  void assignerPersonne(personneId, true, 'Tâche assignée.')
                }}
              />
            ) : (
              <Button
                size="small"
                icon={<UserAddOutlined />}
                disabled={enAction}
                onClick={() => setChoixAssignation(true)}
              >
                Assigner
              </Button>
            ))}
          {ouverte && (assignee || affectee) && (
            <Button
              size="small"
              className={assignee ? undefined : 'rt-bouton-engagement'}
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
          {autresActions.length > 0 && (
            <Dropdown
              trigger={['click']}
              menu={{
                items: autresActions,
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
          )}
        </div>
      )}

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
    </article>
  )
}
