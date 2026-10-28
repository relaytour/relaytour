import { EditOutlined, LogoutOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Form, Input, Radio, Skeleton, Switch } from 'antd'
import { useState } from 'react'

import { PreferenceAgenda } from '../composants/AbonnementAgenda'
import { DeuxColonnes, Panneau } from '../composants/Panneau'
import PreferenceLangue from '../composants/PreferenceLangue'
import PreferenceMessagerie from '../composants/PreferenceMessagerie'
import PreferenceOrganigramme from '../composants/PreferenceOrganigramme'
import PreferencePush from '../composants/PreferencePush'
import { Avatar } from '../composants/Personne'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { FrequenceResume } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { useOrganisation } from '../lib/organisation'
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
      pushEquipe
      pushAgenda
      applicationEquipe
      resumeAdmin
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
    $applicationEquipe: Boolean
    $resumeAdmin: Boolean
  ) {
    modifierPreferencesNotification(
      frequenceResume: $frequenceResume
      mailModification: $mailModification
      mailEcheance: $mailEcheance
      mailDemandes: $mailDemandes
      applicationPerimetre: $applicationPerimetre
      applicationEquipe: $applicationEquipe
      resumeAdmin: $resumeAdmin
    ) {
      frequenceResume
      mailModification
      mailEcheance
      mailDemandes
      applicationPerimetre
      applicationEquipe
      resumeAdmin
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
  applicationPerimetre: boolean
  // Présents pour les personnes qui administrent seulement (ADR 0033).
  mailDemandes?: boolean
  applicationEquipe?: boolean
  resumeAdmin?: boolean
}

export default function Preferences() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const deconnecter = useDeconnexion()
  const { data: session } = useQuery(MOI)
  const { activites } = useActivite()
  const organisation = useOrganisation()
  const nomOrganisation = organisation.nom
  // Les réglages d'admin ne s'affichent qu'à une personne qui administre une
  // activité ou l'organisation (ADR 0033).
  const administre =
    activites.some(a => a.estAdministree) || session?.moi?.estAdmin === true
  const { data } = useQuery(PREFERENCES)
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
      message.success(t`Nom enregistré.`)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const enregistrer = async (v: Valeurs) => {
    try {
      await modifier({
        variables: {
          ...v,
          mailDemandes: v.mailDemandes ?? null,
          applicationEquipe: v.applicationEquipe ?? null,
          resumeAdmin: v.resumeAdmin ?? null,
        },
      })
      message.success(t`Préférences enregistrées.`)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Titre
        sousTitre={t`Choisissez les mails et les notifications que vous recevez de ${nomOrganisation}. Vos autres organisations gardent leurs propres réglages.`}
      >
        <Trans>Préférences</Trans>
      </Titre>
      {!data ? (
        <Skeleton active />
      ) : (
        <DeuxColonnes
          cote={
            <>
              {session?.moi && (
                <Panneau titre={t`Votre compte`}>
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
                        label={t`Prénom et nom`}
                        name="nom"
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: t`Saisissez un nom.`,
                          },
                        ]}
                        extra={t`Ce nom s’affiche dans toutes vos organisations.`}
                      >
                        <Input autoComplete="name" maxLength={120} />
                      </Form.Item>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={renommage.loading}
                        >
                          <Trans>Enregistrer</Trans>
                        </Button>
                        <Button onClick={() => setNomEnEdition(false)}>
                          <Trans>Annuler</Trans>
                        </Button>
                      </div>
                    </Form>
                  ) : (
                    <Button
                      icon={<EditOutlined />}
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => setNomEnEdition(true)}
                    >
                      <Trans>Modifier mon nom</Trans>
                    </Button>
                  )}
                  <p className="rt-note">
                    <Trans>
                      Les admins gèrent votre adresse et vos affectations.
                    </Trans>
                  </p>
                  <Button
                    icon={<LogoutOutlined />}
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => void deconnecter()}
                  >
                    <Trans>Se déconnecter</Trans>
                  </Button>
                </Panneau>
              )}
              <Panneau teinte titre={t`Les notifications dans l’espace`}>
                <p className="rt-texte-secondaire">
                  <Trans>
                    La cloche de la barre haute affiche les nouvelles de vos
                    tâches, quel que soit votre choix pour les mails. Elle se
                    met à jour sans recharger la page.
                  </Trans>
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
                  <Trans>Résumé par mail</Trans>
                </span>
              }
              name="frequenceResume"
              extra={t`Le résumé regroupe les nouvelles non lues de vos périmètres et vos échéances des 14 prochains jours. Il part à 7 h, à l’heure de votre organisation.`}
            >
              <Radio.Group>
                <Radio value="QUOTIDIEN">
                  <span className="rt-choix-titre">
                    <Trans>Chaque jour</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>Un mail chaque matin, s’il y a du nouveau.</Trans>
                  </span>
                </Radio>
                <Radio value="HEBDOMADAIRE">
                  <span className="rt-choix-titre">
                    <Trans>Chaque lundi</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>Un seul mail pour la semaine.</Trans>
                  </span>
                </Radio>
                <Radio value="AUCUN">
                  <span className="rt-choix-titre">
                    <Trans>Jamais</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>Vous consultez l’espace vous-même.</Trans>
                  </span>
                </Radio>
              </Radio.Group>
            </Form.Item>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                <Trans>Mails immédiats</Trans>
              </span>
              <div className="rt-reglage">
                <label htmlFor="mailModification">
                  <span className="rt-choix-titre">
                    <Trans>Modification de vos tâches</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>
                      Un mail immédiat quand une autre personne modifie une
                      tâche qui vous est assignée.
                    </Trans>
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
                  <span className="rt-choix-titre">
                    <Trans>Échéances</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>
                      Un mail le matin quand une de vos tâches arrive à échéance
                      dans 7 jours ou le lendemain, ou qu’elle est en retard.
                    </Trans>
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
                flexDirection: 'column',
                gap: 12,
                marginTop: 24,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                <Trans>Dans l’espace organisateur</Trans>
              </span>
              <div className="rt-reglage">
                <label htmlFor="applicationPerimetre">
                  <span className="rt-choix-titre">
                    <Trans>Activité de vos périmètres</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>
                      Une notification quand une autre personne crée, modifie ou
                      termine une tâche ou une fiche de vos périmètres. Aucun
                      mail ne part.
                    </Trans>
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

            {administre && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginTop: 24,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  <Trans>Vos rôles d’admin</Trans>
                </span>
                <p className="rt-texte-secondaire" style={{ margin: 0 }}>
                  <Trans>
                    Les notifications d’admin ont leur écran, à part de la
                    cloche. Les demandes et les invitations s’y affichent
                    toujours.
                  </Trans>
                </p>
                <div className="rt-reglage">
                  <label htmlFor="mailDemandes">
                    <span className="rt-choix-titre">
                      <Trans>Demandes pour rejoindre l’équipe</Trans>
                    </span>
                    <span className="rt-choix-detail">
                      <Trans>
                        Un mail par heure au plus quand une activité que vous
                        administrez reçoit des demandes.
                      </Trans>
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
                <div className="rt-reglage">
                  <label htmlFor="applicationEquipe">
                    <span className="rt-choix-titre">
                      <Trans>Équipe de vos activités</Trans>
                    </span>
                    <span className="rt-choix-detail">
                      <Trans>
                        Une notification quand un autre admin affecte, retire ou
                        nomme une personne, ou quand une personne formule un
                        souhait. Aucun mail ne part.
                      </Trans>
                    </span>
                  </label>
                  <Form.Item
                    name="applicationEquipe"
                    valuePropName="checked"
                    noStyle
                  >
                    <Switch id="applicationEquipe" />
                  </Form.Item>
                </div>
                <div className="rt-reglage">
                  <label htmlFor="resumeAdmin">
                    <span className="rt-choix-titre">
                      <Trans>Dans le résumé par mail</Trans>
                    </span>
                    <span className="rt-choix-detail">
                      <Trans>
                        Le résumé reprend aussi vos notifications d’admin non
                        lues, dans une section à part.
                      </Trans>
                    </span>
                  </label>
                  <Form.Item name="resumeAdmin" valuePropName="checked" noStyle>
                    <Switch id="resumeAdmin" />
                  </Form.Item>
                </div>
              </div>
            )}

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
                <Trans>
                  Les mails de connexion et d’invitation partent toujours : ils
                  sont nécessaires pour accéder à l’espace.
                </Trans>
              </p>
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={modification.loading}
              >
                <Trans>Enregistrer</Trans>
              </Button>
            </div>
          </Form>
          <PreferencePush
            preferences={data.mesPreferencesNotification}
            administre={administre}
            requeteARelire={PREFERENCES}
          />
          <PreferenceLangue />
          {/* L'abonnement personnel ne sert que les activités au module agenda
              actif (ADR 0052). */}
          {activites.some(a => a.modules.includes('AGENDA')) && (
            <PreferenceAgenda />
          )}
          <PreferenceOrganigramme />
          {/* Seuls les admins écrivent un message (ADR 0020). */}
          {(administre || session?.moi?.estAdmin) && <PreferenceMessagerie />}
        </DeuxColonnes>
      )}
    </>
  )
}
