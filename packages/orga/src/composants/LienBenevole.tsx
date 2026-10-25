import { CopyOutlined, MailOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation } from '@apollo/client/react'
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
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
  if (f.confirmeeLe) {
    const jourConfirmation = jourDeLInstant(f.confirmeeLe)
    return t`Participation confirmée le ${jourConfirmation}.`
  }
  if (f.lienEnvoyeLe) {
    const jourEnvoi = jourDeLInstant(f.lienEnvoyeLe)
    return t`Lien envoyé le ${jourEnvoi}, sans confirmation.`
  }
  if (f.prevenirParMail && f.courriel)
    return t`Le lien partira par mail à sa première place.`
  return t`Aucun mail ne part vers cette fiche.`
}

export default function LienBenevole({ fiche }: { fiche: Fiche }) {
  const { t } = useLingui()
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
            ? t`Nouveau lien copié. L’ancien ne répond plus.`
            : t`Lien copié. Vous pouvez l’envoyer par SMS ou par message.`
        )
      } catch {
        // Un navigateur peut refuser le presse-papiers : le lien s'affiche.
        const nomBenevole = fiche.nom
        void modal.info({
          title: t`Lien personnel de ${nomBenevole}`,
          content: (
            <Typography.Paragraph copyable={{ text: adresse }}>
              <code>{adresse}</code>
            </Typography.Paragraph>
          ),
          okText: t`Fermer`,
        })
      }
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const confirmerNouveau = () =>
    void modal.confirm({
      title: t`Tirer un nouveau lien ?`,
      content: t`L’ancien lien cesse de répondre, y compris celui des mails déjà reçus. Aucun mail ne part : envoyez le nouveau lien vous-même.`,
      okText: t`Nouveau lien`,
      cancelText: t`Annuler`,
      onOk: () => copier(true),
    })

  const renvoyerParMail = async () => {
    try {
      await renvoyer({ variables: { benevoleId: fiche.id } })
      message.success(
        t`Le lien repart par mail. Ce renvoi ne se fait qu’une fois.`
      )
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <section className="rt-lien-benevole" aria-label={t`Lien personnel`}>
      <p className="rt-note">{etatDuLien(fiche)}</p>
      <Space wrap>
        <Button
          icon={<CopyOutlined />}
          loading={obtention.loading}
          onClick={() => void copier()}
        >
          {fiche.lienEspace ? t`Copier le lien` : t`Créer et copier le lien`}
        </Button>
        {fiche.lienRenvoyable && (
          <Button
            icon={<MailOutlined />}
            loading={renvoi.loading}
            onClick={() => void renvoyerParMail()}
          >
            {t`Renvoyer par mail`}
          </Button>
        )}
        {fiche.lienEspace && (
          <Button icon={<ReloadOutlined />} onClick={confirmerNouveau}>
            {t`Nouveau lien`}
          </Button>
        )}
      </Space>
    </section>
  )
}
