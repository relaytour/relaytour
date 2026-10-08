import { DownOutlined, ShareAltOutlined, UpOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Button, Skeleton } from 'antd'
import { useId, useState } from 'react'

import { useActivite } from '../lib/activite'
import {
  ETAPES_ACCORD,
  libelleDeclinaisons,
  type ResumeDeclinaisons,
} from '../lib/declinaisons'
import { jourDeLInstant } from '../lib/erreurs'
import {
  DECLINAISONS_TACHE,
  IMPOSER_DECLINAISON,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

import EtiquettePerimetre from './EtiquettePerimetre'
import { PastilleEtat, PastilleStatut } from './Etat'

/**
 * Les déclinaisons d'une tâche partagée (ADR 0026) : un résumé toujours visible,
 * et le détail par périmètre à la demande. Le détail se lit par une requête à part :
 * une liste de tâches ne le porte pas. Un admin de l'activité y ajoute une
 * déclinaison sans l'accord de son périmètre, et y lit l'historique de cet accord.
 */
export default function DeclinaisonsTache({
  tacheId,
  titre: titreTache,
  resume,
  editionId,
  estAdmin,
}: {
  tacheId: string
  /** Le titre de la tâche partagée : une déclinaison ne répète pas le même. */
  titre: string
  resume: ResumeDeclinaisons
  editionId?: string
  estAdmin: boolean
}) {
  const { lien } = useActivite()
  const executer = useActionTache()
  const [ouvert, setOuvert] = useState(false)
  const detail = useId()
  const { data, error } = useQuery(DECLINAISONS_TACHE, {
    variables: { id: tacheId },
    skip: !ouvert,
  })
  const [imposer, imposition] = useMutation(IMPOSER_DECLINAISON, {
    refetchQueries: VUES_TACHES,
  })
  const { titre, details } = libelleDeclinaisons(resume)
  const declinaisons = data?.tache?.declinaisons
  // Les déclinaisons portent le plus souvent un même titre, différent de celui de
  // la tâche partagée : il s'affiche une fois, et une ligne ne répète que le sien.
  const titres = new Set((declinaisons ?? []).map(d => d.titre))
  const titreCommun =
    titres.size === 1 && !titres.has(titreTache) ? [...titres][0] : undefined

  return (
    <div className="rt-declinaisons">
      <button
        type="button"
        className="rt-declinaisons-resume"
        aria-expanded={ouvert}
        aria-controls={detail}
        onClick={() => setOuvert(o => !o)}
      >
        <ShareAltOutlined aria-hidden />
        <span>
          <strong>{titre}</strong>
          {details.length > 0 && ` · ${details.join(' · ')}`}
        </span>
        {ouvert ? <UpOutlined aria-hidden /> : <DownOutlined aria-hidden />}
      </button>
      {ouvert && (
        <ul id={detail} className="rt-declinaisons-liste">
          {declinaisons === undefined ? (
            <li>
              {error ? (
                <span className="rt-note">
                  Les déclinaisons n’ont pas pu être chargées. Rechargez la page
                  dans un instant.
                </span>
              ) : (
                <Skeleton active title={false} paragraph={{ rows: 2 }} />
              )}
            </li>
          ) : (
            <>
              {titreCommun !== undefined && (
                <li className="rt-note">
                  Tâche reçue par ces périmètres : « {titreCommun} »
                </li>
              )}
              {declinaisons.map(d => (
                <li key={d.id}>
                  <div className="rt-meta">
                    <EtiquettePerimetre
                      nom={d.perimetre.nom}
                      couleur={d.perimetre.couleur}
                      point
                      lien={lien(
                        `/perimetres/${d.perimetre.slug}?${editionId ? `edition=${editionId}&` : ''}tache=${d.id}`
                      )}
                    />
                    {d.accord === 'EN_ATTENTE' ? (
                      <PastilleEtat variante="alerte" sansPoint>
                        En attente d’accord
                      </PastilleEtat>
                    ) : d.accord === 'REFUSE' ? (
                      <PastilleEtat variante="abandonnee">Refusée</PastilleEtat>
                    ) : (
                      <>
                        <PastilleStatut statut={d.statut} />
                        {d.enRetard && (
                          <PastilleEtat variante="retard">
                            En retard
                          </PastilleEtat>
                        )}
                      </>
                    )}
                    {d.titre !== titreTache && d.titre !== titreCommun && (
                      <span style={{ fontSize: 13.5 }}>{d.titre}</span>
                    )}
                    {estAdmin && d.accord !== 'ACCEPTE' && (
                      <Button
                        size="small"
                        loading={imposition.loading}
                        onClick={() =>
                          void executer(
                            () => imposer({ variables: { id: d.id } }),
                            `La tâche est ajoutée au périmètre ${d.perimetre.nom}.`
                          )
                        }
                      >
                        Ajouter sans accord
                      </Button>
                    )}
                  </div>
                  {d.historiqueAccord.length > 0 && (
                    <p className="rt-note" style={{ margin: '4px 0 0' }}>
                      {d.historiqueAccord
                        .map(
                          e =>
                            `${ETAPES_ACCORD[e.etape]} par ${e.par.nom} le ${jourDeLInstant(e.le)}`
                        )
                        .join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  )
}
