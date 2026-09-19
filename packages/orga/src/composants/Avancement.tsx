import { PastilleEtat } from './Etat'

export interface AvancementDonnees {
  total: number
  faites: number
  abandonnees: number
  enRetard: number
  sansPersonne: number
  aFaire?: number
  enCours?: number
}

function Signalements({ avancement }: { avancement: AvancementDonnees }) {
  if (avancement.enRetard === 0 && avancement.sansPersonne === 0) return null
  return (
    <div className="rt-meta">
      {avancement.enRetard > 0 && (
        <PastilleEtat variante="retard">
          {avancement.enRetard} en retard
        </PastilleEtat>
      )}
      {avancement.sansPersonne > 0 && (
        <PastilleEtat variante="alerte">
          {avancement.sansPersonne} sans personne
        </PastilleEtat>
      )}
    </div>
  )
}

const largeur = (part: number, total: number) =>
  `${total === 0 ? 0 : (100 * part) / total}%`

/**
 * L'avancement d'un périmètre : tâches faites sur tâches non abandonnées. La
 * version compacte tient dans une carte ; la version complète empile les
 * statuts et ajoute une légende quand les comptes par statut sont connus.
 */
export default function Avancement({
  avancement,
  compact = false,
  couleur = 'var(--rt-primaire)',
}: {
  avancement: AvancementDonnees
  compact?: boolean
  /** Couleur de la barre compacte, par exemple celle du périmètre. */
  couleur?: string
}) {
  const utiles = avancement.total - avancement.abandonnees
  const pourcentage =
    utiles === 0 ? 0 : Math.round((avancement.faites / utiles) * 100)

  if (utiles === 0) {
    return (
      <div className="rt-meta">
        <PastilleEtat>Aucune tâche</PastilleEtat>
      </div>
    )
  }

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--rt-encre-70)' }}>
            {pourcentage} % des tâches faites
          </span>
          <span className="rt-compte">
            {avancement.faites} / {utiles}
          </span>
        </div>
        <div
          className="rt-barre-simple"
          role="progressbar"
          aria-valuenow={pourcentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tâches faites"
        >
          <span style={{ width: `${pourcentage}%`, background: couleur }} />
        </div>
        <Signalements avancement={avancement} />
      </div>
    )
  }

  const detaille =
    avancement.aFaire !== undefined && avancement.enCours !== undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="rt-grand-nombre">{pourcentage} %</span>
        <span className="rt-texte-secondaire">des tâches faites</span>
      </div>
      <div
        className="rt-barre-empilee"
        role="progressbar"
        aria-valuenow={pourcentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Tâches faites"
      >
        <span
          style={{
            width: largeur(avancement.faites, utiles),
            background: 'var(--rt-succes)',
          }}
        />
        {detaille && (
          <span
            style={{
              width: largeur(avancement.enCours!, utiles),
              background: 'var(--rt-primaire)',
            }}
          />
        )}
      </div>
      {detaille && (
        <ul className="rt-legende">
          <li>
            <span
              className="rt-point"
              style={{ background: 'var(--rt-succes)' }}
            />
            {avancement.faites} {avancement.faites > 1 ? 'faites' : 'faite'}
          </li>
          <li>
            <span
              className="rt-point"
              style={{ background: 'var(--rt-primaire)' }}
            />
            {avancement.enCours} en cours
          </li>
          <li>
            <span
              className="rt-point"
              style={{ background: 'var(--rt-encre-40)' }}
            />
            {avancement.aFaire} à faire
          </li>
          <li style={{ color: 'var(--rt-encre-55)' }}>
            <span
              className="rt-point"
              style={{ background: 'var(--rt-encre-14)' }}
            />
            {avancement.abandonnees}{' '}
            {avancement.abandonnees > 1 ? 'abandonnées' : 'abandonnée'}
          </li>
        </ul>
      )}
      <Signalements avancement={avancement} />
    </div>
  )
}
