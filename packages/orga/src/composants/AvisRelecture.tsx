import { Alert, Button } from 'antd'

import { useRefusDeRelecture } from '../lib/rafraichissement'

/**
 * Avis de la coquille quand la relecture des écrans rencontre un refus du serveur :
 * la session a pris fin, ou les accès de la personne ont changé. Les écrans gardent
 * leur contenu, qui peut ne plus être à jour. L'avis ne démonte rien : une saisie en
 * cours reste à l'écran jusqu'au rechargement.
 */
export default function AvisRelecture() {
  const refus = useRefusDeRelecture()
  if (!refus) return null
  return (
    <Alert
      type="warning"
      showIcon
      title="Vos accès ont changé, ou votre session a pris fin."
      description="Cet écran affiche peut-être des données que vous ne pouvez plus relire. Rechargez la page pour retrouver vos accès actuels."
      action={
        <Button onClick={() => window.location.reload()}>
          Recharger la page
        </Button>
      }
      style={{ marginBottom: 16 }}
    />
  )
}
