import { CalendarOutlined, CheckOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { t } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Result,
  Skeleton,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useParams } from 'react-router'

import Marque, { SignatureRelaytour } from '../composants/Marque'
import { graphql } from '../gql'
import { libelleJours } from '../lib/agenda'
import { messageErreur } from '../lib/erreurs'

// Espace d'une ou d'un bénévole (ADR 0041), ouvert par son lien personnel, sans
// session. L'ouverture ne confirme rien : la personne confirme par un bouton. Elle
// y lit ses places, leurs consignes et ses disponibilités, télécharge son agenda,
// quitte une place ou supprime sa fiche.

const ESPACE = graphql(`
  query EspaceBenevole($jeton: String!) {
    espaceBenevole(jeton: $jeton) {
      organisation
      activite
      nom
      confirme
      contact
      ics
      places {
        ref
        titre
        jour
        jourFin
        heureDebut
        heureFin
        lieu
        perimetre
        consignes
        confirmee
      }
      plages {
        jour
        jourFin
        heureDebut
        heureFin
      }
    }
  }
`)

const CONFIRMER = graphql(`
  mutation ConfirmerParticipation($jeton: String!) {
    confirmerParticipation(jeton: $jeton)
  }
`)

const QUITTER = graphql(`
  mutation QuitterPlace($jeton: String!, $ref: String!) {
    quitterPlace(jeton: $jeton, ref: $ref)
  }
`)

const SUPPRIMER = graphql(`
  mutation SupprimerMaFiche($jeton: String!) {
    supprimerMaFiche(jeton: $jeton)
  }
`)

/** L'horaire d'une place, suivi du lieu et du périmètre quand ils existent. */
function horairePlace(p: {
  jour: string
  heureDebut: string
  heureFin: string
  lieu?: string | null
  perimetre?: string | null
}): string {
  const jourPlace = libelleJours(p.jour)
  const heureDebut = p.heureDebut
  const heureFin = p.heureFin
  return [t`${jourPlace}, ${heureDebut} → ${heureFin}`, p.lieu, p.perimetre]
    .filter(Boolean)
    .join(' · ')
}

/** Une plage de disponibilité, avec la mention du lendemain quand elle passe minuit. */
function libellePlage(p: {
  jour: string
  jourFin?: string | null
  heureDebut: string
  heureFin: string
}): string {
  const jourPlage = libelleJours(p.jour)
  const heureDebut = p.heureDebut
  const heureFin = p.heureFin
  return p.jourFin !== p.jour
    ? t`${jourPlage}, ${heureDebut} → ${heureFin} le lendemain`
    : t`${jourPlage}, ${heureDebut} → ${heureFin}`
}

