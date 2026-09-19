import { CloseOutlined } from '@ant-design/icons'

import { initiales } from '../lib/personnes'

/** Les initiales d'une personne dans un rond. */
export function Avatar({
  nom,
  encre = false,
  taille,
}: {
  nom: string
  encre?: boolean
  taille?: number
}) {
  return (
    <span
      className={`rt-avatar${encre ? ' rt-avatar-encre' : ''}`}
      style={
        taille
          ? { width: taille, height: taille, fontSize: taille * 0.42 }
          : undefined
      }
      aria-hidden="true"
    >
      {initiales(nom)}
    </span>
  )
}

/**
 * Une personne : ses initiales et son nom. Avec `retirer`, une croix permet de
 * la retirer (assignation d'une tâche gérée par un admin).
 */
export function PersonneNommee({
  nom,
  initialesDe,
  retirer,
  desactive = false,
}: {
  /** Le nom affiché, par exemple « Vous ». */
  nom: string
  /** Le nom dont les initiales sont tirées, s'il diffère du nom affiché. */
  initialesDe?: string
  retirer?: () => void
  desactive?: boolean
}) {
  return (
    <span className={`rt-personne${retirer ? ' rt-personne-retirable' : ''}`}>
      <Avatar nom={initialesDe ?? nom} />
      {nom}
      {retirer && (
        <button
          type="button"
          className="rt-personne-retirer"
          aria-label={`Retirer ${nom}`}
          disabled={desactive}
          onClick={retirer}
        >
          <CloseOutlined style={{ fontSize: 10 }} aria-hidden />
        </button>
      )}
    </span>
  )
}
