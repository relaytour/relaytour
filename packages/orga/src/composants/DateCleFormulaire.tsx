import { useApolloClient, useMutation } from '@apollo/client/react'
import { useLingui } from '@lingui/react/macro'
import { App, Form, Input, Modal } from 'antd'
import { useEffect } from 'react'

import { graphql } from '../gql'
import { lireConflit, relireApresConflit } from '../lib/conflit'
import { messageErreur } from '../lib/erreurs'

const CREER = graphql(`
  mutation CreerDateCle(
    $editionId: ID!
    $titre: String!
    $jour: Date!
    $jourFin: Date
    $description: String
  ) {
    creerDateCle(
      editionId: $editionId
      titre: $titre
      jour: $jour
      jourFin: $jourFin
      description: $description
    ) {
      id
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierDateCle(
    $id: ID!
    $titre: String!
    $jour: Date!
    $jourFin: Date
    $description: String
    $versionAttendue: Int!
  ) {
    modifierDateCle(
      id: $id
      titre: $titre
      jour: $jour
      jourFin: $jourFin
      description: $description
      versionAttendue: $versionAttendue
    ) {
      id
    }
  }
`)

/** Les champs lus d'une date clé existante. */
export interface DateCleSaisie {
  id: string
  titre: string
  jour: string
  jourFin?: string | null
  description?: string | null
  /** La version lue : le serveur refuse d'écraser une modification faite depuis. */
  version: number
}

interface Valeurs {
  titre: string
  jour: string
  jourFin?: string
  description?: string
}

export const TITRE_DATE_CLE_MAX = 120

/**
 * Fenêtre de création ou de modification d'une date clé de l'agenda (ADR 0037),
 * réservée aux admins de l'activité.
 */
export default function DateCleFormulaire({
  editionId,
  dateCle,
  onFermer,
}: {
  editionId: string
  /** La date clé à modifier, `nouvelle` pour en créer une, `null` pour fermer. */
  dateCle: DateCleSaisie | 'nouvelle' | null
  onFermer: () => void
}) {
  const { t } = useLingui()
  const longueurMaxTitre = TITRE_DATE_CLE_MAX
  const { message } = App.useApp()
  const client = useApolloClient()
  const [form] = Form.useForm<Valeurs>()
  const relire = { refetchQueries: ['Agenda'] }
  const [creer, creation] = useMutation(CREER, relire)
  const [modifier, modification] = useMutation(MODIFIER, relire)

  useEffect(() => {
    if (dateCle === null) return
    form.setFieldsValue(
      dateCle === 'nouvelle'
        ? { titre: '', jour: '', jourFin: '', description: '' }
        : {
            titre: dateCle.titre,
            jour: dateCle.jour,
            jourFin: dateCle.jourFin ?? '',
            description: dateCle.description ?? '',
          }
    )
  }, [form, dateCle])

  const enregistrer = async (v: Valeurs) => {
    const champs = {
      titre: v.titre,
      jour: v.jour,
      jourFin: v.jourFin ? v.jourFin : null,
      description: v.description ?? '',
    }
    try {
      if (dateCle === 'nouvelle') {
        await creer({ variables: { editionId, ...champs } })
        message.success(t`Date clé ajoutée.`)
      } else if (dateCle) {
        await modifier({
          variables: {
            id: dateCle.id,
            versionAttendue: dateCle.version,
            ...champs,
          },
        })
        message.success(t`Date clé enregistrée.`)
      }
      onFermer()
    } catch (e) {
      if (lireConflit(e) !== null) {
        await relireApresConflit(
          client,
          relire.refetchQueries,
          texte => message.error(texte),
          {
            relu: t`Une autre personne a modifié cette date clé depuis votre lecture. L’agenda affiche maintenant sa version : reprenez votre modification.`,
            echec: t`La date clé n’a pas pu être rechargée. Votre saisie reste à l’écran : réessayez dans un instant.`,
          },
          onFermer
        )
        return
      }
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={dateCle !== null}
      title={
        dateCle === 'nouvelle' ? t`Nouvelle date clé` : t`Modifier la date clé`
      }
      okText={t`Enregistrer`}
      cancelText={t`Annuler`}
      confirmLoading={creation.loading || modification.loading}
      onOk={() => form.submit()}
      onCancel={onFermer}
      destroyOnHidden
      rootClassName="rt-modale-pleine"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={v => void enregistrer(v)}
        requiredMark={false}
      >
        <Form.Item
          label={t`Titre`}
          name="titre"
          rules={[
            {
              required: true,
              whitespace: true,
              message: t`Saisissez un titre.`,
            },
            {
              max: TITRE_DATE_CLE_MAX,
              message: t`Le titre dépasse ${longueurMaxTitre} caractères.`,
            },
          ]}
        >
          <Input placeholder={t`Dépôt du dossier en préfecture`} />
        </Form.Item>
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16 }}>
          <Form.Item
            label={t({
              message: 'Jour',
              comment: 'Libellé : jour d’une date clé',
            })}
            name="jour"
            rules={[{ required: true, message: t`Choisissez un jour.` }]}
          >
            <Input type="date" style={{ maxWidth: 200 }} />
          </Form.Item>
          <Form.Item
            label={t`Dernier jour (facultatif)`}
            name="jourFin"
            dependencies={['jour']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_regle, valeur?: string) =>
                  !valeur || valeur >= String(getFieldValue('jour'))
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(t`Le dernier jour suit le premier.`)
                      ),
              }),
            ]}
          >
            <Input type="date" style={{ maxWidth: 200 }} />
          </Form.Item>
        </div>
        <Form.Item label={t`Description (facultative)`} name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
