import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { StatutTache } from '../gql/graphql'
import { CLASSE_STATUT, STATUTS } from '../lib/taches'

export type VarianteEtat =
  'neutre' | 'en-cours' | 'faite' | 'abandonnee' | 'retard' | 'alerte'

/**
 * Une pastille d'état : un point et un libellé sur un fond teinté. Avec `lien`,
 * la pastille devient un lien (une fiche liée, par exemple).
 */
export function PastilleEtat({
  variante = 'neutre',
  children,
  icone,
  lien,
  sansPoint = false,
}: {
  variante?: VarianteEtat
  children: ReactNode
  icone?: ReactNode
  lien?: string
  sansPoint?: boolean
}) {
  const classe = `rt-etat rt-etat-${variante}${sansPoint || icone ? ' rt-sans-point' : ''}`
  const contenu = (
    <>
      {icone}
      {children}
    </>
  )
  return lien ? (
    <Link className={classe} to={lien}>
      {contenu}
    </Link>
  ) : (
    <span className={classe}>{contenu}</span>
  )
}

/** La pastille du statut d'une tâche. */
export function PastilleStatut({ statut }: { statut: StatutTache }) {
  return (
    <span className={`rt-etat ${CLASSE_STATUT[statut]}`}>
      {STATUTS[statut].libelle}
    </span>
  )
}
