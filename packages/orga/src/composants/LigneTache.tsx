import { Link } from 'react-router'

import type { StatutTache } from '../gql/graphql'
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
}: {
  tache: TacheLigne
  moiId: string
  editionId: string
}) {
  const echeance = etatEcheance(tache)
  const personnes = tache.assignes
    .map(p => (p.id === moiId ? 'Vous' : p.nom))
    .join(', ')
  return (
    <li>
      <Link
        to={`/perimetres/${tache.perimetre.slug}?edition=${editionId}`}
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
          <EtiquettePerimetre
            nom={tache.perimetre.nom}
            couleur={tache.perimetre.couleur}
          />
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
