import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Drawer, Tag } from 'antd'

import { graphql } from '../gql'
import type { ProgrammeQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { libelleJours } from '../lib/agenda'
import { messageErreur } from '../lib/erreurs'
import { BENEVOLES } from '../lib/requetes'

import { EtatPlace, Jauge } from './Jauge'
import PastillePerimetre from './PastillePerimetre'
import type { SequenceSaisie } from './SequenceFormulaire'

const SUPPRIMER = graphql(`
  mutation SupprimerSequence($id: ID!) {
    supprimerSequence(id: $id)
  }
`)

export type SequenceLue = ProgrammeQuery['programme'][number]

/** Les champs d'une séquence lue, pour la fenêtre de modification. */
function saisieDe(s: SequenceLue): SequenceSaisie {
  return {
    id: s.id,
    perimetreId: s.perimetre?.id ?? null,
    lieuId: s.lieu?.id ?? null,
    titre: s.titre,
    jour: s.jour,
    jourFin: s.jourFin,
    heureDebut: s.heureDebut,
    heureFin: s.heureFin,
    description: s.description,
    besoinBenevoles: s.besoinBenevoles,
    consignesBenevoles: s.consignesBenevoles,
    places: s.places.map(p => ({
      personne: p.benevoleId ? `b:${p.benevoleId}` : `p:${p.personneId}`,
      role: p.role,
    })),
    version: s.version,
  }
}

/**
 * Volet d'une séquence du programme (ADR 0040). Les coordonnées d'une ou d'un
 * bénévole s'affichent quand le serveur les ouvre à la personne connectée.
 */
export default function SequenceDetail({
  sequence,
  lisible,
  onModifier,
  onFermer,
}: {
  sequence: SequenceLue | null
  /**
   * Vrai si la personne lit la liste des fiches : un admin de l'activité, ou une
   * personne qui écrit dans l'activité.
   */
  lisible: boolean
  onModifier: (s: SequenceSaisie) => void
  onFermer: () => void
}) {
  const { activite } = useActivite()
  const { message, modal } = App.useApp()
  const { t } = useLingui()
  const { data: benevoles } = useQuery(BENEVOLES, {
    variables: { activiteId: activite.id },
    skip: sequence === null || !lisible,
  })
  const [supprimer] = useMutation(SUPPRIMER, {
    refetchQueries: [
      'Programme',
      'ProgrammePerimetre',
      'BenevolesARepartir',
      'CouvertureProgramme',
    ],
  })
  const fiches = new Map(
    (benevoles?.benevoles ?? []).map(b => [b.id, b] as const)
  )

  const confirmerSuppression = () => {
    if (!sequence) return
    const titreSequence = sequence.titre
    void modal.confirm({
      title: t`Supprimer cette séquence ?`,
      content: t`« ${titreSequence} » quitte le programme, avec ses personnes placées.`,
      okText: t`Supprimer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await supprimer({ variables: { id: sequence.id } })
          message.success(t`Séquence supprimée.`)
          onFermer()
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  let quand = ''
  if (sequence) {
    const jour = libelleJours(sequence.jour)
    const debut = sequence.heureDebut
    const fin = sequence.heureFin
    if (sequence.jourFin !== sequence.jour) {
      const jourFin = libelleJours(sequence.jourFin)
      quand = t`${jour}, ${debut} → ${jourFin} ${fin}`
    } else {
      quand = t`${jour}, ${debut} → ${fin}`
    }
  }

  return (
    <Drawer
      open={sequence !== null}
      onClose={onFermer}
      title={sequence?.titre ?? t`Séquence`}
      size={460}
      extra={
        sequence?.peutModifier && (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <Button
              icon={<EditOutlined />}
              onClick={() => onModifier(saisieDe(sequence))}
            >
              <Trans>Modifier</Trans>
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              aria-label={t`Supprimer la séquence`}
              onClick={confirmerSuppression}
            />
          </span>
        )
      }
    >
      {sequence && (
        <div className="rt-reunion">
          <p className="rt-reunion-quand">{quand}</p>
          <p style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sequence.lieu && <Tag>{sequence.lieu.nom}</Tag>}
            {sequence.perimetre ? (
              <PastillePerimetre
                nom={sequence.perimetre.nom}
                couleur={sequence.perimetre.couleur}
              />
            ) : (
              <span className="rt-note">
                <Trans>Toute l’activité</Trans>
              </span>
            )}
          </p>
          {sequence.description && (
            <p className="rt-reunion-description">{sequence.description}</p>
          )}
          {(sequence.besoinBenevoles !== null ||
            sequence.consignesBenevoles) && (
            <section>
              <h3 className="rt-reunion-intertitre">
                <Trans>Bénévoles</Trans>
              </h3>
              {sequence.besoinBenevoles !== null && (
                <p>
                  <Jauge
                    renforts={sequence.renforts}
                    besoin={sequence.besoinBenevoles}
                  />
                </p>
              )}
              {sequence.consignesBenevoles && (
                <p className="rt-reunion-description">
                  {sequence.consignesBenevoles}
                </p>
              )}
            </section>
          )}
          <section>
            <h3 className="rt-reunion-intertitre">
              <Trans>Personnes placées</Trans>
            </h3>
            {sequence.places.length === 0 ? (
              <p className="rt-texte-secondaire">
                <Trans>Personne n’est encore placé dans cette séquence.</Trans>
              </p>
            ) : (
              <ul className="rt-reunion-convocations">
                {sequence.places.map(p => {
                  const fiche = p.benevoleId
                    ? fiches.get(p.benevoleId)
                    : undefined
                  return (
                    <li key={p.id}>
                      <span>
                        {p.estMoi ? t`Vous` : p.nom}
                        {p.benevoleId && (
                          <span className="rt-note"> {t`· bénévole`}</span>
                        )}
                        {fiche?.coordonneesVisibles &&
                          (fiche.telephone || fiche.courriel) && (
                            <span className="rt-note rt-sequence-contact">
                              {fiche.telephone && (
                                <a
                                  href={`tel:${fiche.telephone.replace(/\s/g, '')}`}
                                >
                                  {fiche.telephone}
                                </a>
                              )}
                              {fiche.courriel && (
                                <a href={`mailto:${fiche.courriel}`}>
                                  {fiche.courriel}
                                </a>
                              )}
                            </span>
                          )}
                      </span>
                      <span className="rt-note">
                        {p.role === 'RESPONSABLE'
                          ? t({
                              message: 'Responsable',
                              comment:
                                'Rôle d’une personne placée dans une séquence',
                            })
                          : t({
                              message: 'Renfort',
                              comment:
                                'Rôle d’une personne placée dans une séquence',
                            })}
                        {p.etat !== 'CONFIRMEE' && (
                          <>
                            {' '}
                            <EtatPlace etat={p.etat} />
                          </>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  )
}
