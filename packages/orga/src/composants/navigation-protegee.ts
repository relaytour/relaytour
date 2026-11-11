import { useLingui } from '@lingui/react/macro'
import { App } from 'antd'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import { aDesModificationsEnCours } from '../lib/modifications-en-cours'

/**
 * Navigue vers un chemin de l'espace, après confirmation quand une saisie en cours
 * n'est pas enregistrée (ADR 0065). Rend vrai quand la navigation a eu lieu.
 */
export function useNavigationProtegee(): (chemin: string) => Promise<boolean> {
  const { t } = useLingui()
  const { modal } = App.useApp()
  const navigate = useNavigate()
  return useCallback(
    async (chemin: string) => {
      if (aDesModificationsEnCours()) {
        const quitter = await modal.confirm({
          title: t`Quitter cette page ?`,
          content: t`Une saisie en cours n’est pas enregistrée. Elle sera perdue si vous quittez la page.`,
          okText: t`Quitter la page`,
          cancelText: t`Rester sur la page`,
        })
        if (!quitter) return false
      }
      navigate(chemin)
      return true
    },
    [modal, navigate, t]
  )
}
