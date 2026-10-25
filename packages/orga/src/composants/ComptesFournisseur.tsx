import { EditOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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

const ETATS: Record<string, { libelle: MessageDescriptor; couleur: string }> = {
  TROUVE: { libelle: msg`Compte trouvé`, couleur: 'success' },
  INVITE: { libelle: msg`Invité`, couleur: 'processing' },
  ABSENT: { libelle: msg`Absent de l’annuaire`, couleur: 'error' },
}

/** La fenêtre où un admin donne l'adresse du compte d'un membre chez le fournisseur. */
function SaisirAdresse({
  compte,
  onFermer,
}: {
  compte: Compte
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const [adresse, setAdresse] = useState(compte.adresseSaisie ?? '')
  const [saisir, { loading }] = useMutation(SAISIR_ADRESSE_FOURNISSEUR, {
    refetchQueries: ['ComptesFournisseur'],
  })
  const enregistrer = (valeur: string | null) =>
    saisir({ variables: { userId: compte.personne.id, adresse: valeur } })
      .then(() => {
        message.success(
          t`L’adresse est enregistrée. Relaytour cherche le compte de nouveau.`
        )
        onFermer()
      })
      .catch((e: unknown) => message.error(messageErreur(e)))
  const nomPersonne = compte.personne.nom
  const adresseRelaytour = compte.personne.email
  return (
    <Modal
      open
      title={t`Compte de ${nomPersonne}`}
      onCancel={onFermer}
      okText={t`Enregistrer`}
      okButtonProps={{ loading, disabled: adresse.trim() === '' }}
      onOk={() => void enregistrer(adresse)}
      footer={(_, { OkBtn, CancelBtn }) => (
        <>
          {compte.adresseSaisie !== null && (
            <Button onClick={() => void enregistrer(null)}>
              {t`Reprendre son adresse Relaytour`}
            </Button>
          )}
          <CancelBtn />
          <OkBtn />
        </>
      )}
    >
      <p>
        <Trans>
          Relaytour cherche le compte par l’adresse {adresseRelaytour}. Si la
          personne utilise une autre adresse chez le fournisseur, saisissez-la
          ici.
        </Trans>
      </p>
      <Input
        type="email"
        value={adresse}
        onChange={e => setAdresse(e.target.value)}
        placeholder={t`adresse@exemple.org`}
        aria-label={t`Adresse chez le fournisseur`}
      />
    </Modal>
  )
}

/**
 * L'onglet « Comptes » (ADR 0044) : chaque membre de l'organisation et son compte
 * chez le fournisseur, trouvé, invité ou absent. Un admin y saisit l'adresse d'un
 * compte qui diffère de l'adresse Relaytour.
 */
export default function ComptesFournisseur({
  annuaire,
}: {
  /** Faux pour un fournisseur sans annuaire : seules les adresses comptent. */
  annuaire: boolean
}) {
  const { t } = useLingui()
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
    <Panneau titre={t`Comptes chez le fournisseur`} icone={<TeamOutlined />}>
      <p className="rt-texte-secondaire">
        {annuaire
          ? t`Relaytour cherche chaque personne attendue par un dossier lié dans l’annuaire du fournisseur, par son adresse. Il ne lit jamais tout l’annuaire. Une personne qu’aucun dossier n’attend n’est pas cherchée.`
          : t`Ce fournisseur ne publie pas d’annuaire : Relaytour compare l’adresse de chaque personne à celles des droits. Saisissez l’adresse qu’une personne utilise chez le fournisseur quand elle diffère.`}
      </p>
      <Input.Search
        allowClear
        placeholder={t`Chercher une personne`}
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        style={{ marginBottom: 12, maxWidth: 360 }}
      />
      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : comptes.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t`Personne.`}
        />
      ) : (
        <ul className="rt-explorateur">
          {comptes.map(c => {
            const etat = c.etat === null ? null : ETATS[c.etat]
            const adresseSaisie = c.adresseSaisie
            const nomMembre = c.personne.nom
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
                      : t`${adresseSaisie} (saisie par un admin)`}
                  </span>
                </span>
                {!annuaire ? null : etat === null || etat === undefined ? (
                  <Tag>{t`Non cherché`}</Tag>
                ) : (
                  <Tag color={etat.couleur}>{t(etat.libelle)}</Tag>
                )}
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={t`Adresse du compte de ${nomMembre}`}
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
