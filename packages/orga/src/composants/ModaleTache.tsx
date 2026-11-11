import { useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Modal, Result, Skeleton } from 'antd'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import {
  COMMENTAIRES_VIDES,
  useCommentairesDeLaPeriode,
} from '../lib/commentaires'
import { cheminTache, ouverteIci, PARAMETRE_DETAIL } from '../lib/fenetre-tache'
import { MOI } from '../lib/requetes'

import BoutonPartage from './BoutonPartage'
import EtiquettePerimetre from './EtiquettePerimetre'
import FilTache from './FilTache'
import TacheCarte from './TacheCarte'

const TACHE_DETAIL = graphql(`
  query TacheDetail($id: ID!) {
    tache(id: $id) {
      ...TacheChamps
      edition {
        id
      }
      origine {
        id
        perimetre {
          slug
          nom
          couleur
        }
      }
    }
  }
`)

// Les personnes affectées au périmètre de la tâche, pour l'assignation. La période
// se lit d'abord sur la tâche.
const REFERENTS_TACHE = graphql(`
  query ReferentsTache($id: ID!, $editionId: ID!) {
    tache(id: $id) {
      id
      perimetre {
        id
        referents(editionId: $editionId) {
          id
          nom
        }
      }
    }
  }
`)

/**
 * La fenêtre d'une tâche : la carte à gauche, avec sa description entière et ses
 * actions, et le fil à droite (ADR 0029). Elle s'ouvre par le titre d'une carte
 * ou par le lien de partage, et le serveur vérifie la lecture de la tâche.
 *
 * La fenêtre porte les actions de la carte qui ne demandent que la tâche :
 * statut, assignation, priorité, partage. Modifier la tâche, la décliner ou
 * planifier une réunion restent sur la page du périmètre, que l'étiquette de
 * l'en-tête ouvre.
 */
export default function ModaleTache() {
  const { t } = useLingui()
  const { lien, gere } = useActivite()
  const [parametres, setParametres] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const id = parametres.get(PARAMETRE_DETAIL)
  const { data: session } = useQuery(MOI)
  const { data, error, loading } = useQuery(TACHE_DETAIL, {
    variables: { id: id ?? '' },
    skip: id === null,
  })
  const tache = data?.tache
  const editionId = tache?.edition.id
  const { data: equipe } = useQuery(REFERENTS_TACHE, {
    variables: { id: id ?? '', editionId: editionId ?? '' },
    skip: id === null || editionId === undefined,
  })
  const commentaires = useCommentairesDeLaPeriode(editionId)
  const moiId = session?.moi?.id ?? ''

  // Une fenêtre ouverte depuis l'écran se ferme par un retour arrière : la page
  // et l'historique reviennent à leur état d'avant. Une fenêtre ouverte par un
  // lien retire seulement le paramètre de l'adresse.
  const fermer = () =>
    ouverteIci(location.state)
      ? void navigate(-1)
      : setParametres(
          courants => {
            const suite = new URLSearchParams(courants)
            suite.delete(PARAMETRE_DETAIL)
            return suite
          },
          { replace: true }
        )

  // Une ancienne réponse reste en cache quand une autre tâche s'ouvre : seule la
  // tâche demandée s'affiche.
  const affichee = tache?.id === id ? tache : undefined

  return (
    <Modal
      open={id !== null}
      onCancel={fermer}
      footer={null}
      width={1080}
      className="rt-fenetre-tache"
      destroyOnHidden
      title={
        affichee && (
          <div className="rt-fenetre-tache-tete">
            <EtiquettePerimetre
              nom={affichee.perimetre.nom}
              couleur={affichee.perimetre.couleur}
              lien={lien(`/perimetres/${affichee.perimetre.slug}`)}
              point
            />
            <BoutonPartage
              chemin={cheminTache(affichee.id)}
              titre={affichee.titre}
            />
          </div>
        )
      }
    >
      {affichee === undefined ? (
        error && !loading ? (
          <Result
            status="404"
            title={t`Cette tâche est introuvable.`}
            subTitle={t`Elle n’existe pas, ou vous n’avez pas accès à son périmètre.`}
          />
        ) : (
          <Skeleton active />
        )
      ) : (
        <div className="rt-fenetre-tache-corps">
          <div className="rt-fenetre-tache-carte">
            <TacheCarte
              tache={affichee}
              moiId={moiId}
              peutModifier={affichee.peutModifier}
              referents={equipe?.tache.perimetre.referents ?? []}
              estAdmin={gere}
              editionId={editionId}
              detail
            />
          </div>
          {commentaires === COMMENTAIRES_VIDES ? (
            <Skeleton active />
          ) : commentaires.lus.has(affichee.perimetre.id) ? (
            <FilTache
              tache={affichee}
              moiId={moiId}
              ouvert
              integre
              onFermer={fermer}
            />
          ) : (
            <p className="rt-note">
              <Trans>
                Le fil de cette tâche se lit par les personnes affectées à son
                périmètre.
              </Trans>
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
