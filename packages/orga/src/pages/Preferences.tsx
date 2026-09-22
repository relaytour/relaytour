import { LogoutOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Form, Radio, Skeleton, Switch } from 'antd'

import { DeuxColonnes, Panneau } from '../composants/Panneau'
import { Avatar } from '../composants/Personne'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { FrequenceResume } from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'
import { MOI } from '../lib/requetes'
import { useDeconnexion } from '../lib/session'

const PREFERENCES = graphql(`
  query MesPreferencesNotification {
    mesPreferencesNotification {
      frequenceResume
      mailModification
      mailEcheance
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierPreferencesNotification(
    $frequenceResume: FrequenceResume!
    $mailModification: Boolean!
    $mailEcheance: Boolean!
  ) {
    modifierPreferencesNotification(
      frequenceResume: $frequenceResume
      mailModification: $mailModification
      mailEcheance: $mailEcheance
    ) {
      frequenceResume
      mailModification
      mailEcheance
    }
  }
`)

interface Valeurs {
  frequenceResume: FrequenceResume
  mailModification: boolean
  mailEcheance: boolean
}

export default function Preferences() {
  const { message } = App.useApp()
  const deconnecter = useDeconnexion()
  const { data: session } = useQuery(MOI)
  const { data, loading } = useQuery(PREFERENCES)
  const [modifier, modification] = useMutation(MODIFIER, {
    refetchQueries: [PREFERENCES],
  })

  const enregistrer = async (v: Valeurs) => {
    try {
      await modifier({ variables: v })
      message.success('Préférences enregistrées.')
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre sousTitre="Choisissez les mails que vous recevez. Les notifications restent visibles dans l’espace organisateur.">
        Préférences
      </Titre>
      {loading || !data ? (
        <Skeleton active />
      ) : (
        <DeuxColonnes
          cote={
            <>
              {session?.moi && (
                <Panneau titre="Votre compte">
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <Avatar nom={session.moi.nom} encre taille={44} />
                    <span
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 600 }}>
                        {session.moi.nom}
                      </span>
                      <span
                        className="rt-compte"
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {session.moi.email}
                      </span>
                    </span>
                  </div>
                  <p className="rt-note">
                    Les admins gèrent votre nom, votre adresse et vos
                    affectations.
                  </p>
                  <Button
                    icon={<LogoutOutlined />}
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => void deconnecter()}
                  >
                    Se déconnecter
                  </Button>
                </Panneau>
              )}
              <Panneau teinte titre="Les notifications dans l’espace">
                <p className="rt-texte-secondaire">
                  Quel que soit votre choix, la cloche de la barre haute affiche
                  l’activité de vos périmètres. Elle se rafraîchit chaque
                  minute.
                </p>
              </Panneau>
            </>
          }
        >
          <Form
            className="rt-verre rt-panneau"
            style={{ gap: 0, padding: '26px 30px' }}
            layout="vertical"
            initialValues={data.mesPreferencesNotification}
            onFinish={v => void enregistrer(v)}
          >
            <Form.Item
              className="rt-choix"
              label={
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  Résumé par mail
                </span>
              }
              name="frequenceResume"
              extra="Le résumé regroupe l’activité non lue de vos périmètres et vos échéances des 14 prochains jours. Il part à 7 h."
            >
              <Radio.Group>
                <Radio value="QUOTIDIEN">
                  <span className="rt-choix-titre">Chaque jour</span>
                  <span className="rt-choix-detail">
                    Un mail chaque matin, s’il y a du nouveau.
                  </span>
                </Radio>
                <Radio value="HEBDOMADAIRE">
                  <span className="rt-choix-titre">Chaque lundi</span>
                  <span className="rt-choix-detail">
                    Un seul mail pour la semaine.
                  </span>
                </Radio>
                <Radio value="AUCUN">
                  <span className="rt-choix-titre">Jamais</span>
                  <span className="rt-choix-detail">
                    Vous consultez l’espace vous-même.
                  </span>
                </Radio>
              </Radio.Group>
            </Form.Item>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                Mails immédiats
              </span>
              <div className="rt-reglage">
                <label htmlFor="mailModification">
                  <span className="rt-choix-titre">
                    Modification de vos tâches
                  </span>
                  <span className="rt-choix-detail">
                    Un mail immédiat quand une autre personne modifie une tâche
                    qui vous est assignée.
                  </span>
                </label>
                <Form.Item
                  name="mailModification"
                  valuePropName="checked"
                  noStyle
                >
                  <Switch id="mailModification" />
                </Form.Item>
              </div>
              <div className="rt-reglage">
                <label htmlFor="mailEcheance">
                  <span className="rt-choix-titre">Échéances</span>
                  <span className="rt-choix-detail">
                    Un mail le matin quand une de vos tâches arrive à échéance
                    dans 7 jours ou le lendemain, ou qu’elle est en retard.
                  </span>
                </label>
                <Form.Item name="mailEcheance" valuePropName="checked" noStyle>
                  <Switch id="mailEcheance" />
                </Form.Item>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginTop: 24,
              }}
            >
              <p className="rt-note" style={{ maxWidth: 400 }}>
                Les mails de connexion et d’invitation partent toujours : ils
                sont nécessaires pour accéder à l’espace.
              </p>
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={modification.loading}
              >
                Enregistrer
              </Button>
            </div>
          </Form>
        </DeuxColonnes>
      )}
    </>
  )
}
