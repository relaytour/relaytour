import { DisconnectOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Typography } from 'antd'
import { useEffect } from 'react'

import { useEnLigne } from '../lib/application'

/**
 * Écran affiché quand l'application s'ouvre sans réseau (ADR 0023). Elle ne
 * garde aucune donnée sur l'appareil : elle reprend au retour du réseau.
 */
export default function HorsConnexion() {
  const enLigne = useEnLigne()
  useEffect(() => {
    if (enLigne) window.location.reload()
  }, [enLigne])
  return (
    <main
      className="rt-page-seule"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Card style={{ maxWidth: 440, width: '100%' }}>
        <Typography.Title level={2} style={{ marginTop: 0 }}>
          <DisconnectOutlined aria-hidden style={{ marginInlineEnd: 12 }} />
          Hors connexion
        </Typography.Title>
        <Typography.Paragraph>
          Votre appareil n’a pas de réseau. L’espace organisateur a besoin d’une
          connexion pour afficher vos tâches et vos fiches.
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          L’application reprend dès le retour du réseau.
        </Typography.Paragraph>
        <Button type="primary" block onClick={() => window.location.reload()}>
          Réessayer
        </Button>
      </Card>
    </main>
  )
}

/**
 * Avis de la coquille quand le réseau disparaît en cours d'utilisation. L'écran
 * reste en place : une saisie en cours n'est pas perdue.
 */
export function AvisHorsConnexion() {
  const enLigne = useEnLigne()
  if (enLigne) return null
  return (
    <Alert
      type="warning"
      showIcon
      icon={<DisconnectOutlined />}
      title="Hors connexion"
      description="Votre appareil n’a plus de réseau, et vos modifications ne s’enregistrent pas. Gardez cet écran ouvert, puis réessayez au retour du réseau."
      style={{ marginBottom: 16 }}
    />
  )
}
