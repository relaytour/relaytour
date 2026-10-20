import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Input, InputNumber, Modal, Switch } from 'antd'
import { useState } from 'react'

import { graphql } from '../gql'
import { messageErreur } from '../lib/erreurs'

const LIEUX_TOUS = graphql(`
  query LieuxTous($activiteId: ID!) {
    lieux(activiteId: $activiteId, inclureArchives: true) {
      id
      nom
      description
      ordre
      archive
    }
  }
`)

const CREER = graphql(`
  mutation CreerLieu($activiteId: ID!, $nom: String!, $ordre: Int) {
    creerLieu(activiteId: $activiteId, nom: $nom, ordre: $ordre) {
      id
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierLieu(
    $id: ID!
    $nom: String!
    $description: String
    $ordre: Int!
    $archive: Boolean!
  ) {
    modifierLieu(
      id: $id
      nom: $nom
      description: $description
      ordre: $ordre
      archive: $archive
    ) {
      id
      nom
      ordre
      archive
    }
  }
`)

const RELIRE = ['LieuxTous', 'Lieux', 'Programme']

/**
 * Fenêtre des lieux d'une activité (ADR 0038), pour ses admins : ajouter,
 * renommer, ordonner, archiver. Un lieu archivé garde ses séquences passées et ne
 * se propose plus.
 */
export default function LieuxFenetre({
  activiteId,
  ouvert,
  onFermer,
}: {
  activiteId: string
  ouvert: boolean
  onFermer: () => void
}) {
  const { message } = App.useApp()
  const { data } = useQuery(LIEUX_TOUS, {
    variables: { activiteId },
    skip: !ouvert,
  })
  const [creer, creation] = useMutation(CREER, { refetchQueries: RELIRE })
  const [modifier] = useMutation(MODIFIER, { refetchQueries: RELIRE })
  const [nouveau, setNouveau] = useState('')
  const lieux = data?.lieux ?? []

  const enregistrer = (
    lieu: (typeof lieux)[number],
    changement: Partial<{ nom: string; ordre: number; archive: boolean }>
  ) => {
    void modifier({
      variables: {
        id: lieu.id,
        nom: changement.nom ?? lieu.nom,
        description: lieu.description ?? '',
        ordre: changement.ordre ?? lieu.ordre,
        archive: changement.archive ?? lieu.archive,
      },
    }).catch((e: unknown) => message.error(messageErreur(e)))
  }

  return (
    <Modal
      open={ouvert}
      title="Lieux de l’activité"
      footer={<Button onClick={onFermer}>Fermer</Button>}
      onCancel={onFermer}
      destroyOnHidden
      rootClassName="rt-modale-pleine"
    >
      <p className="rt-texte-secondaire">
        Les lieux servent d’une période à l’autre. Le programme les affiche par
        ordre croissant. Un lieu archivé ne se propose plus.
      </p>
      <ul className="rt-lieux">
        {lieux.map(lieu => (
          <li key={lieu.id}>
            <Input
              defaultValue={lieu.nom}
              aria-label="Nom du lieu"
              onBlur={e => {
                const nom = e.target.value.trim()
                if (nom && nom !== lieu.nom) enregistrer(lieu, { nom })
              }}
            />
            <InputNumber
              defaultValue={lieu.ordre}
              aria-label="Ordre du lieu"
              style={{ width: 80 }}
              onBlur={e => {
                const ordre = Number(e.target.value)
                if (Number.isInteger(ordre) && ordre !== lieu.ordre) {
                  enregistrer(lieu, { ordre })
                }
              }}
            />
            <span className="rt-lieux-archive">
              <Switch
                size="small"
                checked={lieu.archive}
                onChange={archive => enregistrer(lieu, { archive })}
                aria-label="Archiver le lieu"
              />
              <span className="rt-note">Archivé</span>
            </span>
          </li>
        ))}
      </ul>
      <form
        className="rt-lieux-ajout"
        onSubmit={e => {
          e.preventDefault()
          if (!nouveau.trim()) return
          void creer({
            variables: { activiteId, nom: nouveau, ordre: lieux.length },
          }).then(
            () => setNouveau(''),
            (erreur: unknown) => message.error(messageErreur(erreur))
          )
        }}
      >
        <Input
          value={nouveau}
          onChange={e => setNouveau(e.target.value)}
          placeholder="Terrain 2, bassin, salle des fêtes…"
          aria-label="Nouveau lieu"
        />
        <Button
          htmlType="submit"
          icon={<PlusOutlined />}
          loading={creation.loading}
        >
          Ajouter
        </Button>
      </form>
    </Modal>
  )
}
