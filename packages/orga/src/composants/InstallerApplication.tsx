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

const ETAPES: Record<Appareil, string[]> = {
  iphone: [
    'Ouvrez cette page dans Safari.',
    'Touchez le bouton « Partager », en bas de l’écran.',
    'Faites défiler la liste, puis touchez « Sur l’écran d’accueil ».',
    'Touchez « Ajouter ».',
  ],
  android: [
    'Ouvrez cette page dans Chrome.',
    'Touchez le menu « ⋮ », en haut à droite.',
    'Touchez « Ajouter à l’écran d’accueil », puis « Installer ».',
  ],
  ordinateur: [
    'Ouvrez cette page dans Chrome ou dans Edge.',
    'Cliquez sur l’icône d’installation, à droite de la barre d’adresse.',
    'Cliquez sur « Installer ».',
  ],
}

const CHOIX: { value: Appareil; label: string }[] = [
  { value: 'iphone', label: 'iPhone' },
  { value: 'android', label: 'Android' },
  { value: 'ordinateur', label: 'Ordinateur' },
]

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
  const { nomCourt, modesDEmploi } = useOrganisation()
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
      title="Installer l’application"
      footer={null}
      onCancel={onFermer}
      destroyOnHidden
    >
      <Typography.Paragraph>
        L’application installée s’ouvre depuis l’écran d’accueil, sous le nom «{' '}
        {nomCourt} », sans barre d’adresse.
      </Typography.Paragraph>
      {invite && (
        <Button
          type="primary"
          block
          style={{ marginBottom: 16 }}
          onClick={() =>
            void installer().then(acceptee => {
              if (!acceptee) return
              message.success('L’application est installée.')
              onFermer()
            })
          }
        >
          Installer
        </Button>
      )}
      <Segmented
        block
        options={CHOIX}
        value={choisi}
        onChange={setChoisi}
        style={{ marginBottom: 12 }}
      />
      <ol className="rt-etapes-installation">
        {ETAPES[choisi].map(etape => (
          <li key={etape}>{etape}</li>
        ))}
      </ol>
      {choisi === 'iphone' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="À la première ouverture, saisissez le code reçu par mail."
          description="Le lien du mail ouvre Safari, pas l’application installée."
        />
      )}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        <a
          href={lienGuideInstallation(modesDEmploi)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Lire le guide d’installation
        </a>
      </Typography.Paragraph>
    </Modal>
  )
}
