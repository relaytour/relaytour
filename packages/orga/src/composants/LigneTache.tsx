import { DownOutlined, UpOutlined } from '@ant-design/icons'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
  const { t } = useLingui()
  const { lien } = useActivite()
  const echeance = etatEcheance(tache)
  const personnes = tache.assignes
    .map(p => (p.id === moiId ? t`Vous` : p.nom))
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
          {tache.echeance ? dateCourte(tache.echeance) : t`Sans échéance`}
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
                {t({
                  message: 'Personne',
                  comment: 'Aucune personne n’est assignée à la tâche',
                })}
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
            <PastilleEtat variante="retard">
              <Trans>En retard</Trans>
            </PastilleEtat>
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
  const { t } = useLingui()
  const [ouvert, setOuvert] = useState(false)
  const detail = useId()
  const premiere = taches[0]
  if (premiere === undefined) return null
  const faites = taches.filter(x => x.statut === 'FAITE').length
  const nombrePerimetres = taches.length
  const enRetard = taches.some(x => x.enRetard)
  // L'échéance est commune au groupe : la plus pressante de ses tâches donne l'état.
  const echeance = enRetard
    ? 'retard'
    : taches.some(x => etatEcheance(x) === 'proche')
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
          {premiere.echeance ? dateCourte(premiere.echeance) : t`Sans échéance`}
        </span>
        <span className="rt-ligne-tache-titre">
          <span>{titre}</span>
          {taches.map(x => (
            <EtiquettePerimetre
              key={x.id}
              nom={x.perimetre.nom}
              couleur={x.perimetre.couleur}
            />
          ))}
        </span>
        <span className="rt-ligne-tache-fin">
          {enRetard && (
            <PastilleEtat variante="retard">
              <Trans>En retard</Trans>
            </PastilleEtat>
          )}
          <span className="rt-compte">
            {t`${plural(faites, {
              one: `${nombrePerimetres} périmètres · # faite`,
              other: `${nombrePerimetres} périmètres · # faites`,
            })}`}
          </span>
          {ouvert ? <UpOutlined aria-hidden /> : <DownOutlined aria-hidden />}
        </span>
      </button>
      {ouvert && (
        <ul id={detail} className="rt-liste-liens rt-ligne-declinaisons-detail">
          {taches.map(x => (
            <LigneTache
              key={x.id}
              tache={x}
              moiId={moiId}
              editionId={editionId}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
