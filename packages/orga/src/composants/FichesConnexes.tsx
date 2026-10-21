import {
  EyeInvisibleOutlined,
  EyeOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useMutation } from '@apollo/client/react'
import { App, Button, Tooltip } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import EtiquettePerimetre from './EtiquettePerimetre'
import { Panneau } from './Panneau'

const MASQUER_CONNEXE = graphql(`
  mutation MasquerFicheConnexe($ficheId: ID!, $perimetreId: ID!) {
    masquerFicheConnexe(ficheId: $ficheId, perimetreId: $perimetreId) {
      id
    }
  }
`)

const AFFICHER_CONNEXE = graphql(`
  mutation AfficherFicheConnexe($ficheId: ID!, $perimetreId: ID!) {
    afficherFicheConnexe(ficheId: $ficheId, perimetreId: $perimetreId) {
      id
    }
  }
`)

interface FicheConnexeLue {
  id: string
  slug: string
  titre: string
  perimetre?: { id: string; nom: string; couleur?: string | null } | null
  connexions: { masquee: boolean; perimetre: { id: string } }[]
}

/**
 * Les fiches d'autres périmètres qui concernent ce périmètre (ADR 0039), en
 * lecture seule. Une personne qui écrit dans le périmètre masque une fiche de
 * cette liste, puis l'affiche de nouveau. Une fiche masquée reste lisible par son
 * lien.
 */
export default function FichesConnexes({
  perimetreId,
  fiches,
  peutMasquer,
}: {
  perimetreId: string
  fiches: FicheConnexeLue[]
  peutMasquer: boolean
}) {
  const { lien } = useActivite()
  const { message } = App.useApp()
  const [voirMasquees, setVoirMasquees] = useState(false)
  const options = { refetchQueries: ['FichesDuPerimetre', 'Fiche'] }
  const [masquer, masquage] = useMutation(MASQUER_CONNEXE, options)
  const [afficher, affichage] = useMutation(AFFICHER_CONNEXE, options)
  const estMasquee = (f: FicheConnexeLue) =>
    f.connexions.some(c => c.perimetre.id === perimetreId && c.masquee)
  const visibles = fiches.filter(f => !estMasquee(f))
  const masquees = fiches.filter(estMasquee)
  if (fiches.length === 0) return null

  const basculer = async (fiche: FicheConnexeLue, cacher: boolean) => {
    try {
      const variables = { ficheId: fiche.id, perimetreId }
      if (cacher) await masquer({ variables })
      else await afficher({ variables })
      message.success(
        cacher
          ? 'La fiche quitte les fiches connexes de ce périmètre.'
          : 'La fiche revient dans les fiches connexes de ce périmètre.'
      )
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const ligne = (fiche: FicheConnexeLue, cacher: boolean) => (
    <li key={fiche.id} className="rt-fiche-connexe">
      <Link
        className="rt-ligne-lien"
        style={{ fontSize: 13.5 }}
        to={lien(`/fiches/${fiche.slug}`)}
      >
        {fiche.titre}
      </Link>
      <span className="rt-fiche-connexe-origine">
        {fiche.perimetre && (
          <EtiquettePerimetre
            nom={fiche.perimetre.nom}
            couleur={fiche.perimetre.couleur}
          />
        )}
        <span className="rt-texte-secondaire">Lecture seule</span>
        {peutMasquer && (
          <Tooltip
            title={
              cacher
                ? 'Masquer cette fiche pour ce périmètre'
                : 'Afficher de nouveau cette fiche'
            }
          >
            <Button
              size="small"
              type="text"
              aria-label={cacher ? 'Masquer la fiche' : 'Afficher la fiche'}
              icon={cacher ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              loading={masquage.loading || affichage.loading}
              onClick={() => void basculer(fiche, cacher)}
            />
          </Tooltip>
        )}
      </span>
    </li>
  )

  return (
    <Panneau
      titre="Fiches connexes"
      icone={<LinkOutlined aria-hidden />}
      extra={<span className="rt-compte">{visibles.length}</span>}
    >
      <p className="rt-texte-secondaire">
        Ces fiches appartiennent à d’autres périmètres et concernent aussi
        celui-ci.
      </p>
      {visibles.length > 0 ? (
        <ul className="rt-liste-liens">{visibles.map(f => ligne(f, true))}</ul>
      ) : (
        <p className="rt-texte-secondaire">Toutes les fiches sont masquées.</p>
      )}
      {masquees.length > 0 && (
        <>
          <Button
            size="small"
            type="link"
            style={{ alignSelf: 'flex-start', padding: 0 }}
            onClick={() => setVoirMasquees(v => !v)}
          >
            {voirMasquees
              ? 'Cacher les fiches masquées'
              : `Voir les fiches masquées (${masquees.length})`}
          </Button>
          {voirMasquees && (
            <ul className="rt-liste-liens">
              {masquees.map(f => ligne(f, false))}
            </ul>
          )}
        </>
      )}
    </Panneau>
  )
}
