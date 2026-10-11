import { EditOutlined, LogoutOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Form, Input, Radio, Skeleton, Switch } from 'antd'
import { useState } from 'react'

import { DeuxColonnes, Panneau } from '../composants/Panneau'
import PreferenceMessagerie from '../composants/PreferenceMessagerie'
import PreferencePush from '../composants/PreferencePush'
import { Avatar } from '../composants/Personne'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { FrequenceResume } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { MOI } from '../lib/requetes'
import { useDeconnexion } from '../lib/session'

const PREFERENCES = graphql(`
  query MesPreferencesNotification {
    mesPreferencesNotification {
      frequenceResume
      mailModification
      mailEcheance
      mailDemandes
      applicationPerimetre
      pushTaches
      pushEcheances
      pushDemandes
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierPreferencesNotification(
    $frequenceResume: FrequenceResume!
    $mailModification: Boolean!
    $mailEcheance: Boolean!
    $mailDemandes: Boolean
    $applicationPerimetre: Boolean
  ) {
    modifierPreferencesNotification(
      frequenceResume: $frequenceResume
      mailModification: $mailModification
      mailEcheance: $mailEcheance
      mailDemandes: $mailDemandes
      applicationPerimetre: $applicationPerimetre
    ) {
      frequenceResume
      mailModification
      mailEcheance
      mailDemandes
      applicationPerimetre
    }
  }
`)

// Le nom appartient à la personne et vaut dans toutes ses organisations
// (ADR 0031).
const MODIFIER_MON_NOM = graphql(`
  mutation ModifierMonNom($nom: String!) {
    modifierMonNom(nom: $nom) {
      id
      nom
    }
  }
`)

interface Valeurs {
  frequenceResume: FrequenceResume
  mailModification: boolean
  mailEcheance: boolean
  // Présent pour les personnes qui administrent une activité seulement.
  mailDemandes?: boolean
  applicationPerimetre: boolean
}

export default function Preferences() {
  const { message } = App.useApp()
  const deconnecter = useDeconnexion()
  const { data: session } = useQuery(MOI)
  const { activites } = useActivite()
  // Le mail des demandes ne part qu'aux admins : le réglage ne s'affiche que pour
  // une personne qui administre au moins une activité.
  const administre = activites.some(a => a.estAdministree)
  const { data, loading } = useQuery(PREFERENCES)
  const [modifier, modification] = useMutation(MODIFIER, {
    refetchQueries: [PREFERENCES],
  })

  const [renommer, renommage] = useMutation(MODIFIER_MON_NOM, {
    refetchQueries: [MOI],
  })
  const [nomEnEdition, setNomEnEdition] = useState(false)
  const [formNom] = Form.useForm<{ nom: string }>()

  const enregistrerNom = async ({ nom }: { nom: string }) => {
    try {
      await renommer({ variables: { nom } })
      setNomEnEdition(false)
      message.success('Nom enregistré.')
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const enregistrer = async (v: Valeurs) => {
    try {
      await modifier({
        variables: { ...v, mailDemandes: v.mailDemandes ?? null },
      })
      message.success('Préférences enregistrées.')
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre sousTitre="Choisissez les mails et les notifications que vous recevez.">
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
                  {nomEnEdition ? (
                    <Form
                      form={formNom}
                      layout="vertical"
                      requiredMark={false}
                      initialValues={{ nom: session.moi.nom }}
                      onFinish={v => void enregistrerNom(v)}
                    >
                      <Form.Item
                        label="Prénom et nom"
                        name="nom"
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: 'Saisissez un nom.',
                          },
                        ]}
                        extra="Ce nom s’affiche dans toutes vos organisations."
                      >
                        <Input autoComplete="name" maxLength={120} />
                      </Form.Item>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={renommage.loading}
                        >
                          Enregistrer
                        </Button>
                        <Button onClick={() => setNomEnEdition(false)}>
                          Annuler
                        </Button>
                      </div>
                    </Form>
                  ) : (
                    <Button
                      icon={<EditOutlined />}
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => setNomEnEdition(true)}
                    >
                      Modifier mon nom
                    </Button>
                  )}
                  <p className="rt-note">
                    Les admins gèrent votre adresse et vos affectations.
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
                  La cloche de la barre haute affiche les nouvelles de vos
                  tâches, quel que soit votre choix pour les mails. Elle se met
                  à jour sans recharger la page.
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
              extra="Le résumé regroupe les nouvelles non lues de vos périmètres et vos échéances des 14 prochains jours. Il part à 7 h, à l’heure de votre organisation."
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
              {administre && (
                <div className="rt-reglage">
                  <label htmlFor="mailDemandes">
                    <span className="rt-choix-titre">
                      Demandes pour rejoindre l’équipe
                    </span>
                    <span className="rt-choix-detail">
                      Un mail par heure au plus quand une activité que vous
                      administrez reçoit des demandes.
                    </span>
                  </label>
                  <Form.Item
                    name="mailDemandes"
                    valuePropName="checked"
                    noStyle
                  >
                    <Switch id="mailDemandes" />
                  </Form.Item>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginTop: 24,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                Dans l’espace organisateur
              </span>
              <div className="rt-reglage">
                <label htmlFor="applicationPerimetre">
                  <span className="rt-choix-titre">
                    Activité de vos périmètres
                  </span>
                  <span className="rt-choix-detail">
                    Une notification quand une autre personne crée, modifie ou
                    termine une tâche ou une fiche de vos périmètres. Aucun mail
                    ne part.
                  </span>
                </label>
                <Form.Item
                  name="applicationPerimetre"
                  valuePropName="checked"
                  noStyle
                >
                  <Switch id="applicationPerimetre" />
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
          <PreferencePush
            preferences={data.mesPreferencesNotification}
            administre={administre}
            requeteARelire={PREFERENCES}
          />
          {/* Seuls les admins écrivent un message (ADR 0020). */}
          {(administre || session?.moi?.estAdmin) && <PreferenceMessagerie />}
        </DeuxColonnes>
      )}
    </>
  )
}
