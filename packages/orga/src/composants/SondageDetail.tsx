import { useMutation, useQuery } from '@apollo/client/react'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Drawer, Radio, Skeleton, Tag } from 'antd'
import { useState } from 'react'

import { graphql } from '../gql'
import type { ChoixSondage, SondageQuery } from '../gql/graphql'
import { libelleJours } from '../lib/agenda'
import { messageErreur } from '../lib/erreurs'

import PastillePerimetre from './PastillePerimetre'
import ReunionFormulaire, {
  type AgendaEcrit,
  type NouvelleReunion,
} from './ReunionFormulaire'
import SondageFormulaire, { type SondageSaisi } from './SondageFormulaire'

const SONDAGE = graphql(`
  query Sondage($id: ID!) {
    sondage(id: $id) {
      id
      editionId
      titre
      description
      statut
      cible
      version
      reunionId
      peutModifier
      estParticipant
      participants
      participantIds
      repondants
      perimetre {
        id
        nom
        couleur
      }
      creneaux {
        id
        jour
        heureDebut
        heureFin
        retenu
        oui
        siBesoin
        non
        monChoix
        reponses {
          personneId
          nom
          choix
        }
      }
    }
  }
`)

const REPONDRE = graphql(`
  mutation RepondreSondage($id: ID!, $reponses: [ReponseSondageInput!]!) {
    repondreSondage(id: $id, reponses: $reponses) {
      id
    }
  }
`)

const CLORE = graphql(`
  mutation CloreSondage($id: ID!, $creneauId: ID!) {
    cloreSondage(id: $id, creneauId: $creneauId) {
      id
    }
  }
`)

const SUPPRIMER = graphql(`
  mutation SupprimerSondage($id: ID!) {
    supprimerSondage(id: $id)
  }
`)

type Creneau = NonNullable<SondageQuery['sondage']>['creneaux'][number]

const CHOIX: { valeur: ChoixSondage; libelle: MessageDescriptor }[] = [
  {
    valeur: 'OUI',
    libelle: msg({
      message: 'Oui',
      comment: 'Réponse à un créneau d’un sondage de dates',
    }),
  },
  {
    valeur: 'SI_BESOIN',
    libelle: msg({
      message: 'Si besoin',
      comment: 'Réponse à un créneau d’un sondage de dates',
    }),
  },
  {
    valeur: 'NON',
    libelle: msg({
      message: 'Non',
      comment: 'Réponse à un créneau d’un sondage de dates',
    }),
  },
]

const RELIRE = ['Sondages', 'Sondage']

const libelleCreneau = (c: {
  jour: string
  heureDebut?: string | null
  heureFin?: string | null
}) =>
  c.heureDebut
    ? `${libelleJours(c.jour)}, ${c.heureDebut} → ${c.heureFin}`
    : libelleJours(c.jour)

/** Les réponses d'un créneau, comptées par choix. */
function CompteCreneau({
  oui,
  siBesoin,
  non,
}: {
  oui: number
  siBesoin: number
  non: number
}) {
  const { t } = useLingui()
  return <>{t`${oui} oui · ${siBesoin} si besoin · ${non} non`}</>
}

