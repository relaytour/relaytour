import { ProjectOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { libelleJours } from '../lib/agenda'

import { Panneau } from './Panneau'

const PROGRAMME = graphql(`
  query ProgrammePerimetre($editionId: ID!, $perimetreId: ID!) {
    programme(editionId: $editionId, perimetreId: $perimetreId) {
      id
      titre
      jour
      heureDebut
      heureFin
      lieu {
        id
        nom
      }
      places {
        id
        role
        nom
      }
    }
  }
`)

/** Une personne placée, avec « (resp.) » pour un responsable. */
function personne(p: { role: string; nom: string }): string {
  const nomPersonne = p.nom
  return p.role === 'RESPONSABLE' ? t`${nomPersonne} (resp.)` : nomPersonne
}

/** Les séquences du jour J d'un périmètre, dans la colonne de sa page (ADR 0040). */
export default function SequencesDuPerimetre({
  perimetreId,
  editionId,
}: {
  perimetreId: string
  editionId: string
}) {
  const { lien } = useActivite()
  const { t } = useLingui()
  const { data } = useQuery(PROGRAMME, {
    variables: { editionId, perimetreId },
    fetchPolicy: 'cache-and-network',
  })
  const sequences = data?.programme ?? []
  const horaire = (s: (typeof sequences)[number]) => {
    const jour = libelleJours(s.jour)
    const debut = s.heureDebut
    const fin = s.heureFin
    if (!s.lieu) return t`${jour} · ${debut} → ${fin}`
    const nomLieu = s.lieu.nom
    return t`${jour} · ${debut} → ${fin} · ${nomLieu}`
  }
  if (sequences.length === 0) return null
  return (
    <Panneau titre={t`Jour J`} icone={<ProjectOutlined aria-hidden />}>
      <ul className="rt-liste-liens">
        {sequences.map(s => (
          <li key={s.id}>
            <Link
              className="rt-ligne-lien"
              style={{ fontSize: 13.5 }}
              to={lien(
                `/programme?edition=${editionId}&vue=liste&jour=${s.jour}&sequence=${s.id}`
              )}
            >
              <span className="rt-agenda-compacte-texte">
                <span>{s.titre}</span>
                <span className="rt-note" style={{ fontWeight: 400 }}>
                  {horaire(s)}
                </span>
                {s.places.length > 0 && (
                  <span className="rt-note" style={{ fontWeight: 400 }}>
                    {s.places.map(personne).join(', ')}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panneau>
  )
}
