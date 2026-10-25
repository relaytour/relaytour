import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, App, Button, Modal, Segmented, Typography } from 'antd'
import { useState, useSyncExternalStore } from 'react'

import {
  abonnerInvite,
  appareil,
  installer,
  inviteDisponible,
  lienGuideInstallation,
  type Appareil,
} from '../lib/installation'
import { useOrganisation } from '../lib/organisation'

const ETAPES: Record<Appareil, MessageDescriptor[]> = {
  iphone: [
    msg`Ouvrez cette page dans Safari.`,
    msg`Touchez « Partager ». Sur iOS 26, ce bouton se trouve dans le menu « ··· », en bas à droite.`,
    msg`Touchez « En voir plus » si la liste est repliée, puis « Sur l’écran d’accueil ».`,
    msg`Touchez « Ajouter ».`,
  ],
  android: [
    msg`Ouvrez cette page dans Chrome.`,
    msg`Touchez le menu « ⋮ », en haut à droite.`,
    msg`Touchez « Ajouter à l’écran d’accueil », puis « Installer ».`,
  ],
  ordinateur: [
    msg`Ouvrez cette page dans Chrome ou dans Edge.`,
    msg`Cliquez sur l’icône d’installation, à droite de la barre d’adresse.`,
    msg`Cliquez sur « Installer ».`,
  ],
}

/**
 * Fenêtre « Installer l'application » du menu du compte (ADR 0023). Elle montre
 * les étapes de l'appareil utilisé. Quand le navigateur sait installer
 * l'application lui-même, un bouton le fait en un appui.
 */
export default function InstallerApplication({
  ouvert,
  onFermer,
}: {
  ouvert: boolean
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { nomCourt, modesDEmploi } = useOrganisation()
  const choix: { value: Appareil; label: string }[] = [
    { value: 'iphone', label: 'iPhone' },
    { value: 'android', label: 'Android' },
    { value: 'ordinateur', label: t`Ordinateur` },
  ]
  const { message } = App.useApp()
  const [choisi, setChoisi] = useState<Appareil>(() => appareil())
  const invite = useSyncExternalStore(
    abonnerInvite,
    inviteDisponible,
    () => false
  )
  return (
    <Modal
      open={ouvert}
      title={t`Installer l’application`}
      footer={null}
      onCancel={onFermer}
      destroyOnHidden
    >
      <Typography.Paragraph>
        <Trans>
          L’application installée s’ouvre depuis l’écran d’accueil, sous le nom
          « {nomCourt} », sans barre d’adresse.
        </Trans>
      </Typography.Paragraph>
      {invite && (
        <Button
          type="primary"
          block
          style={{ marginBottom: 16 }}
          onClick={() =>
            void installer().then(acceptee => {
              if (!acceptee) return
              message.success(t`L’application est installée.`)
              onFermer()
            })
          }
        >
          <Trans>Installer</Trans>
        </Button>
      )}
      <Segmented
        block
        options={choix}
        value={choisi}
        onChange={setChoisi}
        style={{ marginBottom: 12 }}
      />
      <ol className="rt-etapes-installation">
        {ETAPES[choisi].map(etape => (
          <li key={etape.id}>{t(etape)}</li>
        ))}
      </ol>
      {choisi === 'iphone' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t`À la première ouverture, saisissez le code reçu par mail.`}
          description={t`Le lien du mail ouvre votre navigateur, pas l’application installée.`}
        />
      )}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        <a
          href={lienGuideInstallation(modesDEmploi)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Trans>Lire le guide d’installation</Trans>
        </a>
      </Typography.Paragraph>
    </Modal>
  )
}