/** Le nombre de personnes qui ont répondu au sondage. */
function CompteRepondants({
  repondants,
  participants,
}: {
  repondants: number
  participants: number
}) {
  const { t } = useLingui()
  return (
    <>
      {t`${plural(participants, {
        one: `${repondants} sur # personne a répondu.`,
        other: `${repondants} sur # personnes ont répondu.`,
      })}`}
    </>
  )
}

/** Volet d'un sondage de dates (ADR 0037). */
export default function SondageDetail({
  sondageId,
  agendas,
  onFermer,
}: {
  sondageId: string | null
  agendas: AgendaEcrit[]
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const { data, loading, error } = useQuery(SONDAGE, {
    variables: { id: sondageId ?? '' },
    skip: sondageId === null,
    fetchPolicy: 'cache-and-network',
  })
  const [repondre, reponse] = useMutation(REPONDRE, { refetchQueries: RELIRE })
  const [clore] = useMutation(CLORE, { refetchQueries: RELIRE })
  const [supprimer] = useMutation(SUPPRIMER, { refetchQueries: RELIRE })
  const [choix, setChoix] = useState<Record<string, ChoixSondage>>({})
  const [noms, setNoms] = useState(false)
  const [saisie, setSaisie] = useState<SondageSaisi | null>(null)
  const [reunion, setReunion] = useState<NouvelleReunion | null>(null)
  const libelleChoix = (valeur: ChoixSondage) => {
    const trouve = CHOIX.find(o => o.valeur === valeur)
    return trouve ? t(trouve.libelle).toLowerCase() : ''
  }
  const sondage = data?.sondage
  const ouvert = sondage?.statut === 'OUVERT'

  // La réponse affichée : celle en cours de saisie, sinon celle enregistrée.
  const choixDe = (c: Creneau) => choix[c.id] ?? c.monChoix ?? undefined
  // Une relecture peut retirer un créneau déjà répondu : seules comptent les
  // réponses des créneaux encore proposés.
  const presents = new Set(sondage?.creneaux.map(c => c.id) ?? [])
  const enCours = Object.entries(choix).filter(([id]) => presents.has(id))
  const modifies = enCours.length > 0

  const enregistrerReponses = async () => {
    if (!sondage) return
    try {
      await repondre({
        variables: {
          id: sondage.id,
          reponses: enCours.map(([creneauId, valeur]) => ({
            creneauId,
            choix: valeur,
          })),
        },
      })
      setChoix({})
      message.success(t`Vos réponses sont enregistrées.`)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const retenir = (c: Creneau) => {
    if (!sondage) return
    const creneau = libelleCreneau(c)
    void modal.confirm({
      title: t`Clore le sondage sur ce créneau ?`,
      content: t`${creneau}. Les réponses ne changent plus. Vous créez ensuite la réunion.`,
      okText: t`Clore`,
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await clore({ variables: { id: sondage.id, creneauId: c.id } })
          message.success(t`Sondage clos.`)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  const confirmerSuppression = () => {
    if (!sondage) return
    void modal.confirm({
      title: t`Supprimer ce sondage ?`,
      content: t`Le sondage et ses réponses disparaissent. Une réunion déjà créée reste dans l’agenda.`,
      okText: t`Supprimer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await supprimer({ variables: { id: sondage.id } })
          message.success(t`Sondage supprimé.`)
          onFermer()
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  const creerReunion = () => {
    const retenu = sondage?.creneaux.find(c => c.retenu)
    if (!sondage || !retenu) return
    setReunion({
      perimetreId: sondage.perimetre?.id ?? null,
      titre: sondage.titre,
      jour: retenu.jour,
      heureDebut: retenu.heureDebut,
      heureFin: retenu.heureFin,
      sondageId: sondage.id,
      // La réunion convoque les personnes du sondage, nommément : une
      // affectation changée pendant le sondage n'ajoute ni ne retire personne.
      cible: 'CHOIX',
      personneIds: sondage.participantIds ?? [],
    })
  }

  return (
    <>
      <Drawer
        open={sondageId !== null && saisie === null && reunion === null}
        onClose={() => {
          setChoix({})
          onFermer()
        }}
        title={sondage?.titre ?? t`Sondage`}
        size={520}
        extra={
          sondage?.peutModifier && (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              {ouvert && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() =>
                    setSaisie({
                      id: sondage.id,
                      perimetreId: sondage.perimetre?.id ?? null,
                      titre: sondage.titre,
                      description: sondage.description,
                      creneaux: sondage.creneaux,
                      version: sondage.version,
                    })
                  }
                >
                  <Trans>Modifier</Trans>
                </Button>
              )}
              <Button
                danger
                icon={<DeleteOutlined />}
                aria-label={t`Supprimer le sondage`}
                onClick={confirmerSuppression}
              />
            </span>
          )
        }
      >
        {error && !data ? (
          <p className="rt-texte-secondaire">
            <Trans>
              Ce sondage n’existe pas ou ne vous est pas accessible.
            </Trans>
          </p>
        ) : loading && !sondage ? (
          <Skeleton active />
        ) : sondage ? (
          <div className="rt-reunion">
            <p className="rt-reunion-quand">
              <Tag color={ouvert ? 'processing' : 'default'}>
                {ouvert
                  ? t({ message: 'Ouvert', comment: 'Statut d’un sondage' })
                  : t({ message: 'Clos', comment: 'Statut d’un sondage' })}
              </Tag>
              {sondage.perimetre ? (
                <PastillePerimetre
                  nom={sondage.perimetre.nom}
                  couleur={sondage.perimetre.couleur}
                />
              ) : (
                <span className="rt-note">
                  <Trans>Agenda global de l’activité</Trans>
                </span>
              )}
            </p>
            {sondage.description && (
              <p className="rt-reunion-description">{sondage.description}</p>
            )}
            <p className="rt-texte-secondaire">
              <CompteRepondants
                repondants={sondage.repondants}
                participants={sondage.participants}
              />
            </p>
            <ul className="rt-sondage-liste">
              {sondage.creneaux.map(c => {
                const creneau = libelleCreneau(c)
                return (
                  <li
                    key={c.id}
                    className={c.retenu ? 'rt-sondage-retenu' : undefined}
                  >
                    <div className="rt-sondage-ligne">
                      <span style={{ fontWeight: 600 }}>
                        {creneau}
                        {c.retenu && (
                          <Tag color="success" style={{ marginInlineStart: 8 }}>
                            {t({
                              message: 'Retenu',
                              comment: 'Créneau retenu d’un sondage',
                            })}
                          </Tag>
                        )}
                      </span>
                      <span className="rt-compte">
                        <CompteCreneau
                          oui={c.oui}
                          siBesoin={c.siBesoin}
                          non={c.non}
                        />
                      </span>
                    </div>
                    {sondage.estParticipant && ouvert && (
                      <Radio.Group
                        size="small"
                        optionType="button"
                        buttonStyle="solid"
                        aria-label={t`Votre réponse pour le créneau ${creneau}`}
                        // Une réponse changée pendant l'enregistrement serait
                        // effacée avec le brouillon : les boutons attendent.
                        disabled={reponse.loading}
                        value={choixDe(c)}
                        onChange={e =>
                          setChoix(actuels => ({
                            ...actuels,
                            [c.id]: e.target.value as ChoixSondage,
                          }))
                        }
                        options={CHOIX.map(o => ({
                          value: o.valeur,
                          label: t(o.libelle),
                        }))}
                      />
                    )}
                    {noms && c.reponses.length > 0 && (
                      <p className="rt-note">
                        {c.reponses
                          .map(r => `${r.nom} (${libelleChoix(r.choix)})`)
                          .join(', ')}
                      </p>
                    )}
                    {sondage.peutModifier && ouvert && (
                      <Button
                        size="small"
                        type="link"
                        style={{ padding: 0, alignSelf: 'flex-start' }}
                        onClick={() => retenir(c)}
                      >
                        <Trans>Retenir ce créneau</Trans>
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sondage.estParticipant && ouvert && (
                <Button
                  type="primary"
                  disabled={!modifies}
                  loading={reponse.loading}
                  onClick={() => void enregistrerReponses()}
                >
                  <Trans>Enregistrer mes réponses</Trans>
                </Button>
              )}
              <Button onClick={() => setNoms(n => !n)}>
                {noms ? t`Masquer les noms` : t`Voir les noms`}
              </Button>
              {sondage.peutModifier &&
                !ouvert &&
                sondage.reunionId === null && (
                  <Button type="primary" onClick={creerReunion}>
                    <Trans>Créer la réunion</Trans>
                  </Button>
                )}
            </span>
            {!ouvert && sondage.reunionId !== null && (
              <p className="rt-note">
                <Trans>
                  La réunion a été créée depuis ce sondage. Elle figure dans
                  l’agenda.
                </Trans>
              </p>
            )}
          </div>
        ) : null}
      </Drawer>
      {sondage && (
        <>
          <SondageFormulaire
            editionId={sondage.editionId}
            agendas={agendas}
            sondage={saisie}
            onFermer={() => setSaisie(null)}
          />
          <ReunionFormulaire
            editionId={sondage.editionId}
            agendas={agendas}
            reunion={reunion}
            onFermer={() => setReunion(null)}
          />
        </>
      )}
    </>
  )
}
