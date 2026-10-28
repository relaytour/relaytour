import { t } from '@lingui/core/macro'
import { App } from 'antd'
import { useEffect, useRef } from 'react'
import { Navigate, Outlet } from 'react-router'

import type { ModuleActivite } from '../gql/graphql'
import { useActivite } from '../lib/activite'

/**
 * Les écrans d'un module de l'activité (ADR 0052). Un module inactif mène à « Mon
 * espace », avec un message qui dit qui peut l'activer. Le serveur refuse de toute
 * façon ses requêtes.
 */
export default function ReserveModule({ module }: { module: ModuleActivite }) {
  const { aModule, lien } = useActivite()
  const { message } = App.useApp()
  const actif = aModule(module)
  // Le mode strict de React rejoue l'effet : le message ne part qu'une fois.
  const annonce = useRef(false)
  useEffect(() => {
    if (!actif && !annonce.current) {
      annonce.current = true
      void message.info({
        key: 'module-inactif',
        content: t`Ce module est désactivé pour cette activité. Un admin de l’activité peut l’activer dans l’écran « Activités ».`,
      })
    }
  }, [actif, message])
  return actif ? <Outlet /> : <Navigate to={lien('/')} replace />
}
