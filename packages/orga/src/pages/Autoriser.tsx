import { SafetyOutlined } from '@ant-design/icons'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Alert,
  Button,
  Card,
  Radio,
  Result,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import Marque from '../composants/Marque'
import { graphql } from '../gql'
import type { PorteeJeton } from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'
import { API_ORGANISATION, apiOuverte } from '../lib/jetons'
import { MES_ORGANISATIONS, MOI } from '../lib/requetes'
import { choisirOrganisation } from '../lib/selection'
import { memoriserSuite } from '../lib/suite-connexion'

// Écran de consentement d'une application tierce (ADR 0067). L'application envoie
// la personne ici par /oauth/autoriser. La personne choisit l'organisation, la
// portée et les activités, puis accepte ou refuse. Le serveur rend l'adresse de
// retour de l'application, que le navigateur suit. L'écran ne charge rien de
// l'application : ni logo, ni script, et il ne s'affiche jamais dans un cadre.

const DEMANDE = graphql(`
  query DemandeAutorisation($id: ID!) {
    demandeAutorisation(id: $id) {
      id
      hoteRetour
      ecritureDemandee
      application {
        nom
        clientId
        hote
        verifiee
      }
    }
  }
`)

const ACTIVITES_CONSENTEMENT = graphql(`
  query ActivitesConsentement {
    activites {
      id
      nom
    }
  }
`)

const ACCORDER = graphql(`
  mutation AccorderDemandeAutorisation(
    $id: ID!
    $portee: PorteeJeton!
    $activiteIds: [ID!]
  ) {
    accorderDemandeAutorisation(
      id: $id
      portee: $portee
      activiteIds: $activiteIds
    )
  }
`)

const REFUSER = graphql(`
  mutation RefuserDemandeAutorisation($id: ID!) {
    refuserDemandeAutorisation(id: $id)
  }
`)

export default function Autoriser() {
  const { t } = useLingui()
  const { pathname } = useLocation()
  const { data, loading, error } = useQuery(MOI)
  if (loading && !data) {
    return (
      <PageSeule>
        <Skeleton active />
      </PageSeule>
    )
  }
  if (error) {
    return (
      <PageSeule>
        <Result
          status="warning"
          title={t`L’espace organisateur ne répond pas.`}
          subTitle={t`Vérifiez votre connexion, puis rechargez la page.`}
        />
      </PageSeule>
    )
  }
  if (!data?.moi) return <VersConnexion chemin={pathname} />
  return <Consentement />
}

/** La personne se connecte d'abord, puis revient sur cet écran. */
function VersConnexion({ chemin }: { chemin: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    memoriserSuite(chemin)
    navigate('/connexion', { replace: true })
  }, [chemin, navigate])
  return (
    <PageSeule>
      <Skeleton active />
    </PageSeule>
  )
}

function PageSeule({ children }: { children: ReactNode }) {
  return (
    <main
      className="rt-page-seule"
      style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}
    >
      <div className="rt-halo rt-halo-1" aria-hidden="true" />
      <div className="rt-halo rt-halo-2" aria-hidden="true" />
      {/* minWidth: 0 : un nom long ne fait pas déborder la carte sur un téléphone. */}
      <Card
        style={{ width: '100%', maxWidth: 560, minWidth: 0 }}
        styles={{ body: { padding: 24, overflowWrap: 'anywhere' } }}
      >
        <Marque taille={30} />
        {children}
      </Card>
    </main>
  )
}

