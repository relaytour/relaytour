import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, t } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Empty, Result, Segmented, Skeleton, Tag } from 'antd'
import { useState } from 'react'

import { graphql } from '../gql'
import type {
  CandidaturesQuery,
  StatutCandidature,
  StatutChoix,
} from '../gql/graphql'
import { libelleJours } from '../lib/agenda'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import { CANDIDATURES } from '../lib/requetes-benevoles'

import PastillePerimetre from './PastillePerimetre'

// File de revue des candidatures d'une période (ADR 0041). Le serveur ne montre
// à une personne qui écrit dans un périmètre que les choix de ses séquences.
// Accepter crée la fiche bénévole avec une place à confirmer ; refuser n'envoie
// rien.

const ACCEPTER = graphql(`
  mutation AccepterChoixCandidature($id: ID!) {
    accepterChoixCandidature(id: $id) {
      id
    }
  }
`)

const REFUSER = graphql(`
  mutation RefuserChoixCandidature($id: ID!) {
    refuserChoixCandidature(id: $id) {
      id
    }
  }
`)

const ECARTER = graphql(`
  mutation RefuserCandidature($id: ID!) {
    refuserCandidature(id: $id) {
      id
    }
  }
`)

type Candidature = CandidaturesQuery['candidatures'][number]

const STATUTS: Record<
  StatutChoix,
  { libelle: MessageDescriptor; couleur: string }
> = {
  EN_ATTENTE: {
    libelle: msg({
      message: 'En attente',
      comment: 'Statut du choix de séquence d’une candidature de bénévole',
    }),
    couleur: 'processing',
  },
  LISTE_ATTENTE: {
    libelle: msg({
      message: 'Liste d’attente',
      comment: 'Statut du choix de séquence d’une candidature de bénévole',
    }),
    couleur: 'warning',
  },
  ACCEPTE: {
    libelle: msg({
      message: 'Acceptée',
      comment: 'Statut du choix de séquence d’une candidature de bénévole',
    }),
    couleur: 'success',
  },
  REFUSE: {
    libelle: msg({
      message: 'Refusée',
      comment: 'Statut du choix de séquence d’une candidature de bénévole',
    }),
    couleur: 'default',
  },
}

const RELIRE = [
  'Candidatures',
  'Benevoles',
  'Programme',
  'BenevolesARepartir',
  'CouvertureProgramme',
  'AppelsBenevoles',
]

/** Une plage de disponibilité en clair : « sam. 5 juin, 8:00 → 13:00 ». */
function plageEnClair(p: Candidature['plages'][number]): string {
  const jourDebut = libelleJours(p.jour)
  const jourFin = libelleJours(p.jourFin)
  const heureDebut = p.heureDebut
  const heureFin = p.heureFin
  return p.jourFin !== p.jour
    ? t`${jourDebut} ${heureDebut} → ${jourFin} ${heureFin}`
    : t`${jourDebut}, ${heureDebut} → ${heureFin}`
}

/** Le dépôt d'une candidature en clair : « Association · déposée le 4 juin ». */
function depotEnClair(c: Candidature): string {
  const appelNom = c.appelNom
  const jourDepot = jourDeLInstant(c.deposeeLe)
  return c.origine === 'IMPORT'
    ? t`${appelNom} · importée le ${jourDepot}`
    : t`${appelNom} · déposée le ${jourDepot}`
}

/** L'horaire d'une séquence choisie, jusqu'au lieu s'il existe. */
function horaireSequence(x: Candidature['choix'][number]): string {
  const jourDebut = libelleJours(x.jour)
  const jourFin = libelleJours(x.jourFin)
  const heureDebut = x.heureDebut
  const heureFin = x.heureFin
  const horaire =
    x.jourFin !== x.jour
      ? t`${jourDebut}, ${heureDebut} → ${jourFin}, ${heureFin}`
      : t`${jourDebut}, ${heureDebut} → ${heureFin}`
  return x.lieu ? `${horaire} · ${x.lieu}` : horaire
}

