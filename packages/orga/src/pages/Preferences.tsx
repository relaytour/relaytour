import { EditOutlined, LogoutOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Form, Input, Radio, Skeleton, Switch, Tag } from 'antd'
import { useState } from 'react'

import { PreferenceAgenda } from '../composants/AbonnementAgenda'
import { DeuxColonnes, Panneau } from '../composants/Panneau'
import PreferenceLangue from '../composants/PreferenceLangue'
import PreferenceMessagerie from '../composants/PreferenceMessagerie'
import PreferenceOrganigramme from '../composants/PreferenceOrganigramme'
import PreferencePush from '../composants/PreferencePush'
import { Avatar } from '../composants/Personne'
import Titre from '../composants/Titre'
import { useModelesNotification } from '../composants/modeles-notification'
import { graphql } from '../gql'
import type {
  FrequenceResume,
  MailPriorites,
  ModeleNotification,
  SuiviAdmin,
  SuiviPerimetres,
} from '../gql/graphql'
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
      suiviPerimetres
      detailContactPrincipal
      suiviAdmin
      pushTaches
      pushEcheances
      pushDemandes
      pushEquipe
      pushAgenda
      resumeAdmin
      mailPriorites
      modele
      modeleRecommande
    }
  }
`)

// Un modèle remplit les réglages en un geste (ADR 0065).
const APPLIQUER_MODELE = graphql(`
  mutation AppliquerModeleNotification($modele: ModeleNotification!) {
    appliquerModeleNotification(modele: $modele) {
      modele
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierPreferencesNotification(
    $frequenceResume: FrequenceResume!
    $mailModification: Boolean!
    $mailEcheance: Boolean!
    $mailDemandes: Boolean
    $suiviPerimetres: SuiviPerimetres
    $detailContactPrincipal: Boolean
    $suiviAdmin: SuiviAdmin
    $resumeAdmin: Boolean
    $mailPriorites: MailPriorites
  ) {
    modifierPreferencesNotification(
      frequenceResume: $frequenceResume
      mailModification: $mailModification
      mailEcheance: $mailEcheance
      mailDemandes: $mailDemandes
      suiviPerimetres: $suiviPerimetres
      detailContactPrincipal: $detailContactPrincipal
      suiviAdmin: $suiviAdmin
      resumeAdmin: $resumeAdmin
      mailPriorites: $mailPriorites
    ) {
      frequenceResume
      mailModification
      mailEcheance
      mailDemandes
      suiviPerimetres
      detailContactPrincipal
      suiviAdmin
      resumeAdmin
      mailPriorites
      modele
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
  mailPriorites: MailPriorites
  mailModification: boolean
  mailEcheance: boolean
  suiviPerimetres: SuiviPerimetres
  detailContactPrincipal: boolean
  // Présents pour les personnes qui administrent seulement (ADR 0033).
  mailDemandes?: boolean
  suiviAdmin?: SuiviAdmin
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

  const [appliquer, application] = useMutation(APPLIQUER_MODELE, {
    refetchQueries: [PREFERENCES],
    awaitRefetchQueries: true,
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
          suiviAdmin: v.suiviAdmin ?? null,
          resumeAdmin: v.resumeAdmin ?? null,
        },
      })
      message.success(t`Préférences enregistrées.`)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const appliquerModele = async (modele: ModeleNotification) => {
    try {
      await appliquer({ variables: { modele } })
      message.success(t`Modèle appliqué.`)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const modeles = useModelesNotification()

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
          <Panneau titre={t`Modèle de notifications`}>
            <p className="rt-texte-secondaire" style={{ margin: 0 }}>
              <Trans>
                Un modèle règle vos mails et vos notifications en un geste. Vous
                pouvez ensuite changer chaque réglage ci-dessous.
              </Trans>
            </p>
            <div className="rt-choix">
              <Radio.Group
                value={data.mesPreferencesNotification.modele ?? null}
                disabled={application.loading}
                onChange={e =>
                  void appliquerModele(e.target.value as ModeleNotification)
                }
              >
                {modeles.map(m => (
                  <Radio key={m.valeur} value={m.valeur}>
                    <span className="rt-choix-titre">
                      {m.titre}
                      {data.mesPreferencesNotification.modeleRecommande ===
                        m.valeur && (
                        <Tag style={{ marginInlineStart: 8 }}>
                          <Trans>Recommandé pour vous</Trans>
                        </Tag>
                      )}
                    </span>
                    <span className="rt-choix-detail">{m.detail}</span>
                  </Radio>
                ))}
              </Radio.Group>
            </div>
            {!data.mesPreferencesNotification.modele && (
              <p className="rt-note" style={{ margin: 0 }}>
                <Trans>
                  Personnalisé : vos réglages ne suivent aucun modèle.
                </Trans>
              </p>
            )}
          </Panneau>
          <Form
            // Un modèle appliqué change les réglages : le formulaire repart des
            // valeurs relues.
            key={JSON.stringify(data.mesPreferencesNotification)}
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

            <Form.Item
              className="rt-choix"
              label={
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  <Trans>Mail des priorités</Trans>
                </span>
              }
              name="mailPriorites"
              extra={t`Le mail reprend les priorités du panneau Priorités. Il part à 7 h la veille de chaque point d’équipe, ou le lundi quand aucun point n’est prévu dans la semaine.`}
            >
              <Radio.Group>
                <Radio value="MES_PERIMETRES">
                  <span className="rt-choix-titre">
                    <Trans>Mes périmètres</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>
                      Les priorités des périmètres où vous êtes affecté.
                    </Trans>
                  </span>
                </Radio>
                <Radio value="ACTIVITE">
                  <span className="rt-choix-titre">
                    <Trans>Toute l’activité</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>Les priorités de tous les périmètres.</Trans>
                  </span>
                </Radio>
                <Radio value="AUCUN">
                  <span className="rt-choix-titre">
                    <Trans>Jamais</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>Vous lisez les priorités dans l’espace.</Trans>
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
                      dans 7 jours ou le lendemain, ou qu’elle est en retard. Il
                      signale aussi les déclinaisons en retard de vos tâches
                      partagées.
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
                <Trans>Suivi de vos périmètres</Trans>
              </span>
              <Form.Item
                className="rt-choix"
                name="suiviPerimetres"
                style={{ marginBottom: 0 }}
                extra={t`Ce qui vous concerne s’affiche toujours dans la cloche : vos tâches, vos échéances, vos réunions et les décisions qui vous attendent.`}
              >
                <Radio.Group>
                  <Radio value="MOI">
                    <span className="rt-choix-titre">
                      <Trans>Ce qui vous concerne</Trans>
                    </span>
                    <span className="rt-choix-detail">
                      <Trans>Rien d’autre de vos périmètres.</Trans>
                    </span>
                  </Radio>
                  <Radio value="SUIVI">
                    <span className="rt-choix-titre">
                      <Trans>L’essentiel du périmètre</Trans>
                    </span>
                    <span className="rt-choix-detail">
                      <Trans>
                        Les tâches à prendre, les tâches faites, les
                        déclinaisons et les fiches qui concernent vos
                        périmètres.
                      </Trans>
                    </span>
                  </Radio>
                  <Radio value="DETAIL">
                    <span className="rt-choix-titre">
                      <Trans>Tout le détail</Trans>
                    </span>
                    <span className="rt-choix-detail">
                      <Trans>
                        Chaque modification, assignation et commentaire des
                        tâches et des fiches de vos périmètres.
                      </Trans>
                    </span>
                  </Radio>
                </Radio.Group>
              </Form.Item>
              <div className="rt-reglage">
                <label htmlFor="detailContactPrincipal">
                  <span className="rt-choix-titre">
                    <Trans>Périmètres dont vous êtes contact principal</Trans>
                  </span>
                  <span className="rt-choix-detail">
                    <Trans>
                      Tout le détail de ces périmètres, quel que soit le choix
                      ci-dessus. Aucun mail immédiat ne part.
                    </Trans>
                  </span>
                </label>
                <Form.Item
                  name="detailContactPrincipal"
                  valuePropName="checked"
                  noStyle
                >
                  <Switch id="detailContactPrincipal" />
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
                    cloche. Les actions à mener s’y affichent toujours.
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
                <Form.Item
                  className="rt-choix"
                  name="suiviAdmin"
                  style={{ marginBottom: 0 }}
                >
                  <Radio.Group>
                    <Radio value="ACTIONS">
                      <span className="rt-choix-titre">
                        <Trans>Les actions à mener</Trans>
                      </span>
                      <span className="rt-choix-detail">
                        <Trans>
                          Les demandes, les candidatures, les souhaits et les
                          accès à valider.
                        </Trans>
                      </span>
                    </Radio>
                    <Radio value="DETAIL">
                      <span className="rt-choix-titre">
                        <Trans>Tout le détail</Trans>
                      </span>
                      <span className="rt-choix-detail">
                        <Trans>
                          Aussi les affectations, les nominations, les
                          archivages et les demandes traitées par un autre
                          admin.
                        </Trans>
                      </span>
                    </Radio>
                  </Radio.Group>
                </Form.Item>
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
