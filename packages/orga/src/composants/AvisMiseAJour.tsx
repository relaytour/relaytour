import { Alert, Button } from 'antd'

import { useMiseAJour } from '../lib/application'

/**
 * Avis de la coquille quand une nouvelle version de l'application attend
 * (ADR 0023). La page ne se recharge qu'à la demande : une saisie en cours reste
 * à l'écran tant que la personne n'a pas choisi de recharger.
 */
export default function AvisMiseAJour() {
  const { disponible, recharger } = useMiseAJour()
  if (!disponible) return null
  return (
    <Alert
      type="info"
      showIcon
      title="Une nouvelle version est disponible."
      description="Enregistrez votre travail en cours, puis rechargez l’application pour l’utiliser."
      action={<Button onClick={recharger}>Recharger</Button>}
      style={{ marginBottom: 16 }}
    />
  )
}
