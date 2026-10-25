import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'

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
  const { t } = useLingui()
  const nbTaches = avancement.total
  const nbEnRetard = avancement.enRetard
  const nbSansPersonne = avancement.sansPersonne
  const toutesAbandonnees =
    avancement.total > 0 && avancement.abandonnees === avancement.total
  if (
    avancement.enRetard === 0 &&
    avancement.sansPersonne === 0 &&
    !toutesAbandonnees
  )
    return null
  return (
    <div className="rt-meta">
      {toutesAbandonnees && (
        <PastilleEtat variante="abandonnee">
          {t`${plural(nbTaches, {
            one: 'La tâche est abandonnée',
            other: 'Les # tâches sont abandonnées',
          })}`}
        </PastilleEtat>
      )}
      {avancement.enRetard > 0 && (
        <PastilleEtat variante="retard">
          <Trans>{nbEnRetard} en retard</Trans>
        </PastilleEtat>
      )}
      {avancement.sansPersonne > 0 && (
        <PastilleEtat variante="alerte">
          <Trans>{nbSansPersonne} sans personne</Trans>
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
  const { t } = useLingui()
  const utiles = avancement.total - avancement.abandonnees
  const pourcentage =
    utiles === 0 ? 0 : Math.round((avancement.faites / utiles) * 100)

  // Seul un périmètre sans aucune tâche est vide. Un périmètre dont toutes les
  // tâches sont abandonnées affiche 0 % et le compte de ses abandons.
  if (avancement.total === 0) {
    return (
      <div className="rt-meta">
        <PastilleEtat>{t`Aucune tâche`}</PastilleEtat>
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
            <Trans>{pourcentage} % des tâches faites</Trans>
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
          aria-label={t`Tâches faites`}
        >
          <span style={{ width: `${pourcentage}%`, background: couleur }} />
        </div>
        <Signalements avancement={avancement} />
      </div>
    )
  }

  const nbFaites = avancement.faites
  const nbEnCours = avancement.enCours
  const nbAFaire = avancement.aFaire
  const nbAbandonnees = avancement.abandonnees
  const detaille =
    avancement.aFaire !== undefined && avancement.enCours !== undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="rt-grand-nombre">{pourcentage} %</span>
        <span className="rt-texte-secondaire">
          <Trans>des tâches faites</Trans>
        </span>
      </div>
      <div
        className="rt-barre-empilee"
        role="progressbar"
        aria-valuenow={pourcentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t`Tâches faites`}
      >
        <span
          style={{
            width: largeur(avancement.faites, utiles),
            background: 'var(--rt-succes)',
          }}
        />
        {detaille && (
          <>
            <span
              style={{
                width: largeur(avancement.enCours!, utiles),
                background: 'var(--rt-primaire)',
              }}
            />
            <span
              style={{
                width: largeur(avancement.aFaire!, utiles),
                background: 'var(--rt-encre-40)',
              }}
            />
          </>
        )}
      </div>
      {detaille && (
        <ul className="rt-legende">
          <li>
            <span
              className="rt-point"
              style={{ background: 'var(--rt-succes)' }}
            />
            {t`${plural(nbFaites, { one: '# faite', other: '# faites' })}`}
          </li>
          <li>
            <span
              className="rt-point"
              style={{ background: 'var(--rt-primaire)' }}
            />
            <Trans>{nbEnCours} en cours</Trans>
          </li>
          <li>
            <span
              className="rt-point"
              style={{ background: 'var(--rt-encre-40)' }}
            />
            <Trans>{nbAFaire} à faire</Trans>
          </li>
          <li style={{ color: 'var(--rt-encre-55)' }}>
            <span
              className="rt-point"
              style={{ background: 'var(--rt-encre-14)' }}
            />
            {t`${plural(nbAbandonnees, {
              one: '# abandonnée',
              other: '# abandonnées',
            })}`}
          </li>
        </ul>
      )}
      <Signalements avancement={avancement} />
    </div>
  )
}
