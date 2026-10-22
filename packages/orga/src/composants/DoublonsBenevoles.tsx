import { useMutation, useQuery } from '@apollo/client/react'
import { Alert, App, Button, Empty, Modal, Radio, Skeleton, Tag } from 'antd'
import { useState } from 'react'

import type { DoublonsBenevolesQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { DISTINCTS, DOUBLONS, FUSIONNER } from '../lib/requetes-import'

// Doublons possibles parmi les fiches bénévoles d'une activité (ADR 0042),
// réservés aux admins de l'activité. « Fusionner » ouvre une comparaison champ
// par champ ; « Ce ne sont pas des doublons » écarte la paire pour de bon.

type Doublon = DoublonsBenevolesQuery['doublonsBenevoles'][number]
type Fiche = Doublon['a']
type Cote = 'GARDEE' | 'AUTRE'

const NIVEAUX = {
  FORT: { libelle: 'Même adresse', couleur: 'error' },
  MOYEN: { libelle: 'Même téléphone', couleur: 'warning' },
  FAIBLE: { libelle: 'Nom proche', couleur: 'default' },
} as const

const RELIRE = [
  'DoublonsBenevoles',
  'Benevoles',
  'Candidatures',
  'BenevolesARepartir',
  'Programme',
]

function resume(f: Fiche) {
  return [
    f.courriel,
    f.telephone,
    `${f.places} séquence${f.places > 1 ? 's' : ''}`,
    f.sourceImport ? `import « ${f.sourceImport} »` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function DoublonsBenevoles() {
  const { activite } = useActivite()
  const { message } = App.useApp()
  const { data, loading, error } = useQuery(DOUBLONS, {
    variables: { activiteId: activite.id },
    fetchPolicy: 'cache-and-network',
  })
  const [fusionner, fusion] = useMutation(FUSIONNER, { refetchQueries: RELIRE })
  const [distincts] = useMutation(DISTINCTS, { refetchQueries: RELIRE })
  const [paire, setPaire] = useState<Doublon | null>(null)
  const [choix, setChoix] = useState<{
    nom: Cote
    courriel: Cote
    telephone: Cote
  }>({ nom: 'GARDEE', courriel: 'GARDEE', telephone: 'GARDEE' })

  const ouvrir = (d: Doublon) => {
    // Par défaut, chaque valeur vient de la fiche qui la porte.
    setChoix({
      nom: 'GARDEE',
      courriel: d.a.courriel || !d.b.courriel ? 'GARDEE' : 'AUTRE',
      telephone: d.a.telephone || !d.b.telephone ? 'GARDEE' : 'AUTRE',
    })
    setPaire(d)
  }

  const confirmerFusion = async () => {
    if (!paire) return
    try {
      await fusionner({
        variables: {
          gardeeId: paire.a.id,
          autreId: paire.b.id,
          nomDe: choix.nom,
          courrielDe: choix.courriel,
          telephoneDe: choix.telephone,
        },
      })
      message.success('Les deux fiches n’en font plus qu’une.')
      setPaire(null)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const ecarter = async (d: Doublon) => {
    try {
      await distincts({ variables: { aId: d.a.id, bId: d.b.id } })
      message.success('Cette paire ne sera plus proposée.')
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title="Les doublons possibles n’ont pas pu être chargés."
      />
    )
  }
  if (loading && !data) return <Skeleton active />
  const doublons = data?.doublonsBenevoles ?? []

  const ligneChoix = (
    champ: 'nom' | 'courriel' | 'telephone',
    libelle: string
  ) => {
    if (!paire) return null
    const valeurA = paire.a[champ] ?? '—'
    const valeurB = paire.b[champ] ?? '—'
    return (
      <fieldset className="rt-fusion-champ">
        <legend>{libelle}</legend>
        <Radio.Group
          value={choix[champ]}
          onChange={e =>
            setChoix({ ...choix, [champ]: e.target.value as Cote })
          }
        >
          <Radio value="GARDEE">{valeurA}</Radio>
          <Radio value="AUTRE">{valeurB}</Radio>
        </Radio.Group>
      </fieldset>
    )
  }

  return (
    <div className="rt-doublons">
      {doublons.length === 0 ? (
        <Empty description="Aucun doublon possible parmi les fiches." />
      ) : (
        <ul className="rt-doublons-liste">
          {doublons.map(d => {
            const niveau = NIVEAUX[d.niveau]
            return (
              <li key={`${d.a.id}:${d.b.id}`} className="rt-verre rt-doublon">
                <div className="rt-doublon-fiches">
                  {[d.a, d.b].map(f => (
                    <div key={f.id}>
                      <strong>{f.nom}</strong>
                      <span className="rt-note">{resume(f)}</span>
                    </div>
                  ))}
                </div>
                <Tag color={niveau.couleur}>{niveau.libelle}</Tag>
                <div className="rt-doublon-actions">
                  <Button type="primary" onClick={() => ouvrir(d)}>
                    Fusionner
                  </Button>
                  <Button onClick={() => void ecarter(d)}>
                    Ce ne sont pas des doublons
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="rt-note">
        Les doublons possibles se calculent sur l’adresse, le téléphone et le
        nom. La fusion garde la première fiche de la paire et y réunit les
        places, les disponibilités et les candidatures de la seconde.
      </p>
      <Modal
        open={paire !== null}
        title="Fusionner deux fiches"
        okText="Fusionner"
        cancelText="Annuler"
        confirmLoading={fusion.loading}
        onOk={() => void confirmerFusion()}
        onCancel={() => setPaire(null)}
        destroyOnHidden
      >
        <p>
          La fiche de « {paire?.a.nom} » reçoit les places, les disponibilités
          et les candidatures de « {paire?.b.nom} », qui disparaît. Choisissez
          les valeurs gardées.
        </p>
        {ligneChoix('nom', 'Nom')}
        {ligneChoix('courriel', 'Adresse')}
        {ligneChoix('telephone', 'Téléphone')}
        <p className="rt-note">
          Le lien personnel et la confirmation suivent l’adresse gardée. Les
          notes se mettent bout à bout.
        </p>
      </Modal>
    </div>
  )
}
