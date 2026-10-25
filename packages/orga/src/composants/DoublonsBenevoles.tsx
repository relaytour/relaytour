import { useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural, t } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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

const NIVEAUX: Record<
  Doublon['niveau'],
  { libelle: MessageDescriptor; couleur: string }
> = {
  FORT: {
    libelle: msg({
      message: 'Même adresse',
      comment:
        'Raison pour laquelle deux fiches bénévoles semblent identiques : même adresse de courriel',
    }),
    couleur: 'error',
  },
  MOYEN: { libelle: msg`Même téléphone`, couleur: 'warning' },
  FAIBLE: { libelle: msg`Nom proche`, couleur: 'default' },
}

const RELIRE = [
  'DoublonsBenevoles',
  'Benevoles',
  'Candidatures',
  'BenevolesARepartir',
  'Programme',
]

function resume(f: Fiche) {
  const places = f.places
  const sourceImport = f.sourceImport
  return [
    f.courriel,
    f.telephone,
    t`${plural(places, { one: '# séquence', other: '# séquences' })}`,
    sourceImport ? t`import « ${sourceImport} »` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function DoublonsBenevoles() {
  const { t } = useLingui()
  const { activite } = useActivite()
  const { message, modal } = App.useApp()
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
      message.success(t`Les deux fiches n’en font plus qu’une.`)
      setPaire(null)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const ecarter = (d: Doublon) => {
    const nomPremiereFiche = d.a.nom
    const nomSecondeFiche = d.b.nom
    void modal.confirm({
      title: t`« ${nomPremiereFiche} » et « ${nomSecondeFiche} » sont deux personnes ?`,
      content: t`Cette paire ne sera plus proposée. L’écran ne permet pas de revenir sur ce choix.`,
      okText: t`Ce ne sont pas des doublons`,
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await distincts({ variables: { aId: d.a.id, bId: d.b.id } })
          message.success(t`Cette paire ne sera plus proposée.`)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title={t`Les doublons possibles n’ont pas pu être chargés.`}
      />
    )
  }
  if (loading && !data) return <Skeleton active />
  const doublons = data?.doublonsBenevoles ?? []
  const nomFicheGardee = paire?.a.nom
  const nomFicheAbsorbee = paire?.b.nom

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
        <Empty description={t`Aucun doublon possible parmi les fiches.`} />
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
                <Tag color={niveau.couleur}>{t(niveau.libelle)}</Tag>
                <div className="rt-doublon-actions">
                  <Button type="primary" onClick={() => ouvrir(d)}>
                    <Trans>Fusionner</Trans>
                  </Button>
                  <Button onClick={() => ecarter(d)}>
                    <Trans>Ce ne sont pas des doublons</Trans>
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="rt-note">
        <Trans>
          Les doublons possibles se calculent sur l’adresse, le téléphone et le
          nom. La fusion garde la première fiche de la paire et y réunit les
          places, les disponibilités et les candidatures de la seconde.
        </Trans>
      </p>
      <Modal
        open={paire !== null}
        title={t`Fusionner deux fiches`}
        okText={t`Fusionner`}
        cancelText={t`Annuler`}
        confirmLoading={fusion.loading}
        onOk={() => void confirmerFusion()}
        onCancel={() => setPaire(null)}
        destroyOnHidden
      >
        <p>
          <Trans>
            La fiche de « {nomFicheGardee} » reçoit les places, les
            disponibilités et les candidatures de « {nomFicheAbsorbee} », qui
            disparaît. Choisissez les valeurs gardées.
          </Trans>
        </p>
        {ligneChoix(
          'nom',
          t({
            message: 'Nom',
            comment: 'Champ d’une fiche bénévole à fusionner',
          })
        )}
        {ligneChoix(
          'courriel',
          t({
            message: 'Adresse',
            comment: 'Adresse de courriel d’une fiche bénévole à fusionner',
          })
        )}
        {ligneChoix(
          'telephone',
          t({
            message: 'Téléphone',
            comment: 'Champ d’une fiche bénévole à fusionner',
          })
        )}
        <p className="rt-note">
          <Trans>
            Le lien personnel et la confirmation suivent l’adresse gardée. Les
            notes se mettent bout à bout.
          </Trans>
        </p>
      </Modal>
    </div>
  )
}
