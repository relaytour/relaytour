import { LinkOutlined } from '@ant-design/icons'
import { useLingui } from '@lingui/react/macro'
import { Button, Dropdown } from 'antd'

import { useCopieLien, useEntreesPartage } from '../lib/copie-lien'

/**
 * Un bouton qui copie le lien d'un objet de l'activité : le lien seul, ou son
 * titre et son lien. `chemin` part de l'activité (`/fiches/accueil`).
 */
export default function BoutonPartage({
  chemin,
  titre,
}: {
  chemin: string
  titre: string
}) {
  const { t } = useLingui()
  const copier = useCopieLien()
  const entrees = useEntreesPartage()
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: entrees,
        onClick: ({ key }) =>
          void copier(chemin, key === 'partage:titre' ? titre : undefined),
      }}
    >
      <Button
        icon={<LinkOutlined />}
        aria-label={t`Partager`}
        title={t`Partager`}
      />
    </Dropdown>
  )
}
