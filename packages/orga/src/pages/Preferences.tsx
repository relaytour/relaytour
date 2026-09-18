import { useMutation, useQuery } from '@apollo/client/react'
import {
  App,
  Button,
  Card,
  Form,
  Radio,
  Skeleton,
  Space,
  Switch,
  Typography,
} from 'antd'

import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { FrequenceResume } from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'

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
        <Card style={{ maxWidth: 640 }}>
          <Form
            layout="vertical"
            initialValues={data.mesPreferencesNotification}
            onFinish={v => void enregistrer(v)}
          >
            <Form.Item
              label="Résumé par mail"
              name="frequenceResume"
              extra="Le résumé regroupe l’activité non lue de vos périmètres et vos échéances des 14 prochains jours. Il part à 7 h."
            >
              <Radio.Group>
                <Space orientation="vertical">
                  <Radio value="QUOTIDIEN">Chaque jour</Radio>
                  <Radio value="HEBDOMADAIRE">Chaque lundi</Radio>
                  <Radio value="AUCUN">Jamais</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              label="Modification de vos tâches"
              name="mailModification"
              valuePropName="checked"
              extra="Un mail immédiat quand une autre personne modifie une tâche qui vous est assignée."
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label="Échéances"
              name="mailEcheance"
              valuePropName="checked"
              extra="Un mail le matin quand une de vos tâches arrive à échéance dans 7 jours ou le lendemain, ou qu’elle est en retard."
            >
              <Switch />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={modification.loading}
            >
              Enregistrer
            </Button>
          </Form>
          <Typography.Paragraph
            type="secondary"
            style={{ marginTop: 16, marginBottom: 0 }}
          >
            Les mails de connexion et d’invitation partent toujours : ils sont
            nécessaires pour accéder à l’espace.
          </Typography.Paragraph>
        </Card>
      )}
    </>
  )
}