export default function EspaceBenevole() {
  const { t } = useLingui()
  const { jeton = '' } = useParams()
  const { message, modal } = App.useApp()
  const relire = { refetchQueries: ['EspaceBenevole'] }
  const { data, loading } = useQuery(ESPACE, {
    variables: { jeton },
    fetchPolicy: 'cache-and-network',
  })
  const [confirmer, confirmation] = useMutation(CONFIRMER, relire)
  const [quitter] = useMutation(QUITTER, relire)
  const [supprimer] = useMutation(SUPPRIMER)
  const [supprimee, setSupprimee] = useState(false)
  const espace = data?.espaceBenevole
  const nomBenevole = espace?.nom
  const nomActivite = espace?.activite
  const adresseContact = espace?.contact
  // Une adresse changée par l'équipe se confirme de nouveau, même quand toutes
  // les places le sont déjà.
  const aConfirmer =
    espace !== undefined &&
    espace !== null &&
    (!espace.confirme || espace.places.some(p => !p.confirmee))

  const telechargerAgenda = () => {
    if (!espace) return
    const lien = URL.createObjectURL(
      new Blob([espace.ics], { type: 'text/calendar;charset=utf-8' })
    )
    const a = document.createElement('a')
    a.href = lien
    a.download = 'mes-places.ics'
    a.click()
    URL.revokeObjectURL(lien)
  }

  const confirmerParticipation = async () => {
    try {
      await confirmer({ variables: { jeton } })
      message.success(t`Merci ! Votre participation est confirmée.`)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const quitterPlace = (ref: string, titre: string) =>
    void modal.confirm({
      title: t`Quitter « ${titre} » ?`,
      content: t`L’équipe est prévenue que vous ne viendrez pas sur ce moment.`,
      okText: t`Quitter cette place`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await quitter({ variables: { jeton, ref } })
          message.success(t`Votre place est libérée.`)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })

  const supprimerFiche = () =>
    void modal.confirm({
      title: t`Supprimer vos informations ?`,
      content: t`Votre fiche de bénévole et vos disponibilités disparaissent. Ce lien cessera de fonctionner.`,
      okText: t`Supprimer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await supprimer({ variables: { jeton } })
          setSupprimee(true)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })

  return (
    <main className="rt-page-seule rt-page-publique">
      <div className="rt-halo rt-halo-1" aria-hidden="true" />
      <div className="rt-halo rt-halo-2" aria-hidden="true" />
      <Card className="rt-carte-publique" styles={{ body: { padding: 28 } }}>
        <Marque taille={30} />
        {supprimee ? (
          <Result
            status="success"
            title={t`Vos informations sont supprimées.`}
            subTitle={t`Merci pour votre aide.`}
          />
        ) : loading && !data ? (
          <Skeleton active />
        ) : !espace ? (
          <Result
            status="info"
            title={t`Ce lien n’est plus valable.`}
            subTitle={t`Utilisez le lien du dernier mail reçu, ou contactez l’organisation.`}
          />
        ) : (
          <>
            <h1 className="rt-titre rt-titre-public">
              <Trans>Bonjour {nomBenevole}</Trans>
            </h1>
            <Typography.Paragraph style={{ color: 'var(--rt-encre-70)' }}>
              <Trans>Vos places de bénévole pour « {nomActivite} »</Trans>
            </Typography.Paragraph>

            {aConfirmer && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                title={
                  espace.confirme
                    ? t`De nouvelles places attendent votre confirmation.`
                    : espace.places.some(p => !p.confirmee)
                      ? t`L’équipe vous propose ces places. Confirmez-vous votre participation ?`
                      : t`Confirmez votre participation pour recevoir les changements de vos places par mail.`
                }
                description={
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={confirmation.loading}
                    onClick={() => void confirmerParticipation()}
                    style={{ marginTop: 8 }}
                  >
                    <Trans>Je confirme ma participation</Trans>
                  </Button>
                }
              />
            )}

            {espace.places.length === 0 ? (
              <Empty description={t`Vous n’avez aucune place à venir.`} />
            ) : (
              <ul className="rt-places-publiques">
                {espace.places.map(p => (
                  <li key={p.ref} className="rt-place-publique">
                    <div className="rt-moment-tete">
                      <strong>{p.titre}</strong>
                      <Tag color={p.confirmee ? 'success' : 'warning'}>
                        {p.confirmee
                          ? t({
                              message: 'Confirmée',
                              comment: 'Statut d’une place de bénévole',
                            })
                          : t({
                              message: 'À confirmer',
                              comment: 'Statut d’une place de bénévole',
                            })}
                      </Tag>
                    </div>
                    <span className="rt-note">{horairePlace(p)}</span>
                    {p.consignes && (
                      <Typography.Paragraph className="rt-texte-secondaire">
                        {p.consignes}
                      </Typography.Paragraph>
                    )}
                    <Button
                      size="small"
                      danger
                      onClick={() => quitterPlace(p.ref, p.titre)}
                    >
                      <Trans>Je ne peux plus venir</Trans>
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {espace.places.length > 0 && (
              <Button
                icon={<CalendarOutlined />}
                onClick={telechargerAgenda}
                block
                style={{ marginTop: 16 }}
              >
                <Trans>Ajouter à mon agenda</Trans>
              </Button>
            )}

            {espace.plages.length > 0 && (
              <>
                <h2 className="rt-intertitre-public">
                  <Trans>Vos disponibilités</Trans>
                </h2>
                <ul className="rt-plages-publiques">
                  {espace.plages.map(p => (
                    <li key={`${p.jour}-${p.heureDebut}-${p.jourFin}`}>
                      <Tag>{libellePlage(p)}</Tag>
                    </li>
                  ))}
                </ul>
                <Typography.Paragraph className="rt-note">
                  <Trans>
                    Pour changer vos disponibilités, écrivez à l’organisation.
                  </Trans>
                </Typography.Paragraph>
              </>
            )}

            <section className="rt-espace-pied">
              <Typography.Paragraph className="rt-note">
                {adresseContact ? (
                  <Trans>
                    Gardez ce lien : il reste le même. Pour toute question,
                    écrivez à l’organisation à{' '}
                    <a href={`mailto:${adresseContact}`}>{adresseContact}</a>.
                  </Trans>
                ) : (
                  <Trans>
                    Gardez ce lien : il reste le même. Pour toute question,
                    écrivez à l’organisation.
                  </Trans>
                )}
              </Typography.Paragraph>
              <Button
                type="link"
                danger
                disabled={espace.places.length > 0}
                onClick={supprimerFiche}
                style={{ paddingInline: 0 }}
              >
                <Trans>Supprimer mes informations</Trans>
              </Button>
              {espace.places.length > 0 && (
                <Typography.Paragraph className="rt-note">
                  <Trans>
                    Quittez d’abord vos places à venir pour supprimer vos
                    informations.
                  </Trans>
                </Typography.Paragraph>
              )}
            </section>
          </>
        )}
        <SignatureRelaytour />
      </Card>
    </main>
  )
}
