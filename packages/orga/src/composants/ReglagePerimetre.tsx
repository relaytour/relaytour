import type { ApolloCache } from '@apollo/client'
import { useApolloClient, useMutation } from '@apollo/client/react'
import { useLingui } from '@lingui/react/macro'
import {
  App,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Switch,
} from 'antd'
import { useEffect } from 'react'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { lireConflit, texteConflit } from '../lib/conflit'
import { messageErreur } from '../lib/erreurs'
import { relireLesVues } from '../lib/rafraichissement'

const CREER = graphql(`
  mutation CreerPerimetre(
    $slug: String!
    $nom: String!
    $groupe: String!
    $couleur: String
    $description: String
    $ordre: Int
  ) {
    creerPerimetre(
      slug: $slug
      nom: $nom
      groupe: $groupe
      couleur: $couleur
      description: $description
      ordre: $ordre
    ) {
      id
    }
  }
`)

// La réponse porte les champs réglés : le cache met à jour le périmètre partout où
// il est affiché, sans autre requête.
const MODIFIER = graphql(`
  mutation ModifierPerimetre(
    $id: ID!
    $nom: String!
    $groupe: String!
    $couleur: String
    $description: String
    $ordre: Int!
    $archive: Boolean!
    $versionAttendue: Int
  ) {
    modifierPerimetre(
      id: $id
      nom: $nom
      groupe: $groupe
      couleur: $couleur
      description: $description
      ordre: $ordre
      archive: $archive
      versionAttendue: $versionAttendue
    ) {
      id
      nom
      groupe
      couleur
      description
      ordre
      archive
      version
    }
  }
`)

/** Ce que la fenêtre lit d'un périmètre existant. */
export interface PerimetreRegle {
  id: string
  slug: string
  nom: string
  groupe: string
  couleur?: string | null
  description?: string | null
  ordre: number
  archive: boolean
  /** La version lue : le serveur refuse d'écraser un réglage fait depuis. */
  version: number
}

interface Valeurs {
  slug: string
  nom: string
  groupe: string
  couleur: string | null
  description: string | null
  ordre: number
  archive: boolean
}

// Les listes qui changent quand un périmètre est créé, archivé ou désarchivé. Le
// cache en garde une copie par période ou par activité déjà visitée : toutes en
// sortent, pour qu'aucune ne montre un périmètre archivé ou n'oublie un nouveau.
const CHAMPS_LISTES = [
  'appelPostes',
  'avancementGlobal',
  'mesPerimetres',
  'perimetres',
  'postesAPourvoir',
  'tousLesPerimetres',
]

function oublierLesListes(cache: ApolloCache) {
  for (const fieldName of CHAMPS_LISTES) {
    cache.evict({ id: 'ROOT_QUERY', fieldName })
  }
  cache.gc()
}

// Les listes affichées par l'écran « Équipe », relues aussitôt.
const LISTES = ['Perimetres', 'PostesAPourvoir']

/**
 * Fenêtre de réglage d'un périmètre : sa création, sa définition (nom, groupe,
 * description, couleur, ordre) et son archivage. Un périmètre reste le même d'une
 * période à l'autre : ce réglage ne dépend pas de la période affichée.
 */
