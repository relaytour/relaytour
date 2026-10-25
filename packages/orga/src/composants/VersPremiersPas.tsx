import { Trans } from '@lingui/react/macro'
import { Button } from 'antd'
import { useNavigate } from 'react-router'

import { useActivite } from '../lib/activite'

/**
 * Bouton des écrans vides vers la liste « Premiers pas » de Mon espace (ADR 0048),
 * pour les admins de l'activité seulement.
 */
export default function VersPremiersPas() {
  const { gere, lien } = useActivite()
  const navigate = useNavigate()
  if (!gere) return null
  return (
    <Button type="primary" onClick={() => navigate(lien('/'))}>
      <Trans>Voir les premiers pas</Trans>
    </Button>
  )
}
