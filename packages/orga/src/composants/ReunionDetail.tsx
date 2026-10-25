import { useMutation, useQuery } from '@apollo/client/react'
import {
  EditOutlined,
  EnvironmentOutlined,
  StopOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Drawer, Radio, Skeleton, Tag } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { graphql } from '../gql'
import type { ReponseConvocation } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { libelleJours } from '../lib/agenda'
import { messageErreur } from '../lib/erreurs'
import { PERIMETRES } from '../lib/requetes'

import PastillePerimetre from './PastillePerimetre'
import ReunionFormulaire, {
  type AgendaEcrit,
  type ReunionSaisie,
} from './ReunionFormulaire'

const REUNION = graphql(`
  query Reunion($id: ID!) {
    reunion(id: $id) {
      id
      editionId
      titre
      jour
      jourFin
      heureDebut
      heureFin
      statut
      cible
      version
      perimetre {
        id
        nom
        couleur
      }
      detailMasque
      lieu
      lienVisio
      description
      taches {
        id
        titre
        perimetreId
      }
      peutModifier
      estConvoquee
      maReponse
      reponses {
        presentes
        absentes
        peutEtre
        sansReponse
      }
      convocations {
        personneId
        nom
        reponse
        envoyee
      }
    }
  }
`)

const REPONDRE = graphql(`
  mutation RepondreConvocation($id: ID!, $reponse: ReponseConvocation!) {
    repondreConvocation(reunionId: $id, reponse: $reponse) {
      id
      maReponse
    }
  }
`)

const ANNULER = graphql(`
  mutation AnnulerReunion($id: ID!) {
    annulerReunion(id: $id) {
      id
      statut
    }
  }
`)

const LIBELLES_REPONSE: Record<ReponseConvocation, MessageDescriptor> = {
  PRESENT: msg({
    message: 'Présent·e',
    comment: 'Réponse à une convocation à une réunion',
  }),
  ABSENT: msg({
    message: 'Absent·e',
    comment: 'Réponse à une convocation à une réunion',
  }),
  PEUT_ETRE: msg({
    message: 'Peut-être',
    comment: 'Réponse à une convocation à une réunion',
  }),
}

const RELIRE = ['Agenda', 'Reunions', 'ReunionsDuPerimetre', 'Reunion']

/** Le décompte des réponses d'une réunion, en une phrase. */
function ResumeReponses({
  reponses,
}: {
  reponses: {
    presentes: number
    absentes: number
    peutEtre: number
    sansReponse: number
  }
}) {
  const { t } = useLingui()
  const { presentes, absentes, peutEtre, sansReponse } = reponses
  return (
    <>
      {t`${plural(presentes, { one: '# présence', other: '# présences' })}, ${plural(absentes, { one: '# absence', other: '# absences' })}, ${peutEtre} peut-être, ${sansReponse} sans réponse.`}
    </>
  )
}