export default function ReglagePerimetre({
  perimetre,
  onFermer,
}: {
  /** Le périmètre à régler, `nouveau` pour en créer un, `null` pour fermer. */
  perimetre: PerimetreRegle | 'nouveau' | null
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const client = useApolloClient()
  // Les groupes de périmètres viennent de l'activité (ADR 0008).
  const { activite } = useActivite()
  const [form] = Form.useForm<Valeurs>()
  const rafraichir = { update: oublierLesListes, refetchQueries: LISTES }
  const [creer, creation] = useMutation(CREER, rafraichir)
  const [modifier, modification] = useMutation(MODIFIER, rafraichir)
  const premierGroupe = activite.groupes[0]?.cle ?? ''

  useEffect(() => {
    if (perimetre === null) return
    form.setFieldsValue(
      perimetre === 'nouveau'
        ? {
            slug: '',
            nom: '',
            groupe: premierGroupe,
            couleur: null,
            description: null,
            ordre: 0,
            archive: false,
          }
        : {
            slug: perimetre.slug,
            nom: perimetre.nom,
            groupe: perimetre.groupe,
            couleur: perimetre.couleur ?? null,
            description: perimetre.description ?? null,
            ordre: perimetre.ordre,
            archive: perimetre.archive,
          }
    )
  }, [form, perimetre, premierGroupe])

  const enregistrer = async (v: Valeurs) => {
    const couleur =
      typeof v.couleur === 'string'
        ? v.couleur
        : ((
            v.couleur as { toHexString?: () => string } | null
          )?.toHexString?.() ?? null)
    try {
      if (perimetre === 'nouveau') {
        await creer({
          variables: {
            slug: v.slug,
            nom: v.nom,
            groupe: v.groupe,
            couleur,
            description: v.description ?? '',
            ordre: v.ordre,
          },
        })
        message.success(t`Périmètre créé.`)
      } else if (perimetre) {
        const envoyer = (versionAttendue: number) =>
          modifier({
            variables: {
              id: perimetre.id,
              nom: v.nom,
              groupe: v.groupe,
              couleur,
              description: v.description ?? '',
              ordre: v.ordre,
              archive: v.archive,
              versionAttendue,
            },
          })
        try {
          await envoyer(perimetre.version)
        } catch (e) {
          // Une autre personne a réglé ce périmètre depuis l'ouverture de la
          // fenêtre : « Écraser » rejoue avec la version annoncée, « Recharger »
          // relit les listes et ne ferme la fenêtre qu'après une relecture réussie.
          const conflit = lireConflit(e)
          if (
            conflit?.nature !== 'contenu' ||
            typeof conflit.versionCourante !== 'number'
          ) {
            throw e
          }
          const { titre, texte } = texteConflit(conflit, { objet: 'perimetre' })
          const ecraser = await modal.confirm({
            title: titre,
            content: texte,
            okText: t`Écraser`,
            cancelText: t`Recharger`,
          })
          if (!ecraser) {
            if (await relireLesVues(client, LISTES)) onFermer()
            else {
              message.error(
                t`Le périmètre n’a pas pu être rechargé. Votre saisie reste à l’écran : réessayez dans un instant.`
              )
            }
            return
          }
          await envoyer(conflit.versionCourante)
        }
        message.success(t`Périmètre enregistré.`)
      }
      onFermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={perimetre !== null}
      title={
        perimetre === 'nouveau' ? t`Nouveau périmètre` : t`Régler le périmètre`
      }
      okText={t`Enregistrer`}
      cancelText={t`Annuler`}
      confirmLoading={creation.loading || modification.loading}
      onOk={() => form.submit()}
      onCancel={onFermer}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={v => void enregistrer(v)}
        requiredMark={false}
      >
        <Form.Item
          label={t`Nom`}
          name="nom"
          rules={[{ required: true, message: t`Saisissez un nom.` }]}
        >
          <Input placeholder={t`Natation`} />
        </Form.Item>
        <Form.Item
          label={t`Identifiant`}
          name="slug"
          extra={t`Minuscules, chiffres et tirets. Il ne change plus après la création.`}
          rules={[
            { required: true, message: t`Saisissez un identifiant.` },
            {
              pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
              message: t`Minuscules, chiffres et tirets seulement.`,
            },
          ]}
        >
          <Input placeholder={t`natation`} disabled={perimetre !== 'nouveau'} />
        </Form.Item>
        <Form.Item
          label={t`Groupe`}
          name="groupe"
          rules={[{ required: true, message: t`Choisissez un groupe.` }]}
        >
          <Segmented
            options={activite.groupes.map(g => ({
              value: g.cle,
              label: g.libelle,
            }))}
          />
        </Form.Item>
        <Form.Item
          label={t`Description`}
          name="description"
          extra={t`Une ou deux phrases qui présentent le périmètre aux membres de l’équipe.`}
        >
          <Input.TextArea
            rows={3}
            maxLength={400}
            showCount
            placeholder={t`Le pôle obtient les gymnases, la piscine et les autorisations.`}
          />
        </Form.Item>
        <Form.Item label={t`Couleur`} name="couleur">
          <ColorPicker format="hex" allowClear />
        </Form.Item>
        <Form.Item
          label={t`Ordre d’affichage`}
          name="ordre"
          extra={t`Dans chaque groupe, les périmètres se rangent par ordre croissant, puis par nom.`}
        >
          <InputNumber min={0} max={999} />
        </Form.Item>
        {perimetre !== 'nouveau' && (
          <Form.Item
            label={t`Archivé`}
            name="archive"
            valuePropName="checked"
            extra={t`Un périmètre archivé disparaît des listes, mais son historique reste consultable.`}
          >
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
