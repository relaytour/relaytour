import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import type { DocumentNode } from 'graphql'
import { Alert, App, Button, Switch } from 'antd'
import { useEffect, useState } from 'react'

import { graphql } from '../gql'
import type { FrequenceResume } from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'
import { lienGuideInstallation } from '../lib/installation'
import { useOrganisation } from '../lib/organisation'
import {
  abonnementCourant,
  abonner,
  contexteAppareil,
  desabonner,
  ErreurAbonnement,
  etatPush,
  type EtatPush,
} from '../lib/push'
import { DESABONNER_PUSH } from '../lib/push-requetes'

import { Panneau } from './Panneau'

// Notifications push de cet appareil (ADR 0024). L'activation vaut pour ce
// navigateur seulement : la personne l'active sur chaque appareil. Les trois
// familles valent pour tous ses appareils.

const CLE_PUSH = graphql(`
  query ClePubliquePush {
    clePubliquePush
  }
`)

const ABONNE = graphql(`
  query AbonnePush($adresse: String!) {
    abonnePush(adresse: $adresse)
  }
`)

const ABONNER = graphql(`
  mutation AbonnerPush(
    $adresse: String!
    $p256dh: String!
    $auth: String!
    $agent: String
  ) {
    abonnerPush(adresse: $adresse, p256dh: $p256dh, auth: $auth, agent: $agent)
  }
`)

const MODIFIER_PUSH = graphql(`
  mutation ModifierPreferencesPush(
    $frequenceResume: FrequenceResume!
    $mailModification: Boolean!
    $mailEcheance: Boolean!
    $pushTaches: Boolean
    $pushEcheances: Boolean
    $pushDemandes: Boolean
  ) {
    modifierPreferencesNotification(
      frequenceResume: $frequenceResume
      mailModification: $mailModification
      mailEcheance: $mailEcheance
      pushTaches: $pushTaches
      pushEcheances: $pushEcheances
      pushDemandes: $pushDemandes
    ) {
      pushTaches
      pushEcheances
      pushDemandes
    }
  }
`)

export interface PreferencesPourPush {
  frequenceResume: FrequenceResume
  mailModification: boolean
  mailEcheance: boolean
  pushTaches: boolean
  pushEcheances: boolean
  pushDemandes: boolean
}

type Famille = 'pushTaches' | 'pushEcheances' | 'pushDemandes'

const FAMILLES: { cle: Famille; titre: string; detail: string }[] = [
  {
    cle: 'pushTaches',
    titre: 'Vos tâches',
    detail:
      'Une tâche vous est assignée ou retirée, ou une autre personne modifie une de vos tâches.',
  },
  {
    cle: 'pushEcheances',
    titre: 'Échéances',
    detail:
      'Une de vos tâches arrive à échéance dans 7 jours ou le lendemain, ou elle est en retard.',
  },
  {
    cle: 'pushDemandes',
    titre: 'Demandes pour rejoindre l’équipe',
    detail: 'Une activité que vous administrez reçoit une demande.',
  },
]

