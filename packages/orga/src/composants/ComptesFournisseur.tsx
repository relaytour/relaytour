import { EditOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Empty, Input, Modal, Skeleton, Tag } from 'antd'
import { useMemo, useState } from 'react'

import type { ComptesFournisseurQuery } from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'
import {
  COMPTES_FOURNISSEUR,
  SAISIR_ADRESSE_FOURNISSEUR,
} from '../lib/espace-fichiers'
import { Panneau } from './Panneau'

type Compte = ComptesFournisseurQuery['comptesFournisseur'][number]

const ETATS: Record<string, { libelle: string; couleur: string }> = {
  TROUVE: { libelle: 'Compte trouvé', couleur: 'success' },
  INVITE: { libelle: 'Invité', couleur: 'processing' },
  ABSENT: { libelle: 'Absent de l’annuaire', couleur: 'error' },
}

/** La fenêtre où un admin donne l'adresse du compte d'un membre chez le fournisseur. */
function SaisirAdresse({
  compte,
  onFermer,
}: {
  compte: Compte
  onFermer: () => void
}) {
  const { message } = App.useApp()
  const [adresse, setAdresse] = useState(compte.adresseSaisie ?? '')
  const [saisir, { loading }] = useMutation(SAISIR_ADRESSE_FOURNISSEUR, {
    refetchQueries: ['ComptesFournisseur'],
  })
  const enregistrer = (valeur: string | null) =>
    saisir({ variables: { userId: compte.personne.id, adresse: valeur } })
      .then(() => {
        message.success(
          'L’adresse est enregistrée. Relaytour cherche le compte de nouveau.'
        )
        onFermer()
      })
      .catch((e: unknown) => message.error(messageErreur(e)))
  return (
    <Modal
      open
      title={`Compte de ${compte.personne.nom}`}
      onCancel={onFermer}
      okText="Enregistrer"
      okButtonProps={{ loading, disabled: adresse.trim() === '' }}
      onOk={() => void enregistrer(adresse)}
      footer={(_, { OkBtn, CancelBtn }) => (
        <>
          {compte.adresseSaisie !== null && (
            <Button onClick={() => void enregistrer(null)}>
              Reprendre son adresse Relaytour
            </Button>
          )}
          <CancelBtn />
          <OkBtn />
        </>
      )}
    >
      <p>
        Relaytour cherche le compte par l’adresse {compte.personne.email}. Si la
        personne utilise une autre adresse chez le fournisseur, saisissez-la
        ici.
      </p>
      <Input
        type="email"
        value={adresse}
        onChange={e => setAdresse(e.target.value)}
        placeholder="adresse@exemple.org"
        aria-label="Adresse chez le fournisseur"
      />
    </Modal>
  )
}

/**
 * L'onglet « Comptes » (ADR 0044) : chaque membre de l'organisation et son compte
 * chez le fournisseur, trouvé, invité ou absent. Un admin y saisit l'adresse d'un
 * compte qui diffère de l'adresse Relaytour.
 */
export default function ComptesFournisseur() {
  const { data, loading } = useQuery(COMPTES_FOURNISSEUR)
  const [recherche, setRecherche] = useState('')
  const [modifie, setModifie] = useState<Compte | null>(null)
  const comptes = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return (data?.comptesFournisseur ?? []).filter(
      c =>
        terme === '' ||
        c.personne.nom.toLowerCase().includes(terme) ||
        c.personne.email.toLowerCase().includes(terme)
    )
  }, [data, recherche])

  return (
    <Panneau titre="Comptes chez le fournisseur" icone={<TeamOutlined />}>
      <p className="rt-texte-secondaire">
        Relaytour cherche chaque personne attendue par un dossier lié dans
        l’annuaire du fournisseur, par son adresse. Il ne lit jamais tout
        l’annuaire. Une personne qu’aucun dossier n’attend n’est pas cherchée.
      </p>
      <Input.Search
        allowClear
        placeholder="Chercher une personne"
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        style={{ marginBottom: 12, maxWidth: 360 }}
      />
      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : comptes.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Personne." />
      ) : (
        <ul className="rt-explorateur">
          {comptes.map(c => {
            const etat = c.etat === null ? null : ETATS[c.etat]
            return (
              <li
                key={c.personne.id}
                className="rt-explorateur-ligne rt-acces-ligne"
              >
                <span className="rt-explorateur-nom">
                  {c.personne.nom}
                  <span className="rt-explorateur-detail">
                    {c.adresseSaisie === null
                      ? c.personne.email
                      : `${c.adresseSaisie} (saisie par un admin)`}
                  </span>
                </span>
                {etat === null || etat === undefined ? (
                  <Tag>Non cherché</Tag>
                ) : (
                  <Tag color={etat.couleur}>{etat.libelle}</Tag>
                )}
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={`Adresse du compte de ${c.personne.nom}`}
                  onClick={() => setModifie(c)}
                />
              </li>
            )
          })}
        </ul>
      )}
      {modifie !== null && (
        <SaisirAdresse
          key={modifie.personne.id}
          compte={modifie}
          onFermer={() => setModifie(null)}
        />
      )}
    </Panneau>
  )
}
