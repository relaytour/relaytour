import { LinkOutlined } from '@ant-design/icons'
import { useLingui } from '@lingui/react/macro'
import { App } from 'antd'

import { useActivite } from './activite'
import { adresseComplete, copierLien } from './partage'

/** Les deux copies proposées : le lien seul, ou le titre et le lien. */
export function useCopieLien() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { lien } = useActivite()
  return async (chemin: string, titre?: string) => {
    try {
      await copierLien(adresseComplete(lien(chemin)), titre)
      message.success(
        titre === undefined
          ? t`Le lien est copié.`
          : t`Le titre et le lien sont copiés.`
      )
    } catch {
      message.error(
        t`La copie a échoué. Copiez l’adresse depuis la barre du navigateur.`
      )
    }
  }
}

/** Les entrées de menu des deux copies, à placer dans un menu « Autres actions ». */
export function useEntreesPartage() {
  const { t } = useLingui()
  return [
    { key: 'partage:lien', icon: <LinkOutlined />, label: t`Copier le lien` },
    { key: 'partage:titre', label: t`Copier le titre et le lien` },
  ]
}
