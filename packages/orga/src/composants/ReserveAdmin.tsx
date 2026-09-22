import { Result } from 'antd'
import { Outlet } from 'react-router'

import { useActivite } from '../lib/activite'
import { useSession } from '../lib/session'

/**
 * Les écrans d'administration d'une activité : réservés à ses admins et aux admins
 * de l'organisation (ADR 0010). Avec `organisation`, réservés aux admins de
 * l'organisation. Le serveur refuse de toute façon chaque opération interdite.
 */
export default function ReserveAdmin({
  organisation = false,
}: {
  organisation?: boolean
}) {
  const { moi } = useSession()
  const { gere } = useActivite()
  const autorise = organisation ? moi.estAdmin : gere
  return autorise ? (
    <Outlet />
  ) : (
    <Result
      status="403"
      title={
        organisation
          ? 'Cette page est réservée aux admins de l’organisation.'
          : 'Cette page est réservée aux admins de l’activité.'
      }
    />
  )
}
