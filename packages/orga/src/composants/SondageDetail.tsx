import { useMutation, useQuery } from '@apollo/client/react'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
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

const CHOIX: { valeur: ChoixSondage; libelle: string }[] = [
  { valeur: 'OUI', libelle: 'Oui' },
  { valeur: 'SI_BESOIN', libelle: 'Si besoin' },
  { valeur: 'NON', libelle: 'Non' },
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
      message.success('Vos réponses sont enregistrées.')
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const retenir = (c: Creneau) => {
    if (!sondage) return
    void modal.confirm({
      title: 'Clore le sondage sur ce créneau ?',
      content: `${libelleCreneau(c)}. Les réponses ne changent plus. Vous créez ensuite la réunion.`,
      okText: 'Clore',
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          await clore({ variables: { id: sondage.id, creneauId: c.id } })
          message.success('Sondage clos.')
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  const confirmerSuppression = () => {
    if (!sondage) return
    void modal.confirm({
      title: 'Supprimer ce sondage ?',
      content:
        'Le sondage et ses réponses disparaissent. Une réunion déjà créée reste dans l’agenda.',
      okText: 'Supprimer',
      okButtonProps: { danger: true },
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          await supprimer({ variables: { id: sondage.id } })
          message.success('Sondage supprimé.')
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
        title={sondage?.titre ?? 'Sondage'}
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
                  Modifier
                </Button>
              )}
              <Button
                danger
                icon={<DeleteOutlined />}
                aria-label="Supprimer le sondage"
                onClick={confirmerSuppression}
              />
            </span>
          )
        }
      >
        {error && !data ? (
          <p className="rt-texte-secondaire">
            Ce sondage n’existe pas ou ne vous est pas accessible.
          </p>
        ) : loading && !sondage ? (
          <Skeleton active />
        ) : sondage ? (
          <div className="rt-reunion">
            <p className="rt-reunion-quand">
              <Tag color={ouvert ? 'processing' : 'default'}>
                {ouvert ? 'Ouvert' : 'Clos'}
              </Tag>
              {sondage.perimetre ? (
                <PastillePerimetre
                  nom={sondage.perimetre.nom}
                  couleur={sondage.perimetre.couleur}
                />
              ) : (
                <span className="rt-note">Agenda global de l’activité</span>
              )}
            </p>
            {sondage.description && (
              <p className="rt-reunion-description">{sondage.description}</p>
            )}
            <p className="rt-texte-secondaire">
              {sondage.repondants} sur {sondage.participants}{' '}
              {sondage.participants > 1 ? 'personnes ont' : 'personne a'}{' '}
              répondu.
            </p>
            <ul className="rt-sondage-liste">
              {sondage.creneaux.map(c => (
                <li
                  key={c.id}
                  className={c.retenu ? 'rt-sondage-retenu' : undefined}
                >
                  <div className="rt-sondage-ligne">
                    <span style={{ fontWeight: 600 }}>
                      {libelleCreneau(c)}
                      {c.retenu && (
                        <Tag color="success" style={{ marginInlineStart: 8 }}>
                          Retenu
                        </Tag>
                      )}
                    </span>
                    <span className="rt-compte">
                      {c.oui} oui · {c.siBesoin} si besoin · {c.non} non
                    </span>
                  </div>
                  {sondage.estParticipant && ouvert && (
                    <Radio.Group
                      size="small"
                      optionType="button"
                      buttonStyle="solid"
                      aria-label={`Votre réponse pour le créneau ${libelleCreneau(c)}`}
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
                        label: o.libelle,
                      }))}
                    />
                  )}
                  {noms && c.reponses.length > 0 && (
                    <p className="rt-note">
                      {c.reponses
                        .map(
                          r =>
                            `${r.nom} (${CHOIX.find(o => o.valeur === r.choix)?.libelle.toLowerCase()})`
                        )
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
                      Retenir ce créneau
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sondage.estParticipant && ouvert && (
                <Button
                  type="primary"
                  disabled={!modifies}
                  loading={reponse.loading}
                  onClick={() => void enregistrerReponses()}
                >
                  Enregistrer mes réponses
                </Button>
              )}
              <Button onClick={() => setNoms(n => !n)}>
                {noms ? 'Masquer les noms' : 'Voir les noms'}
              </Button>
              {sondage.peutModifier &&
                !ouvert &&
                sondage.reunionId === null && (
                  <Button type="primary" onClick={creerReunion}>
                    Créer la réunion
                  </Button>
                )}
            </span>
            {!ouvert && sondage.reunionId !== null && (
              <p className="rt-note">
                La réunion a été créée depuis ce sondage. Elle figure dans
                l’agenda.
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
