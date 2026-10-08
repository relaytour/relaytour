import { DownOutlined, UpOutlined } from '@ant-design/icons'
import { useId, useState } from 'react'
import { Link } from 'react-router'

import type { StatutTache } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { dateCourte } from '../lib/erreurs'
import { estOuverte, etatEcheance } from '../lib/taches'

import EtiquettePerimetre from './EtiquettePerimetre'
import { PastilleEtat, PastilleStatut } from './Etat'
import { Avatar } from './Personne'

export interface TacheLigne {
  id: string
  titre: string
  echeance?: string | null
  statut: StatutTache
  enRetard: boolean
  perimetre: { slug: string; nom: string; couleur?: string | null }
  assignes: { id: string; nom: string }[]
}

/**
 * Une tâche sur une ligne, sans action : toute la ligne mène à son périmètre,
 * où la tâche se consulte et se modifie.
 */
export default function LigneTache({
  tache,
  moiId,
  editionId,
  sansPerimetre = false,
}: {
  tache: TacheLigne
  moiId: string
  editionId: string
  /** Vrai sous un titre qui nomme déjà le périmètre : son étiquette ne se répète pas. */
  sansPerimetre?: boolean
}) {
  const { lien } = useActivite()
  const echeance = etatEcheance(tache)
  const personnes = tache.assignes
    .map(p => (p.id === moiId ? 'Vous' : p.nom))
    .join(', ')
  return (
    <li>
      <Link
        to={lien(`/perimetres/${tache.perimetre.slug}?edition=${editionId}`)}
        className={`rt-verre rt-ligne-tache${tache.statut === 'ABANDONNEE' ? ' rt-abandonnee' : ''}`}
      >
        <span
          className="rt-rail"
          style={{
            background: tache.perimetre.couleur ?? 'var(--rt-primaire)',
          }}
          aria-hidden="true"
        />
        <span
          className={`rt-date${echeance === 'retard' ? ' rt-date-retard' : echeance === 'proche' ? ' rt-date-proche' : ''}`}
          style={{ fontSize: 13 }}
        >
          {tache.echeance ? dateCourte(tache.echeance) : 'Sans échéance'}
        </span>
        <span className="rt-ligne-tache-titre">
          <span>{tache.titre}</span>
          {!sansPerimetre && (
            <EtiquettePerimetre
              nom={tache.perimetre.nom}
              couleur={tache.perimetre.couleur}
            />
          )}
        </span>
        <span className="rt-ligne-tache-fin">
          {tache.assignes.length === 0 ? (
            estOuverte(tache) && (
              <PastilleEtat variante="alerte" sansPoint>
                Personne
              </PastilleEtat>
            )
          ) : (
            <span className="rt-personne" title={personnes}>
              {tache.assignes.slice(0, 3).map(p => (
                <Avatar key={p.id} nom={p.nom} />
              ))}
              <span style={{ overflowWrap: 'anywhere' }}>{personnes}</span>
            </span>
          )}
          {tache.enRetard && (
            <PastilleEtat variante="retard">En retard</PastilleEtat>
          )}
          <PastilleStatut statut={tache.statut} />
        </span>
      </Link>
    </li>
  )
}

/**
 * Plusieurs déclinaisons d'une même tâche partagée, à la même échéance, sur une
 * seule ligne (ADR 0026) : le rétroplanning ne répète pas la même tâche pour
 * chaque périmètre. La ligne se déplie pour montrer chaque déclinaison.
 */
export function LigneDeclinaisons({
  titre,
  taches,
  moiId,
  editionId,
}: {
  titre: string
  taches: TacheLigne[]
  moiId: string
  editionId: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const detail = useId()
  const premiere = taches[0]
  if (premiere === undefined) return null
  const faites = taches.filter(t => t.statut === 'FAITE').length
  const enRetard = taches.some(t => t.enRetard)
  // L'échéance est commune au groupe : la plus pressante de ses tâches donne l'état.
  const echeance = enRetard
    ? 'retard'
    : taches.some(t => etatEcheance(t) === 'proche')
      ? 'proche'
      : 'normale'
  return (
    <li>
      <button
        type="button"
        className="rt-verre rt-ligne-tache rt-ligne-declinaisons"
        aria-expanded={ouvert}
        aria-controls={detail}
        onClick={() => setOuvert(o => !o)}
      >
        <span
          className="rt-rail"
          style={{ background: 'var(--rt-encre-40)' }}
          aria-hidden="true"
        />
        <span
          className={`rt-date${echeance === 'retard' ? ' rt-date-retard' : echeance === 'proche' ? ' rt-date-proche' : ''}`}
          style={{ fontSize: 13 }}
        >
          {premiere.echeance ? dateCourte(premiere.echeance) : 'Sans échéance'}
        </span>
        <span className="rt-ligne-tache-titre">
          <span>{titre}</span>
          {taches.map(t => (
            <EtiquettePerimetre
              key={t.id}
              nom={t.perimetre.nom}
              couleur={t.perimetre.couleur}
            />
          ))}
        </span>
        <span className="rt-ligne-tache-fin">
          {enRetard && <PastilleEtat variante="retard">En retard</PastilleEtat>}
          <span className="rt-compte">
            {taches.length} périmètres · {faites}{' '}
            {faites > 1 ? 'faites' : 'faite'}
          </span>
          {ouvert ? <UpOutlined aria-hidden /> : <DownOutlined aria-hidden />}
        </span>
      </button>
      {ouvert && (
        <ul id={detail} className="rt-liste-liens rt-ligne-declinaisons-detail">
          {taches.map(t => (
            <LigneTache
              key={t.id}
              tache={t}
              moiId={moiId}
              editionId={editionId}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