/** Volet d'une réunion de l'agenda (ADR 0037). */
export default function ReunionDetail({
  reunionId,
  agendas,
  onFermer,
}: {
  reunionId: string | null
  /** Les agendas où la personne écrit, pour la fenêtre de modification. */
  agendas: AgendaEcrit[]
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { lien } = useActivite()
  const { message, modal } = App.useApp()
  const { data, loading, error } = useQuery(REUNION, {
    variables: { id: reunionId ?? '' },
    skip: reunionId === null,
    fetchPolicy: 'cache-and-network',
  })
  const { data: perimetres } = useQuery(PERIMETRES)
  const [repondre, reponse] = useMutation(REPONDRE, { refetchQueries: RELIRE })
  const [annuler] = useMutation(ANNULER, { refetchQueries: RELIRE })
  const [saisie, setSaisie] = useState<ReunionSaisie | null>(null)
  const slugDe = useMemo(
    () => new Map((perimetres?.perimetres ?? []).map(p => [p.id, p.slug])),
    [perimetres]
  )
  const reunion = data?.reunion
  const annulee = reunion?.statut === 'ANNULEE'

  const confirmerAnnulation = () => {
    if (!reunion) return
    void modal.confirm({
      title: t`Annuler cette réunion ?`,
      content: t`La réunion reste dans l’agenda, marquée annulée. Chaque personne convoquée reçoit un mail d’annulation.`,
      okText: t`Annuler la réunion`,
      okButtonProps: { danger: true },
      cancelText: t`Garder`,
      onOk: async () => {
        try {
          await annuler({ variables: { id: reunion.id } })
          message.success(t`Réunion annulée.`)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  const modifier = () => {
    if (!reunion) return
    setSaisie({
      id: reunion.id,
      perimetreId: reunion.perimetre?.id ?? null,
      titre: reunion.titre,
      jour: reunion.jour,
      jourFin: reunion.jourFin,
      heureDebut: reunion.heureDebut,
      heureFin: reunion.heureFin,
      lieu: reunion.lieu,
      lienVisio: reunion.lienVisio,
      description: reunion.description,
      tacheIds: reunion.taches.map(tache => tache.id),
      cible: reunion.cible,
      personneIds: (reunion.convocations ?? []).map(c => c.personneId),
      version: reunion.version,
    })
  }

  return (
    <>
      <Drawer
        open={reunionId !== null && saisie === null}
        onClose={onFermer}
        title={reunion?.titre ?? t`Réunion`}
        size={460}
        extra={
          reunion?.peutModifier && (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <Button icon={<EditOutlined />} onClick={modifier}>
                <Trans>Modifier</Trans>
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                aria-label={t`Annuler la réunion`}
                onClick={confirmerAnnulation}
              />
            </span>
          )
        }
      >
        {error && !data ? (
          <p className="rt-texte-secondaire">
            <Trans>
              Cette réunion n’existe pas ou ne vous est pas accessible.
            </Trans>
          </p>
        ) : loading && !reunion ? (
          <Skeleton active />
        ) : reunion ? (
          <div className="rt-reunion">
            <p className="rt-reunion-quand">
              {annulee && <Tag color="error">{t`Annulée`}</Tag>}
              <span className={annulee ? 'rt-agenda-faite' : undefined}>
                {reunion.jourFin === reunion.jour
                  ? `${libelleJours(reunion.jour)}, ${reunion.heureDebut} → ${reunion.heureFin}`
                  : `${libelleJours(reunion.jour)} ${reunion.heureDebut} → ${libelleJours(reunion.jourFin)} ${reunion.heureFin}`}
              </span>
            </p>
            <p>
              {reunion.perimetre ? (
                <PastillePerimetre
                  nom={reunion.perimetre.nom}
                  couleur={reunion.perimetre.couleur}
                />
              ) : (
                <span className="rt-note">
                  <Trans>Agenda global de l’activité</Trans>
                </span>
              )}
            </p>

            {reunion.detailMasque ? (
              <p className="rt-note">
                <Trans>
                  Vous consultez ce périmètre. Le lieu, le lien de visio et la
                  description restent réservés à ses personnes et aux personnes
                  convoquées.
                </Trans>
              </p>
            ) : (
              <>
                {reunion.lieu && (
                  <p className="rt-reunion-ligne">
                    <EnvironmentOutlined aria-hidden /> {reunion.lieu}
                  </p>
                )}
                {reunion.lienVisio && !annulee && (
                  <p>
                    <Button
                      icon={<VideoCameraOutlined />}
                      href={reunion.lienVisio}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Trans>Rejoindre la visio</Trans>
                    </Button>
                  </p>
                )}
                {reunion.description && (
                  <p className="rt-reunion-description">
                    {reunion.description}
                  </p>
                )}
                {reunion.taches.length > 0 && (
                  <section>
                    <h3 className="rt-reunion-intertitre">
                      <Trans>Tâches liées</Trans>
                    </h3>
                    <ul className="rt-liste-liens">
                      {reunion.taches.map(tache => {
                        const slug = slugDe.get(tache.perimetreId)
                        return (
                          <li key={tache.id}>
                            {slug ? (
                              <Link
                                className="rt-ligne-lien"
                                style={{ fontSize: 13.5 }}
                                to={lien(
                                  `/perimetres/${slug}?edition=${reunion.editionId}&tache=${tache.id}`
                                )}
                              >
                                {tache.titre}
                              </Link>
                            ) : (
                              tache.titre
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}
              </>
            )}

            {reunion.estConvoquee && !annulee && (
              <section>
                <h3 className="rt-reunion-intertitre">
                  <Trans>Votre réponse</Trans>
                </h3>
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  disabled={reponse.loading}
                  value={reunion.maReponse}
                  onChange={e => {
                    void repondre({
                      variables: {
                        id: reunion.id,
                        reponse: e.target.value as ReponseConvocation,
                      },
                    }).catch((erreur: unknown) =>
                      message.error(messageErreur(erreur))
                    )
                  }}
                  options={(['PRESENT', 'ABSENT', 'PEUT_ETRE'] as const).map(
                    valeur => ({
                      value: valeur,
                      label: t(LIBELLES_REPONSE[valeur]),
                    })
                  )}
                />
              </section>
            )}

            {reunion.reponses &&
              reunion.cible !== null &&
              reunion.cible !== undefined && (
                <section>
                  <h3 className="rt-reunion-intertitre">
                    <Trans>Réponses</Trans>
                  </h3>
                  <p className="rt-texte-secondaire">
                    <ResumeReponses reponses={reunion.reponses} />
                  </p>
                  {reunion.convocations && (
                    <ul className="rt-reunion-convocations">
                      {reunion.convocations.map(c => (
                        <li key={c.personneId}>
                          <span>{c.nom}</span>
                          <span className="rt-note">
                            {c.reponse
                              ? t(LIBELLES_REPONSE[c.reponse])
                              : t`Sans réponse`}
                            {!c.envoyee && !annulee && (
                              <> · {t`envoi en attente`}</>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
          </div>
        ) : null}
      </Drawer>
      {reunion && (
        <ReunionFormulaire
          editionId={reunion.editionId}
          agendas={agendas}
          reunion={saisie}
          onFermer={() => setSaisie(null)}
        />
      )}
    </>
  )
}
