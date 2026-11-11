import { useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Result, Skeleton } from 'antd'
import { Link, Navigate, useParams } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { PARAMETRE_DETAIL } from '../lib/fenetre-tache'

const TACHE_DU_LIEN = graphql(`
  query TacheDuLien($id: ID!) {
    tache(id: $id) {
      id
      edition {
        id
      }
      perimetre {
        id
        slug
        activite {
          id
          slug
        }
      }
    }
  }
`)

/**
 * Le lien de partage d'une tâche (`/<activité>/taches/<id>`) mène à la page de
 * son périmètre, pour sa période, avec la tâche ouverte en grand. Le serveur
 * vérifie la lecture : un lien n'ouvre aucun accès.
 */
export default function LienTache() {
  const { t } = useLingui()
  const { lien } = useActivite()
  const { id = '' } = useParams()
  const { data, error } = useQuery(TACHE_DU_LIEN, { variables: { id } })
  const tache = data?.tache

  if (tache) {
    const { perimetre, edition } = tache
    const recherche = new URLSearchParams({
      edition: edition.id,
      tache: tache.id,
      [PARAMETRE_DETAIL]: tache.id,
    })
    return (
      <Navigate
        replace
        to={`/${perimetre.activite.slug}/perimetres/${perimetre.slug}?${recherche.toString()}`}
      />
    )
  }
  if (error)
    return (
      <Result
        status="404"
        title={t`Cette tâche est introuvable.`}
        subTitle={t`Elle n’existe pas, ou vous n’avez pas accès à son périmètre.`}
        extra={
          <Link to={lien('/')}>
            <Button type="primary">
              <Trans>Revenir à Mon espace</Trans>
            </Button>
          </Link>
        }
      />
    )
  return <Skeleton active />
}
