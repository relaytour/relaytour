import { Navigate, Outlet } from 'react-router'

import { useActivite } from '../lib/activite'

/**
 * Les écrans de l'équipe d'une activité : tâches, fiches, rétroplanning et pages de
 * périmètre. Une personne qui ne fait que découvrir l'activité (ADR 0012) est menée à
 * « Tous les périmètres ». Le serveur refuse de toute façon ses lectures.
 */
export default function ReserveEquipe() {
  const { decouverte, lien } = useActivite()
  return decouverte ? <Navigate to={lien('/perimetres')} replace /> : <Outlet />
}
