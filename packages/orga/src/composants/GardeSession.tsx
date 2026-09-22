import { useApolloClient, useQuery } from '@apollo/client/react'
import { Button, Card, Result, Spin, Typography } from 'antd'
import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router'

import { MES_ORGANISATIONS, MOI } from '../lib/requetes'
import { choisirOrganisation, organisationChoisie } from '../lib/selection'
import {
  useChangerOrganisation,
  useDeconnexion,
  type OrganisationDeLaPersonne,
  type Session,
} from '../lib/session'

import Marque from './Marque'

/**
 * Garde des écrans connectés (ADR 0008). Sans session, elle renvoie vers la
 * connexion. Une personne membre de plusieurs organisations, sans organisation
 * choisie, choisit d'abord celle où elle travaille. Un choix mémorisé qui ne
 * correspond plus à aucune appartenance est oublié.
 */
export default function GardeSession({
  children,
}: {
  children: (session: Session) => ReactNode
}) {
  const apollo = useApolloClient()
  const { data, loading, error } = useQuery(MOI)
  const {
    data: orgs,
    loading: chargementOrgs,
    error: erreurOrgs,
  } = useQuery(MES_ORGANISATIONS, { skip: !data?.moi })
  const organisations = orgs?.mesOrganisations ?? []
  const choisie = organisationChoisie()
  const choixPerime =
    orgs !== undefined &&
    choisie !== null &&
    !organisations.some(o => o.slug === choisie)

  useEffect(() => {
    if (choixPerime) {
      choisirOrganisation(null)
      void apollo.resetStore()
    }
  }, [choixPerime, apollo])

  if (loading || chargementOrgs || choixPerime) {
    return <Spin fullscreen description="Chargement" />
  }
  // Une erreur sur la liste des organisations ne se lit pas comme une liste vide.
  if (error || erreurOrgs) {
    return (
      <Result
        status="warning"
        title="L’espace organisateur ne répond pas."
        subTitle="Vérifiez votre connexion, puis rechargez la page."
      />
    )
  }
  const moi = data?.moi
  if (!moi) return <Navigate to="/connexion" replace />
  if (organisations.length === 0) {
    return (
      <EcranCentre>
        <Result
          status="info"
          title="Votre compte n’appartient à aucune organisation ouverte."
          subTitle="Un admin de votre organisation peut vous inviter de nouveau."
          extra={<BoutonDeconnexion />}
        />
      </EcranCentre>
    )
  }
  const active = organisations.find(o => o.active)
  if (active === undefined) {
    return <ChoixOrganisation organisations={organisations} />
  }
  return <>{children({ moi, organisations, active })}</>
}

function EcranCentre({ children }: { children: ReactNode }) {
  return (
    <div
      className="rt-page"
      style={{ display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div className="rt-halo rt-halo-1" aria-hidden="true" />
      <div className="rt-halo rt-halo-2" aria-hidden="true" />
      {children}
    </div>
  )
}

function BoutonDeconnexion() {
  const deconnecter = useDeconnexion()
  return <Button onClick={() => void deconnecter()}>Se déconnecter</Button>
}

function ChoixOrganisation({
  organisations,
}: {
  organisations: OrganisationDeLaPersonne[]
}) {
  const changer = useChangerOrganisation()
  return (
    <EcranCentre>
      <Card
        style={{ width: '100%', maxWidth: 440 }}
        styles={{ body: { padding: 32 } }}
      >
        <Marque taille={30} />
        <h1
          className="rt-titre"
          style={{
            fontSize: 'calc(26px * var(--rt-titre-echelle))',
            margin: '0 0 6px',
          }}
        >
          Choisir une organisation
        </h1>
        <Typography.Paragraph style={{ color: 'var(--rt-encre-70)' }}>
          Votre compte appartient à plusieurs organisations. Vous pourrez en
          changer depuis le menu de votre compte.
        </Typography.Paragraph>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 16px',
            display: 'grid',
            gap: 8,
          }}
        >
          {organisations.map(o => (
            <li key={o.slug}>
              <Button block size="large" onClick={() => void changer(o.slug)}>
                {o.nom}
              </Button>
            </li>
          ))}
        </ul>
        <BoutonDeconnexion />
      </Card>
    </EcranCentre>
  )
}
