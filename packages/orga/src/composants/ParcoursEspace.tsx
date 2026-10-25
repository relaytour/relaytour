import { FolderOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { useLingui } from '@lingui/react/macro'
import { Alert, Breadcrumb, Empty, Form, Select, Skeleton } from 'antd'
import type { ReactNode } from 'react'

import { messageErreur } from '../lib/erreurs'
import { EMPLACEMENTS, PARCOURIR } from '../lib/espace-fichiers'

export interface PositionChoisie {
  emplacement: string | null
  chemin: string[]
}

/**
 * Parcours des bibliothèques de l'espace connecté, dossier par dossier, pour en
 * choisir un (ADR 0038). Réservé aux admins de l'organisation : il montre tout ce
 * que voit le compte connecté. `aide` décrit le dossier choisi sous la liste.
 */
export default function ParcoursEspace({
  actif,
  valeur,
  onChange,
  aide,
}: {
  actif: boolean
  valeur: PositionChoisie
  onChange: (valeur: PositionChoisie) => void
  aide: (chemin: string[]) => ReactNode
}) {
  const { t } = useLingui()
  const { emplacement, chemin } = valeur
  const emplacements = useQuery(EMPLACEMENTS, { skip: !actif })
  const dossiers = useQuery(PARCOURIR, {
    variables: { emplacement: emplacement ?? '', chemin },
    skip: !actif || emplacement === null,
  })
  const nomEmplacement =
    emplacements.data?.emplacementsFichiers.find(e => e.id === emplacement)
      ?.nom ?? ''
  const elements = dossiers.data?.parcourirEspaceFichiers.elements ?? []

  return (
    <>
      <Form.Item label={t`Bibliothèque de documents`}>
        <Select
          value={emplacement}
          onChange={id => onChange({ emplacement: id, chemin: [] })}
          loading={emplacements.loading}
          placeholder={t`Choisissez une bibliothèque`}
          showSearch
          optionFilterProp="label"
          options={(emplacements.data?.emplacementsFichiers ?? []).map(e => ({
            value: e.id,
            label: e.site === null ? e.nom : `${e.site} · ${e.nom}`,
          }))}
        />
      </Form.Item>
      {emplacements.error && (
        <Alert
          type="error"
          showIcon
          message={messageErreur(emplacements.error)}
        />
      )}
      {emplacement !== null && (
        <div className="rt-verre rt-panneau">
          <Breadcrumb
            items={[nomEmplacement, ...chemin].map((nom, i) => ({
              key: `${i}-${nom}`,
              title:
                i === chemin.length ? (
                  <strong>{nom}</strong>
                ) : (
                  <a
                    href="#"
                    onClick={evenement => {
                      evenement.preventDefault()
                      onChange({ emplacement, chemin: chemin.slice(0, i) })
                    }}
                  >
                    {nom}
                  </a>
                ),
            }))}
          />
          {dossiers.error ? (
            <Alert
              type="error"
              showIcon
              message={messageErreur(dossiers.error)}
            />
          ) : dossiers.loading && !dossiers.data ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : elements.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t`Aucun sous-dossier.`}
            />
          ) : (
            <ul className="rt-explorateur">
              {elements.map(d => (
                <li key={d.elementId}>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ emplacement, chemin: [...chemin, d.nom] })
                    }
                  >
                    <FolderOutlined
                      aria-hidden
                      className="rt-explorateur-icone"
                    />
                    <span className="rt-explorateur-nom">{d.nom}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {dossiers.data?.parcourirEspaceFichiers.complet === false && (
            <Alert
              type="info"
              showIcon
              message={t`Ce dossier compte trop de sous-dossiers pour les afficher tous. Rangez le dossier voulu plus haut dans la bibliothèque.`}
            />
          )}
          <p className="rt-texte-secondaire" style={{ marginBottom: 0 }}>
            {aide(chemin)}
          </p>
        </div>
      )}
    </>
  )
}