function Consentement() {
  const { t } = useLingui()
  const apollo = useApolloClient()
  const { id = '' } = useParams()
  const { data: demandeLue, loading } = useQuery(DEMANDE, {
    variables: { id },
    fetchPolicy: 'network-only',
  })
  const { data: orgs } = useQuery(MES_ORGANISATIONS)
  const organisations = (orgs?.mesOrganisations ?? []).filter(
    o => o.statut !== 'SUSPENDUE'
  )
  const active = organisations.find(o => o.active)
  const { data: api } = useQuery(API_ORGANISATION, { skip: !active })
  const { data: activitesLues } = useQuery(ACTIVITES_CONSENTEMENT, {
    skip: !active,
  })
  const [accorder, accord] = useMutation(ACCORDER)
  const [refuser, refus] = useMutation(REFUSER)
  const demande = demandeLue?.demandeAutorisation
  // La portée proposée par défaut est celle que l'application demande.
  const [porteeChoisie, setPortee] = useState<PorteeJeton | null>(null)
  const portee: PorteeJeton =
    porteeChoisie ??
    (demande?.ecritureDemandee ? 'LECTURE_ECRITURE' : 'LECTURE')
  const [toutes, setToutes] = useState(true)
  const [choisies, setChoisies] = useState<string[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  if (loading && !demandeLue) {
    return (
      <PageSeule>
        <Skeleton active />
      </PageSeule>
    )
  }
  if (!demande) {
    return (
      <PageSeule>
        <Result
          status="info"
          title={t`Cette demande d’autorisation n’est plus valable.`}
          subTitle={t`Recommencez depuis l’application.`}
        />
      </PageSeule>
    )
  }

  const application = demande.application
  const nomApplication = application.nom
  const hoteApplication = application.hote
  const hoteRetour = demande.hoteRetour
  const ouverte = apiOuverte(api?.apiOrganisation.etat)
  const activites = activitesLues?.activites ?? []

  const changerOrganisation = async (slug: string) => {
    choisirOrganisation(slug)
    setChoisies([])
    setToutes(true)
    await apollo.resetStore()
  }

  // Le navigateur part vers l'application avec le code, ou avec le refus.
  const suivre = (adresse: string | null | undefined) => {
    if (adresse) window.location.assign(adresse)
  }

  const accepter = async () => {
    setErreur(null)
    try {
      const r = await accorder({
        variables: { id, portee, activiteIds: toutes ? null : choisies },
      })
      suivre(r.data?.accorderDemandeAutorisation)
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  const decliner = async () => {
    setErreur(null)
    try {
      const r = await refuser({ variables: { id } })
      suivre(r.data?.refuserDemandeAutorisation)
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  const organisation = active?.nom ?? ''
  return (
    <PageSeule>
      <h1
        className="rt-titre"
        style={{
          fontSize: 'calc(26px * var(--rt-titre-echelle))',
          margin: '0 0 6px',
        }}
      >
        {active ? (
          <Trans>
            {nomApplication} demande l’accès à votre compte dans {organisation}
          </Trans>
        ) : (
          <Trans>{nomApplication} demande l’accès à votre compte</Trans>
        )}
      </h1>
      <Typography.Paragraph style={{ color: 'var(--rt-encre-70)' }}>
        <SafetyOutlined />{' '}
        {hoteApplication ? (
          <Trans>Application publiée par {hoteApplication}.</Trans>
        ) : (
          <Trans>Application enregistrée par elle-même.</Trans>
        )}{' '}
        {application.verifiee ? null : (
          <Tag color="warning">{t`Non vérifiée`}</Tag>
        )}
      </Typography.Paragraph>
      {!application.verifiee && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={t`Cette application s’est enregistrée elle-même. Son nom n’est pas vérifié.`}
        />
      )}

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {organisations.length > 1 && (
          <Select
            aria-label={t`Organisation`}
            placeholder={t`Choisir une organisation`}
            value={active?.slug}
            onChange={slug => void changerOrganisation(slug)}
            options={organisations.map(o => ({ value: o.slug, label: o.nom }))}
            style={{ width: '100%' }}
          />
        )}

        {active && api !== undefined && !ouverte && (
          <Alert
            type="info"
            showIcon
            title={t`L’API de cette organisation est inactive.`}
            description={t`Un admin de l’organisation l’active dans l’écran « Organisation ». L’application ne peut pas recevoir d’accès d’ici là.`}
          />
        )}

        {active && ouverte && (
          <>
            <div>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                <Trans>
                  Elle pourra lire ce que vous voyez dans les activités choisies
                  : tâches, fiches, agenda et équipe.
                </Trans>
              </Typography.Paragraph>
              {demande.ecritureDemandee && (
                <Radio.Group
                  value={portee}
                  onChange={e => setPortee(e.target.value as PorteeJeton)}
                  options={[
                    {
                      value: 'LECTURE_ECRITURE',
                      label: t`Lecture et écriture`,
                    },
                    { value: 'LECTURE', label: t`Lecture seule` },
                  ]}
                />
              )}
              {portee === 'LECTURE_ECRITURE' && (
                <Typography.Paragraph style={{ margin: '8px 0 0' }}>
                  <Trans>
                    Elle pourra aussi écrire en votre nom : créer et modifier
                    des tâches, et les commenter.
                  </Trans>
                </Typography.Paragraph>
              )}
            </div>
            <div>
              <Radio.Group
                value={toutes ? 'toutes' : 'choix'}
                onChange={e => setToutes(e.target.value === 'toutes')}
                options={[
                  { value: 'toutes', label: t`Toutes mes activités` },
                  { value: 'choix', label: t`Seulement ces activités` },
                ]}
              />
              {!toutes && (
                <Select
                  mode="multiple"
                  aria-label={t`Activités de l’application`}
                  placeholder={t`Choisir des activités`}
                  optionFilterProp="label"
                  value={choisies}
                  onChange={setChoisies}
                  options={activites.map(a => ({
                    value: a.id,
                    label: a.nom,
                  }))}
                  style={{ width: '100%', marginTop: 8 }}
                />
              )}
            </div>
            <Typography.Paragraph className="rt-note" style={{ margin: 0 }}>
              <Trans>
                Elle agit avec vos droits, jamais plus. Elle ne peut ni gérer
                les membres, ni créer de jetons, ni modifier votre compte.
              </Trans>
            </Typography.Paragraph>
          </>
        )}

        <Typography.Paragraph className="rt-note" style={{ margin: 0 }}>
          <Trans>Après votre réponse, vous reviendrez sur {hoteRetour}.</Trans>{' '}
          <Trans>
            Vous pouvez retirer cet accès à tout moment dans vos préférences,
            section « Applications autorisées ».
          </Trans>
        </Typography.Paragraph>

        {erreur && <Alert type="error" showIcon title={erreur} />}

        <Space wrap>
          <Button
            type="primary"
            size="large"
            loading={accord.loading}
            disabled={!active || !ouverte || (!toutes && choisies.length === 0)}
            onClick={() => void accepter()}
          >
            <Trans>Autoriser</Trans>
          </Button>
          <Button
            size="large"
            loading={refus.loading}
            onClick={() => void decliner()}
          >
            <Trans>Refuser</Trans>
          </Button>
        </Space>
      </Space>
    </PageSeule>
  )
}
