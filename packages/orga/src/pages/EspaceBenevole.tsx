import { CalendarOutlined, CheckOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
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

export default function EspaceBenevole() {
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
      message.success('Merci ! Votre participation est confirmée.')
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const quitterPlace = (ref: string, titre: string) =>
    void modal.confirm({
      title: `Quitter « ${titre} » ?`,
      content: 'L’équipe est prévenue que vous ne viendrez pas sur ce moment.',
      okText: 'Quitter cette place',
      okButtonProps: { danger: true },
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          await quitter({ variables: { jeton, ref } })
          message.success('Votre place est libérée.')
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })

  const supprimerFiche = () =>
    void modal.confirm({
      title: 'Supprimer vos informations ?',
      content:
        'Votre fiche de bénévole et vos disponibilités disparaissent. Ce lien cessera de fonctionner.',
      okText: 'Supprimer',
      okButtonProps: { danger: true },
      cancelText: 'Annuler',
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
            title="Vos informations sont supprimées."
            subTitle="Merci pour votre aide."
          />
        ) : loading && !data ? (
          <Skeleton active />
        ) : !espace ? (
          <Result
            status="info"
            title="Ce lien n’est plus valable."
            subTitle="Utilisez le lien du dernier mail reçu, ou contactez l’organisation."
          />
        ) : (
          <>
            <h1 className="rt-titre rt-titre-public">Bonjour {espace.nom}</h1>
            <Typography.Paragraph style={{ color: 'var(--rt-encre-70)' }}>
              Vos places de bénévole pour « {espace.activite} »
            </Typography.Paragraph>

            {aConfirmer && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                title={
                  espace.confirme
                    ? 'De nouvelles places attendent votre confirmation.'
                    : espace.places.some(p => !p.confirmee)
                      ? 'L’équipe vous propose ces places. Confirmez-vous votre participation ?'
                      : 'Confirmez votre participation pour recevoir les changements de vos places par mail.'
                }
                description={
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={confirmation.loading}
                    onClick={() => void confirmerParticipation()}
                    style={{ marginTop: 8 }}
                  >
                    Je confirme ma participation
                  </Button>
                }
              />
            )}

            {espace.places.length === 0 ? (
              <Empty description="Vous n’avez aucune place à venir." />
            ) : (
              <ul className="rt-places-publiques">
                {espace.places.map(p => (
                  <li key={p.ref} className="rt-place-publique">
                    <div className="rt-moment-tete">
                      <strong>{p.titre}</strong>
                      <Tag color={p.confirmee ? 'success' : 'warning'}>
                        {p.confirmee ? 'Confirmée' : 'À confirmer'}
                      </Tag>
                    </div>
                    <span className="rt-note">
                      {libelleJours(p.jour)}, {p.heureDebut} → {p.heureFin}
                      {p.lieu && ` · ${p.lieu}`}
                      {p.perimetre && ` · ${p.perimetre}`}
                    </span>
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
                      Je ne peux plus venir
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
                Ajouter à mon agenda
              </Button>
            )}

            {espace.plages.length > 0 && (
              <>
                <h2 className="rt-intertitre-public">Vos disponibilités</h2>
                <ul className="rt-plages-publiques">
                  {espace.plages.map(p => (
                    <li key={`${p.jour}-${p.heureDebut}-${p.jourFin}`}>
                      <Tag>
                        {libelleJours(p.jour)}, {p.heureDebut} → {p.heureFin}
                        {p.jourFin !== p.jour && ' le lendemain'}
                      </Tag>
                    </li>
                  ))}
                </ul>
                <Typography.Paragraph className="rt-note">
                  Pour changer vos disponibilités, écrivez à l’organisation.
                </Typography.Paragraph>
              </>
            )}

            <section className="rt-espace-pied">
              <Typography.Paragraph className="rt-note">
                Gardez ce lien : il reste le même. Pour toute question, écrivez
                à l’organisation
                {espace.contact && (
                  <>
                    {' '}
                    à <a href={`mailto:${espace.contact}`}>{espace.contact}</a>
                  </>
                )}
                .
              </Typography.Paragraph>
              <Button
                type="link"
                danger
                disabled={espace.places.length > 0}
                onClick={supprimerFiche}
                style={{ paddingInline: 0 }}
              >
                Supprimer mes informations
              </Button>
              {espace.places.length > 0 && (
                <Typography.Paragraph className="rt-note">
                  Quittez d’abord vos places à venir pour supprimer vos
                  informations.
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
