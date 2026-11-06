import { DownOutlined, FlagOutlined, UpOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Skeleton } from 'antd'
import { useId, useState } from 'react'

import { useActivite } from '../lib/activite'
import { libelleJalon, type ResumeJalon } from '../lib/jalons'
import {
  DELIER_TACHE,
  TACHES_DU_JALON,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

import EtiquettePerimetre from './EtiquettePerimetre'
import { PastilleEtat, PastilleStatut } from './Etat'

/**
 * Le décompte d'un jalon (ADR 0062) : un résumé toujours visible, et ses tâches
 * liées à la demande. Le détail se lit par une requête à part : une liste de
 * tâches ne le porte pas. Une personne qui écrit dans le périmètre du jalon, ou
 * dans celui d'une tâche liée, y retire le lien après une confirmation.
 */
export default function JalonTache({
  jalonId,
  titre,
  resume,
  editionId,
  peutModifier,
  onLier,
}: {
  jalonId: string
  titre: string
  resume: ResumeJalon
  editionId?: string
  /** Vrai quand la personne écrit dans le périmètre du jalon. */
  peutModifier: boolean
  /** Ouvre la fenêtre qui lie des tâches, quand la personne peut le faire. */
  onLier?: () => void
}) {
  const { t } = useLingui()
  const { lien } = useActivite()
  const { modal } = App.useApp()
  const executer = useActionTache()
  const [ouvert, setOuvert] = useState(false)
  const detail = useId()
  const { data, error } = useQuery(TACHES_DU_JALON, {
    variables: { id: jalonId },
    skip: !ouvert,
  })
  const [delier, deliaison] = useMutation(DELIER_TACHE, {
    refetchQueries: [...VUES_TACHES, 'TachesDuJalon'],
  })
  const { titre: libelle, details } = libelleJalon(resume)
  const liees = data?.tache?.tachesLiees

  const retirer = async (tache: { id: string; titre: string }) => {
    const titreLiee = tache.titre
    const ok = await modal.confirm({
      title: t`Retirer « ${titreLiee} » de ce jalon ?`,
      content: t`La tâche ne change pas. Elle sort du décompte du jalon « ${titre} » et perd la place que ce jalon lui donne dans les priorités. Le jalon garde la trace du retrait.`,
      okText: t`Retirer`,
      cancelText: t`Annuler`,
    })
    if (!ok) return
    await executer(
      () => delier({ variables: { id: jalonId, tacheId: tache.id } }),
      t`La tâche est retirée du jalon.`
    )
  }

  return (
    <div className="rt-declinaisons">
      <button
        type="button"
        className="rt-declinaisons-resume"
        aria-expanded={ouvert}
        aria-controls={detail}
        onClick={() => setOuvert(o => !o)}
      >
        <FlagOutlined aria-hidden />
        <span>
          <strong>{libelle}</strong>
          {details.length > 0 && ` · ${details.join(' · ')}`}
        </span>
        {ouvert ? <UpOutlined aria-hidden /> : <DownOutlined aria-hidden />}
      </button>
      {ouvert && (
        <ul id={detail} className="rt-declinaisons-liste">
          {liees === undefined ? (
            <li>
              {error ? (
                <span className="rt-note">
                  <Trans>
                    Les tâches liées n’ont pas pu être chargées. Rechargez la
                    page dans un instant.
                  </Trans>
                </span>
              ) : (
                <Skeleton active title={false} paragraph={{ rows: 2 }} />
              )}
            </li>
          ) : (
            <>
              {liees.length === 0 && (
                <li className="rt-note">
                  <Trans>Ce jalon ne lie encore aucune tâche.</Trans>
                </li>
              )}
              {liees.map(x => (
                <li key={x.id}>
                  <div className="rt-meta">
                    <EtiquettePerimetre
                      nom={x.perimetre.nom}
                      couleur={x.perimetre.couleur}
                      point
                      lien={lien(
                        `/perimetres/${x.perimetre.slug}?${editionId ? `edition=${editionId}&` : ''}tache=${x.id}`
                      )}
                    />
                    <span style={{ fontSize: 13.5 }}>{x.titre}</span>
                    <PastilleStatut statut={x.statut} />
                    {x.enRetard && (
                      <PastilleEtat variante="retard">
                        <Trans>En retard</Trans>
                      </PastilleEtat>
                    )}
                    {(peutModifier || x.peutModifier) && (
                      <Button
                        size="small"
                        loading={deliaison.loading}
                        onClick={() => void retirer(x)}
                      >
                        <Trans>Retirer</Trans>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
              {onLier && (
                <li>
                  <Button size="small" onClick={onLier}>
                    <Trans>Lier des tâches</Trans>
                  </Button>
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  )
}