export default function CandidaturesBenevoles({
  editionId,
  archivee,
}: {
  editionId: string
  archivee: boolean
}) {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const [statut, setStatut] = useState<StatutCandidature>('EN_ATTENTE')
  const { data, loading, error } = useQuery(CANDIDATURES, {
    variables: { editionId, statut },
    fetchPolicy: 'cache-and-network',
  })
  const relire = { refetchQueries: RELIRE }
  const [accepter] = useMutation(ACCEPTER, relire)
  const [refuser] = useMutation(REFUSER, relire)
  const [ecarter] = useMutation(ECARTER, relire)
  const [enCours, setEnCours] = useState<string | null>(null)

  const agir = async (
    cle: string,
    action: () => Promise<unknown>,
    ok: string
  ) => {
    setEnCours(cle)
    try {
      await action()
      message.success(ok)
    } catch (e) {
      message.error(messageErreur(e))
    } finally {
      setEnCours(null)
    }
  }

  const confirmerEcart = (c: Candidature) => {
    const nomCandidat = c.nom
    void modal.confirm({
      title: t`Refuser toute la candidature de ${nomCandidat} ?`,
      content: t`Les séquences encore en attente sont refusées. Aucun mail ne part, et la personne peut déposer de nouveau.`,
      okText: t`Refuser la candidature`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: () =>
        agir(
          `ecarter-${c.id}`,
          () => ecarter({ variables: { id: c.id } }),
          t`Candidature refusée.`
        ),
    })
  }

  if (error && !data) {
    return (
      <Result
        status="warning"
        title={t`Les candidatures n’ont pas pu être chargées.`}
        subTitle={messageErreur(error)}
      />
    )
  }

  const candidatures = data?.candidatures ?? []

  return (
    <div className="rt-candidatures">
      <Segmented<StatutCandidature>
        value={statut}
        onChange={setStatut}
        options={[
          { value: 'EN_ATTENTE', label: t`À traiter` },
          { value: 'TRAITEE', label: t`Traitées` },
          { value: 'RETIREE', label: t`Retirées` },
        ]}
      />
      {loading && !data ? (
        <Skeleton active />
      ) : candidatures.length === 0 ? (
        <Empty
          description={
            statut === 'EN_ATTENTE'
              ? t`Aucune candidature n’attend votre revue.`
              : t`Aucune candidature ici.`
          }
        />
      ) : (
        <ul className="rt-candidatures-liste">
          {candidatures.map(c => (
            <li key={c.id} className="rt-verre rt-candidature">
              <header className="rt-candidature-tete">
                <strong>{c.nom}</strong>
                <span className="rt-note">{depotEnClair(c)}</span>
              </header>
              <p className="rt-candidature-contact">
                {c.courriel && (
                  <a href={`mailto:${c.courriel}`}>{c.courriel}</a>
                )}
                {c.telephone && (
                  <a href={`tel:${c.telephone.replace(/\s/g, '')}`}>
                    {c.telephone}
                  </a>
                )}
              </p>
              {c.plages.length > 0 && (
                <p className="rt-candidature-plages">
                  <span className="rt-libelle">{t`Disponible`}</span>
                  {c.plages.map(p => (
                    <Tag key={`${p.jour}-${p.heureDebut}`}>
                      {plageEnClair(p)}
                    </Tag>
                  ))}
                </p>
              )}
              {c.precisionsDisponibilite && (
                <p className="rt-candidature-texte">
                  <span className="rt-libelle">{t`Précisions`}</span>{' '}
                  {c.precisionsDisponibilite}
                </p>
              )}
              {c.message && (
                <p className="rt-candidature-texte">
                  <span className="rt-libelle">{t`Message`}</span> {c.message}
                </p>
              )}
              {c.ouAilleurs && (
                <p className="rt-note">
                  <Trans>
                    Aide là où il manque du monde : placez la personne depuis la
                    vue « Répartition » du programme.
                  </Trans>
                </p>
              )}
              {c.choix.length > 0 && (
                <ul className="rt-candidature-choix">
                  {c.choix.map(x => {
                    const enAttente =
                      x.statut === 'EN_ATTENTE' || x.statut === 'LISTE_ATTENTE'
                    return (
                      <li key={x.id}>
                        <span className="rt-candidature-sequence">
                          <span>
                            {x.titre}
                            <span className="rt-note">
                              {' '}
                              · {horaireSequence(x)}
                            </span>
                          </span>
                          {x.perimetre && (
                            <PastillePerimetre
                              nom={x.perimetre.nom}
                              couleur={x.perimetre.couleur}
                            />
                          )}
                          <Tag color={STATUTS[x.statut].couleur}>
                            {t(STATUTS[x.statut].libelle)}
                          </Tag>
                        </span>
                        {x.peutTraiter &&
                          !archivee &&
                          x.statut !== 'ACCEPTE' && (
                            <span className="rt-candidature-actions">
                              <Button
                                size="small"
                                type="primary"
                                icon={<CheckOutlined />}
                                loading={enCours === `accepter-${x.id}`}
                                onClick={() =>
                                  void agir(
                                    `accepter-${x.id}`,
                                    () => accepter({ variables: { id: x.id } }),
                                    t`Séquence acceptée : la place attend la confirmation de la personne.`
                                  )
                                }
                              >
                                {t`Accepter`}
                              </Button>
                              {enAttente && (
                                <Button
                                  size="small"
                                  icon={<CloseOutlined />}
                                  loading={enCours === `refuser-${x.id}`}
                                  onClick={() =>
                                    void agir(
                                      `refuser-${x.id}`,
                                      () =>
                                        refuser({ variables: { id: x.id } }),
                                      t`Séquence refusée.`
                                    )
                                  }
                                >
                                  {t`Refuser`}
                                </Button>
                              )}
                            </span>
                          )}
                      </li>
                    )
                  })}
                </ul>
              )}
              {c.peutEcarter && c.statut === 'EN_ATTENTE' && !archivee && (
                <footer className="rt-candidature-pied">
                  <Button
                    danger
                    size="small"
                    loading={enCours === `ecarter-${c.id}`}
                    onClick={() => confirmerEcart(c)}
                  >
                    {t`Refuser toute la candidature`}
                  </Button>
                </footer>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="rt-note">
        <Trans>
          Accepter une séquence crée la fiche bénévole avec une place à
          confirmer. La première place envoie à la personne un mail avec son
          lien personnel. Refuser n’envoie rien. Les candidatures disparaissent
          à l’archivage de la période.
        </Trans>
      </p>
    </div>
  )
}
