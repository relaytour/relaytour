import { CheckCircleFilled } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Space } from 'antd'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import DescriptionActivite from './DescriptionActivite'
import InvitationRapide from './InvitationRapide'
import ModeleDeDepart from './ModeleDeDepart'
import NouvelleEdition from './NouvelleEdition'
import { Panneau } from './Panneau'
import ReglagePerimetre from './ReglagePerimetre'
import TachesTypesEdition from './TachesTypesEdition'
import { graphql } from '../gql'
import type { EtapePremiersPas } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { EDITION_COURANTE, PREMIERS_PAS } from '../lib/requetes'

// Liste « Premiers pas » de Mon espace (ADR 0048). Elle mène un admin d'une
// activité vide à une période prête. Le serveur coche chaque étape à partir des
// données ; chaque étape ouvre la fenêtre de l'écran concerné, sans quitter Mon
// espace. La liste disparaît quand tout est fait, ou quand un admin la masque.

const MASQUER = graphql(`
  mutation MasquerPremiersPas {
    masquerPremiersPas {
      masques
    }
  }
`)

type Fenetre =
  'activite' | 'periode' | 'perimetre' | 'modele' | 'taches' | 'equipe'

interface Etape {
  titre: string
  texte: ReactNode
  actions: ReactNode
}

export default function PremiersPas() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { lien, periode } = useActivite()
  const { une: unePeriode, nom: mot } = periode
  const { data, refetch } = useQuery(PREMIERS_PAS)
  const { data: courante } = useQuery(EDITION_COURANTE)
  const edition = courante?.editionCourante
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  const [masquer, masquage] = useMutation(MASQUER, {
    refetchQueries: [PREMIERS_PAS],
  })
  const fermer = () => {
    setFenetre(null)
    void refetch()
  }

  const etat = data?.premiersPas
  if (!etat || etat.masques || etat.termines) return null
  const faite = (etape: EtapePremiersPas) =>
    etat.etapes.find(e => e.etape === etape)?.faite ?? false
  const faites = etat.etapes.filter(e => e.faite).length
  const total = etat.etapes.length
  // La première étape à faire porte le bouton principal.
  const prochaine = etat.etapes.find(e => !e.faite)?.etape
  const bouton = (etape: EtapePremiersPas, libelle: string, f: Fenetre) => (
    <Button
      type={prochaine === etape ? 'primary' : 'default'}
      onClick={() => setFenetre(f)}
    >
      {libelle}
    </Button>
  )

  const ETAPES: Record<EtapePremiersPas, Etape> = {
    ACTIVITE: {
      titre: t`Décrire l’activité`,
      texte: t`Vérifiez son nom, sa nature et ses groupes de périmètres.`,
      actions: bouton('ACTIVITE', t`Décrire`, 'activite'),
    },
    PERIODE: {
      titre: t`Créer ${unePeriode}`,
      texte: t`Chaque ${mot} sert de repère aux échéances des tâches.`,
      actions: bouton('PERIODE', t`Créer`, 'periode'),
    },
    PERIMETRES: {
      titre: t`Créer les périmètres`,
      texte: t`Un périmètre regroupe les tâches d’un sport, d’un pôle ou d’une commission. Un modèle propose des périmètres, leurs tâches types et des fiches.`,
      actions: (
        <Space wrap>
          {bouton('PERIMETRES', t`Partir d’un modèle`, 'modele')}
          <Button onClick={() => setFenetre('perimetre')}>
            <Trans>Nouveau périmètre</Trans>
          </Button>
          <Link to={lien('/admin/equipe')}>
            <Trans>Ouvrir l’écran Équipe</Trans>
          </Link>
        </Space>
      ),
    },
    TACHES: {
      titre: t`Préparer les tâches`,
      texte: edition
        ? t`Appliquez les tâches types des périmètres, ou créez les tâches depuis chaque périmètre.`
        : t`Créez d’abord ${unePeriode} : ses tâches s’y rattachent.`,
      actions: edition && (
        <Space wrap>
          {bouton('TACHES', t`Appliquer les tâches types`, 'taches')}
          <Link to={lien('/perimetres')}>
            <Trans>Tous les périmètres</Trans>
          </Link>
        </Space>
      ),
    },
    EQUIPE: {
      titre: t`Inviter l’équipe`,
      texte: t`Invitez les référentes et les référents de chaque périmètre.`,
      actions: bouton('EQUIPE', t`Inviter`, 'equipe'),
    },
  }

  return (
    <>
      <Panneau
        titre={t`Premiers pas`}
        extra={
          <Space size="middle">
            <span className="rt-compte">{t`${faites} sur ${total}`}</span>
            <Button
              type="link"
              size="small"
              loading={masquage.loading}
              onClick={() =>
                void masquer().catch(e => message.error(messageErreur(e)))
              }
            >
              <Trans>Masquer</Trans>
            </Button>
          </Space>
        }
      >
        <ol className="rt-premiers-pas">
          {etat.etapes.map(({ etape }, rang) => {
            const { titre, texte, actions } = ETAPES[etape]
            const fait = faite(etape)
            return (
              <li
                key={etape}
                className={fait ? 'rt-premiers-pas-faite' : undefined}
              >
                <span
                  className="rt-premiers-pas-rang"
                  role="img"
                  aria-label={fait ? t`Étape faite` : t`Étape à faire`}
                >
                  {fait ? <CheckCircleFilled /> : rang + 1}
                </span>
                <div className="rt-premiers-pas-corps">
                  <strong>{titre}</strong>
                  <span className="rt-texte-secondaire">{texte}</span>
                </div>
                {!fait && actions && (
                  <div className="rt-premiers-pas-actions">{actions}</div>
                )}
              </li>
            )
          })}
        </ol>
      </Panneau>

      <DescriptionActivite ouverte={fenetre === 'activite'} onFermer={fermer} />
      <NouvelleEdition ouverte={fenetre === 'periode'} onFermer={fermer} />
      <ModeleDeDepart ouverte={fenetre === 'modele'} onFermer={fermer} />
      <ReglagePerimetre
        perimetre={fenetre === 'perimetre' ? 'nouveau' : null}
        onFermer={fermer}
      />
      <TachesTypesEdition
        edition={fenetre === 'taches' && edition ? edition : null}
        onFermer={fermer}
      />
      <InvitationRapide
        ouverte={fenetre === 'equipe'}
        onFermer={fermer}
        onInvitee={() => void refetch()}
      />
    </>
  )
}
