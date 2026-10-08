import { useQuery } from '@apollo/client/react'
import { Alert, Modal, Skeleton } from 'antd'

import { messageErreur } from '../lib/erreurs'
import {
  dateDeVersion,
  NOTES_DE_VERSION,
  ROLES_NOTE,
  TYPES_NOTE,
} from '../lib/notes-de-version'

import { PastilleEtat } from './Etat'

/**
 * La fenêtre des notes de version (ADR 0021) : les versions publiées, de la plus
 * récente à la plus ancienne, avec les notes du rôle de la personne. La requête
 * part à la première ouverture.
 */
export default function NotesDeVersion({
  ouvert,
  version,
  onFermer,
}: {
  ouvert: boolean
  version: string | undefined
  onFermer: () => void
}) {
  const { data, loading, error } = useQuery(NOTES_DE_VERSION, { skip: !ouvert })
  const versions = data?.notesDeVersion ?? []
  return (
    <Modal
      open={ouvert}
      title="Notes de version"
      footer={null}
      width={680}
      rootClassName="rt-modale-pleine"
      onCancel={onFermer}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <p className="rt-texte-secondaire">
        {version === undefined
          ? 'Cette fenêtre liste les changements de chaque version de Relaytour.'
          : `Votre installation utilise Relaytour ${version}. Cette fenêtre liste les changements de chaque version.`}{' '}
        Vous y lisez les notes qui concernent votre rôle.
      </p>
      {error && <Alert type="error" showIcon title={messageErreur(error)} />}
      {loading && !data && <Skeleton active paragraph={{ rows: 6 }} />}
      {data && versions.length === 0 && (
        <p className="rt-texte-secondaire">
          Aucune note de version ne concerne votre rôle pour le moment.
        </p>
      )}
      {versions.map(v => (
        <section key={v.numero} className="rt-version">
          <h3 className="rt-version-titre">
            Version {v.numero}
            <span className="rt-mono rt-version-date">
              {dateDeVersion(v.date)}
            </span>
          </h3>
          <ul className="rt-version-notes">
            {v.notes.map(note => {
              const type = TYPES_NOTE[note.type]
              const role = ROLES_NOTE[note.role]
              return (
                <li key={note.id}>
                  <div className="rt-version-etiquettes">
                    <PastilleEtat variante={type.variante} sansPoint>
                      {type.libelle}
                    </PastilleEtat>
                    {role !== null && (
                      <PastilleEtat sansPoint>{role}</PastilleEtat>
                    )}
                  </div>
                  <strong>{note.titre}</strong>
                  <p>{note.texte}</p>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </Modal>
  )
}
