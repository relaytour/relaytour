import { Result } from 'antd'
import { Outlet } from 'react-router'

import { useSession } from '../lib/session'

/** Les écrans d'administration : réservés aux admins de l'organisation active. */
export default function ReserveAdmin() {
  const { moi } = useSession()
  return moi.estAdmin ? (
    <Outlet />
  ) : (
    <Result status="403" title="Cette page est réservée aux admins." />
  )
}
