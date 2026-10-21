import { CopyOutlined, MailOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation } from '@apollo/client/react'
import { App, Button, Space, Typography } from 'antd'

import { graphql } from '../gql'
import type { BenevolesQuery } from '../gql/graphql'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'

// Le lien personnel d'une fiche bénévole (ADR 0041). Il reste le même d'un mail
// à l'autre : l'équipe le copie pour l'envoyer par SMS, le renvoie une fois par
// mail, ou en tire un nouveau qui révoque l'ancien. Le serveur ne l'ouvre qu'aux
// personnes qui lisent les coordonnées de la fiche.

const LIEN = graphql(`
  mutation LienEspaceBenevole($benevoleId: ID!, $nouveau: Boolean) {
    lienEspaceBenevole(benevoleId: $benevoleId, nouveau: $nouveau)
  }
`)

const RENVOYER = graphql(`
  mutation RenvoyerLienBenevole($benevoleId: ID!) {
    renvoyerLienBenevole(benevoleId: $benevoleId)
  }
`)

type Fiche = BenevolesQuery['benevoles'][number]

/** L'état du lien d'une fiche, en une ligne. */
function etatDuLien(f: Fiche): string {
  if (f.confirmeeLe)
    return `Participation confirmée le ${jourDeLInstant(f.confirmeeLe)}.`
  if (f.lienEnvoyeLe)
    return `Lien envoyé le ${jourDeLInstant(f.lienEnvoyeLe)}, sans confirmation.`
  if (f.prevenirParMail && f.courriel)
    return 'Le lien partira par mail à sa première place.'
  return 'Aucun mail ne part vers cette fiche.'
}

export default function LienBenevole({ fiche }: { fiche: Fiche }) {
  const { message, modal } = App.useApp()
  const relire = { refetchQueries: ['Benevoles'] }
  const [lien, obtention] = useMutation(LIEN, relire)
  const [renvoyer, renvoi] = useMutation(RENVOYER, relire)

  const copier = async (nouveau = false) => {
    try {
      const { data } = await lien({
        variables: { benevoleId: fiche.id, nouveau },
      })
      const adresse = data?.lienEspaceBenevole
      if (!adresse) return
      try {
        await navigator.clipboard.writeText(adresse)
        message.success(
          nouveau
            ? 'Nouveau lien copié. L’ancien ne répond plus.'
            : 'Lien copié. Vous pouvez l’envoyer par SMS ou par message.'
        )
      } catch {
        // Un navigateur peut refuser le presse-papiers : le lien s'affiche.
        void modal.info({
          title: `Lien personnel de ${fiche.nom}`,
          content: (
            <Typography.Paragraph copyable={{ text: adresse }}>
              <code>{adresse}</code>
            </Typography.Paragraph>
          ),
          okText: 'Fermer',
        })
      }
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const confirmerNouveau = () =>
    void modal.confirm({
      title: 'Tirer un nouveau lien ?',
      content:
        'L’ancien lien cesse de répondre, y compris celui des mails déjà reçus. Aucun mail ne part : envoyez le nouveau lien vous-même.',
      okText: 'Nouveau lien',
      cancelText: 'Annuler',
      onOk: () => copier(true),
    })

  const renvoyerParMail = async () => {
    try {
      await renvoyer({ variables: { benevoleId: fiche.id } })
      message.success(
        'Le lien repart par mail. Ce renvoi ne se fait qu’une fois.'
      )
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <section className="rt-lien-benevole" aria-label="Lien personnel">
      <p className="rt-note">{etatDuLien(fiche)}</p>
      <Space wrap>
        <Button
          icon={<CopyOutlined />}
          loading={obtention.loading}
          onClick={() => void copier()}
        >
          {fiche.lienEspace ? 'Copier le lien' : 'Créer et copier le lien'}
        </Button>
        {fiche.lienRenvoyable && (
          <Button
            icon={<MailOutlined />}
            loading={renvoi.loading}
            onClick={() => void renvoyerParMail()}
          >
            Renvoyer par mail
          </Button>
        )}
        {fiche.lienEspace && (
          <Button icon={<ReloadOutlined />} onClick={confirmerNouveau}>
            Nouveau lien
          </Button>
        )}
      </Space>
    </section>
  )
}
