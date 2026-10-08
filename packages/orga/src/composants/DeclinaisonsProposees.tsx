import { CheckOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Typography } from 'antd'

import { useActivite } from '../lib/activite'
import { dateCourte } from '../lib/erreurs'
import {
  ACCORDER_DECLINAISON,
  DECLINAISONS_PROPOSEES,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

import EtiquettePerimetre from './EtiquettePerimetre'
import { Section } from './Panneau'

/** Une déclinaison proposée au périmètre, qui attend son accord (ADR 0026). */
export interface DeclinaisonProposee {
  id: string
  titre: string
  description?: string | null
  echeance?: string | null
  origine?: {
    id: string
    perimetre: { slug: string; nom: string; couleur?: string | null }
  } | null
}

/**
 * Les tâches que d'autres périmètres proposent à celui-ci. Elles ne figurent pas
 * encore parmi ses tâches : une personne qui écrit dans le périmètre les accepte
 * ou les refuse.
 */
export default function DeclinaisonsProposees({
  slug,
  editionId,
  peutRepondre,
}: {
  /** Le périmètre affiché. */
  slug: string
  editionId: string
  peutRepondre: boolean
}) {
  const { lien } = useActivite()
  const { modal } = App.useApp()
  const executer = useActionTache()
  const [accorder, accord] = useMutation(ACCORDER_DECLINAISON, {
    refetchQueries: VUES_TACHES,
  })
  // La requête vit à part de celle de la page, que le serveur borne en nombre de
  // champs.
  const { data, error } = useQuery(DECLINAISONS_PROPOSEES, {
    variables: { slug, editionId },
  })
  // Une requête en échec ne vaut pas une liste vide : l'encart le dit, pour que
  // personne ne croie qu'aucune tâche n'attend.
  if (data === undefined) {
    return error ? (
      <Section titre="Tâches proposées à ce périmètre">
        <p className="rt-note" style={{ margin: '0 6px' }}>
          Les tâches proposées à ce périmètre n’ont pas pu être chargées.
          Rechargez la page dans un instant.
        </p>
      </Section>
    ) : null
  }
  const declinaisons: DeclinaisonProposee[] =
    data.perimetre?.declinaisonsProposees ?? []
  if (declinaisons.length === 0) return null

  const repondre = (id: string, accepter: boolean) =>
    executer(
      () => accorder({ variables: { id, accepter } }),
      accepter
        ? 'La tâche est ajoutée à votre périmètre.'
        : 'La tâche est refusée.'
    )

  const refuser = async (d: DeclinaisonProposee) => {
    const demandeur = d.origine
      ? `Le périmètre ${d.origine.perimetre.nom}`
      : 'Le périmètre qui la propose'
    const confirme = await modal.confirm({
      title: 'Refuser cette tâche ?',
      content: `${demandeur} apprend votre refus. Un admin de l’activité peut ajouter la tâche à votre périmètre malgré ce refus.`,
      okText: 'Refuser',
      cancelText: 'Annuler',
    })
    if (confirme) await repondre(d.id, false)
  }

  return (
    <Section
      titre="Tâches proposées à ce périmètre"
      compte={`${declinaisons.length} à accepter`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {declinaisons.map(d => (
          <article
            key={d.id}
            className="rt-verre-teinte rt-carte-tache rt-carte-proposee"
          >
            <span
              className="rt-rail"
              style={{
                background:
                  d.origine?.perimetre.couleur ?? 'var(--rt-primaire)',
              }}
              aria-hidden="true"
            />
            <div className="rt-carte-tache-corps">
              <div className="rt-carte-tache-titre">
                <Typography.Text style={{ fontSize: 16, fontWeight: 600 }}>
                  {d.titre}
                </Typography.Text>
              </div>
              {d.description && (
                <Typography.Paragraph
                  className="rt-description-tache"
                  ellipsis={{
                    rows: 2,
                    expandable: 'collapsible',
                    symbol: e => (e ? 'Réduire' : 'Lire la suite'),
                  }}
                >
                  {d.description}
                </Typography.Paragraph>
              )}
              <div className="rt-meta">
                {d.origine && (
                  <span className="rt-demandee-par">
                    Demandée par
                    <EtiquettePerimetre
                      nom={d.origine.perimetre.nom}
                      couleur={d.origine.perimetre.couleur}
                      point
                      lien={lien(
                        `/perimetres/${d.origine.perimetre.slug}?edition=${editionId}&tache=${d.origine.id}`
                      )}
                    />
                  </span>
                )}
                {d.echeance && (
                  <span className="rt-date">
                    Échéance {dateCourte(d.echeance)}
                  </span>
                )}
              </div>
            </div>
            {peutRepondre && (
              <div className="rt-carte-tache-actions">
                <Button
                  size="small"
                  disabled={accord.loading}
                  onClick={() => void refuser(d)}
                >
                  Refuser
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  disabled={accord.loading}
                  onClick={() => void repondre(d.id, true)}
                >
                  Accepter
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="rt-note" style={{ margin: '0 6px' }}>
        {peutRepondre
          ? 'Une tâche acceptée entre parmi les tâches du périmètre. Une tâche refusée n’y entre pas.'
          : 'Les référentes et référents du périmètre acceptent ou refusent ces tâches.'}
      </p>
    </Section>
  )
}