export default function PreferencePush({
  preferences,
  administre,
  requeteARelire,
}: {
  preferences: PreferencesPourPush
  /** Les demandes ne concernent que les personnes qui administrent une activité. */
  administre: boolean
  /** Requête des préférences, relue après un réglage. */
  requeteARelire: DocumentNode
}) {
  const { message } = App.useApp()
  const apollo = useApolloClient()
  const { modesDEmploi } = useOrganisation()
  const cle = useQuery(CLE_PUSH).data?.clePubliquePush ?? null
  const [abonne, setAbonne] = useState(false)
  const [permission, setPermission] = useState<
    NotificationPermission | undefined
  >(() =>
    typeof Notification === 'undefined' ? undefined : Notification.permission
  )
  const [enCours, setEnCours] = useState(false)
  const [abonnerPush] = useMutation(ABONNER)
  const [desabonnerPush] = useMutation(DESABONNER_PUSH)
  const [modifier] = useMutation(MODIFIER_PUSH, {
    refetchQueries: [requeteARelire],
  })

  // L'appareil est abonné quand le navigateur porte un abonnement que le serveur
  // connaît pour cette personne.
  useEffect(() => {
    let actif = true
    void abonnementCourant()
      .then(async courant => {
        if (courant === null) return false
        const { data } = await apollo.query({
          query: ABONNE,
          variables: { adresse: courant.adresse },
          fetchPolicy: 'network-only',
        })
        return data?.abonnePush === true
      })
      .catch(() => false)
      .then(connu => {
        if (actif) setAbonne(connu)
      })
    return () => {
      actif = false
    }
  }, [apollo])

  const etat: EtatPush = etatPush(cle, permission, abonne, contexteAppareil())
  if (etat === 'indisponible') return null

  const activer = async () => {
    if (cle === null) return
    setEnCours(true)
    try {
      const abonnement = await abonner(cle)
      setPermission(Notification.permission)
      if (abonnement === null) return
      await abonnerPush({
        variables: { ...abonnement, agent: navigator.userAgent },
      })
      setAbonne(true)
      message.success('Les notifications sont activées sur cet appareil.')
    } catch (e) {
      message.error(
        e instanceof ErreurAbonnement ? e.message : messageErreur(e)
      )
    } finally {
      setEnCours(false)
    }
  }

  const desactiver = async () => {
    setEnCours(true)
    try {
      const adresse = await desabonner()
      if (adresse !== null) await desabonnerPush({ variables: { adresse } })
      setAbonne(false)
      message.success('Les notifications sont désactivées sur cet appareil.')
    } catch (e) {
      message.error(messageErreur(e))
    } finally {
      setEnCours(false)
    }
  }

  const regler = async (famille: Famille, valeur: boolean) => {
    try {
      await modifier({
        variables: {
          frequenceResume: preferences.frequenceResume,
          mailModification: preferences.mailModification,
          mailEcheance: preferences.mailEcheance,
          [famille]: valeur,
        },
      })
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Panneau titre="Notifications sur cet appareil">
      <p className="rt-texte-secondaire">
        Votre téléphone ou votre ordinateur affiche une notification, même quand
        l’espace organisateur est fermé.
      </p>
      {etat === 'installation-requise' && (
        <Alert
          type="info"
          showIcon
          title="Installez d’abord l’application."
          description={
            <>
              Sur iPhone et iPad, les notifications n’existent que dans
              l’application installée sur l’écran d’accueil.{' '}
              <a
                href={lienGuideInstallation(modesDEmploi)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Lire le guide d’installation
              </a>
            </>
          }
        />
      )}
      {etat === 'refuse' && (
        <Alert
          type="warning"
          showIcon
          title="Les notifications sont bloquées pour ce site."
          description="Autorisez-les dans les réglages de votre navigateur ou de votre téléphone, puis revenez sur cet écran."
        />
      )}
      {etat === 'a-activer' && (
        <Button
          type="primary"
          loading={enCours}
          style={{ alignSelf: 'flex-start' }}
          onClick={() => void activer()}
        >
          Activer sur cet appareil
        </Button>
      )}
      {etat === 'active' && (
        <>
          <Alert
            type="success"
            showIcon
            title="Les notifications sont activées sur cet appareil."
            action={
              <Button loading={enCours} onClick={() => void desactiver()}>
                Désactiver
              </Button>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAMILLES.filter(f => f.cle !== 'pushDemandes' || administre).map(
              f => (
                <div className="rt-reglage" key={f.cle}>
                  <label htmlFor={f.cle}>
                    <span className="rt-choix-titre">{f.titre}</span>
                    <span className="rt-choix-detail">{f.detail}</span>
                  </label>
                  <Switch
                    id={f.cle}
                    checked={preferences[f.cle]}
                    onChange={valeur => void regler(f.cle, valeur)}
                  />
                </div>
              )
            )}
          </div>
          <p className="rt-note">
            Ces trois réglages valent pour tous vos appareils. Vos mails ne
            changent pas.
          </p>
        </>
      )}
    </Panneau>
  )
}
