import { CopyOutlined, LinkOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, App, Button, Checkbox, Radio, Select, Space } from 'antd'
import { useState } from 'react'

import { graphql } from '../gql'
import { messageErreur } from '../lib/erreurs'

import { Panneau } from './Panneau'
import { langueActive } from '../lib/langue'

// Les périmètres qu'un abonnement peut suivre : ceux que la personne lit, comme
// le serveur l'exige (`perimetresLisibles`). Une consultation ne suffit pas.
const PERIMETRES_ABONNABLES = graphql(`
  query PerimetresAbonnables {
    perimetres {
      id
      nom
      archive
      acces
    }
  }
`)

const MON_ABONNEMENT = graphql(`
  query MonAbonnementAgenda {
    monAbonnementAgenda {
      id
      fin
      perimetreIds
      inclurePhases
      inclureDatesCles
      inclureReunions
      inclureEcheances
      creeLe
      dernierAccesLe
    }
  }
`)

const CREER = graphql(`
  mutation CreerMonAbonnementAgenda(
    $perimetreIds: [ID!]
    $inclurePhases: Boolean
    $inclureDatesCles: Boolean
    $inclureReunions: Boolean
    $inclureEcheances: Boolean
  ) {
    creerMonAbonnementAgenda(
      perimetreIds: $perimetreIds
      inclurePhases: $inclurePhases
      inclureDatesCles: $inclureDatesCles
      inclureReunions: $inclureReunions
      inclureEcheances: $inclureEcheances
    ) {
      adresse
      abonnement {
        id
      }
    }
  }
`)

const REGLER = graphql(`
  mutation ReglerMonAbonnementAgenda(
    $perimetreIds: [ID!]
    $inclurePhases: Boolean!
    $inclureDatesCles: Boolean!
    $inclureReunions: Boolean!
    $inclureEcheances: Boolean!
  ) {
    reglerMonAbonnementAgenda(
      perimetreIds: $perimetreIds
      inclurePhases: $inclurePhases
      inclureDatesCles: $inclureDatesCles
      inclureReunions: $inclureReunions
      inclureEcheances: $inclureEcheances
    ) {
      id
      perimetreIds
      inclurePhases
      inclureDatesCles
      inclureReunions
      inclureEcheances
    }
  }
`)

const REVOQUER = graphql(`
  mutation RevoquerMonAbonnementAgenda {
    revoquerMonAbonnementAgenda
  }
`)

const ABONNEMENT_ACTIVITE = graphql(`
  query AbonnementAgendaActivite($activiteId: ID!) {
    abonnementAgendaActivite(activiteId: $activiteId) {
      id
      fin
      inclurePhases
      inclureDatesCles
      inclureReunions
      creeLe
      dernierAccesLe
    }
  }
`)

const CREER_ACTIVITE = graphql(`
  mutation CreerAbonnementAgendaActivite(
    $activiteId: ID!
    $inclurePhases: Boolean
    $inclureDatesCles: Boolean
    $inclureReunions: Boolean
  ) {
    creerAbonnementAgendaActivite(
      activiteId: $activiteId
      inclurePhases: $inclurePhases
      inclureDatesCles: $inclureDatesCles
      inclureReunions: $inclureReunions
    ) {
      adresse
    }
  }
`)

const REGLER_ACTIVITE = graphql(`
  mutation ReglerAbonnementAgendaActivite(
    $activiteId: ID!
    $inclurePhases: Boolean!
    $inclureDatesCles: Boolean!
    $inclureReunions: Boolean!
  ) {
    reglerAbonnementAgendaActivite(
      activiteId: $activiteId
      inclurePhases: $inclurePhases
      inclureDatesCles: $inclureDatesCles
      inclureReunions: $inclureReunions
    ) {
      id
      inclurePhases
      inclureDatesCles
      inclureReunions
    }
  }
`)

const REVOQUER_ACTIVITE = graphql(`
  mutation RevoquerAbonnementAgendaActivite($activiteId: ID!) {
    revoquerAbonnementAgendaActivite(activiteId: $activiteId)
  }
`)

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString(langueActive(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

/**
 * L'adresse d'un abonnement, affichée une seule fois : la copier, ou l'ouvrir
 * dans l'agenda de l'appareil par le protocole webcal.
 */
function AdresseUnique({ adresse }: { adresse: string }) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const webcal = adresse.replace(/^https?:/, 'webcal:')
  return (
    <Alert
      type="success"
      showIcon
      title={t`Votre adresse d’abonnement`}
      description={
        <div className="rt-abonnement-adresse">
          <code>{adresse}</code>
          <p className="rt-note">
            <Trans>
              Cette adresse ne s’affichera plus. Copiez-la maintenant et
              gardez-la pour vous : elle donne accès au contenu de l’agenda.
            </Trans>
          </p>
          <div className="rt-abonnement-boutons">
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                void navigator.clipboard.writeText(adresse).then(
                  () => message.success(t`L’adresse est copiée.`),
                  () =>
                    message.error(
                      t`La copie a échoué : sélectionnez l’adresse à la main.`
                    )
                )
              }}
            >
              <Trans>Copier l’adresse</Trans>
            </Button>
            <Button icon={<LinkOutlined />} href={webcal}>
              <Trans>Ouvrir dans mon agenda</Trans>
            </Button>
          </div>
        </div>
      }
    />
  )
}

/** Les types d'événements de l'agenda global qu'un abonnement sert. */
interface Types {
  inclurePhases: boolean
  inclureDatesCles: boolean
  inclureReunions: boolean
}

/** Les phases sont décochées par défaut : elles chargent beaucoup un agenda. */
const TYPES_PAR_DEFAUT: Types = {
  inclurePhases: false,
  inclureDatesCles: true,
  inclureReunions: true,
}

const memesTypes = (a: Types, b: Types) =>
  a.inclurePhases === b.inclurePhases &&
  a.inclureDatesCles === b.inclureDatesCles &&
  a.inclureReunions === b.inclureReunions

const memesPerimetres = (
  a: readonly string[] | null,
  b: readonly string[] | null
) =>
  a === null || b === null
    ? a === b
    : a.length === b.length && [...a].sort().join() === [...b].sort().join()

/** Les cases des types d'événements, communes aux deux abonnements. */
function CasesTypes({
  types,
  onChange,
}: {
  types: Types
  onChange: (types: Types) => void
}) {
  return (
    <>
      <Checkbox
        checked={types.inclureReunions}
        onChange={e =>
          onChange({ ...types, inclureReunions: e.target.checked })
        }
      >
        <Trans>Les réunions de l’agenda global</Trans>
      </Checkbox>
      <Checkbox
        checked={types.inclureDatesCles}
        onChange={e =>
          onChange({ ...types, inclureDatesCles: e.target.checked })
        }
      >
        <Trans>Les dates clés et les jours de chaque période</Trans>
      </Checkbox>
      <Checkbox
        checked={types.inclurePhases}
        onChange={e => onChange({ ...types, inclurePhases: e.target.checked })}
      >
        <Trans>
          Les phases, qui occupent chacune plusieurs semaines de l’agenda
        </Trans>
      </Checkbox>
    </>
  )
}

const AIDE = msg`Dans Google Agenda, choisissez « Autres agendas », puis « À partir de l’URL ». Dans Outlook, choisissez « Ajouter un agenda », puis « S’abonner à partir du web ». Votre agenda relit l’adresse à son rythme, parfois une seule fois par jour.`

/** L'abonnement personnel à l'agenda, dans les préférences (ADR 0037). */
export function PreferenceAgenda() {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const { data, loading, error, refetch } = useQuery(MON_ABONNEMENT)
  const { data: perimetres } = useQuery(PERIMETRES_ABONNABLES)
  const [creer, creation] = useMutation(CREER)
  const [regler, reglage] = useMutation(REGLER)
  const [revoquer] = useMutation(REVOQUER)
  const [adresse, setAdresse] = useState<string | null>(null)
  const abonnement = data?.monAbonnementAgenda ?? null
  const [tous, setTous] = useState(true)
  const [choisis, setChoisis] = useState<string[]>([])
  const [types, setTypes] = useState<Types>(TYPES_PAR_DEFAUT)
  const [echeances, setEcheances] = useState(false)

  // Les réglages lus se recopient dans le formulaire quand ils changent sur le
  // serveur : une autre fenêtre a pu les enregistrer.
  const cleLue = abonnement
    ? `${abonnement.id}:${JSON.stringify(abonnement.perimetreIds)}:${abonnement.inclurePhases}:${abonnement.inclureDatesCles}:${abonnement.inclureReunions}:${abonnement.inclureEcheances}`
    : null
  const [lue, setLue] = useState<string | null>(null)
  if (abonnement && cleLue !== lue) {
    setLue(cleLue)
    setTous(abonnement.perimetreIds === null)
    setChoisis(abonnement.perimetreIds ?? [])
    setTypes({
      inclurePhases: abonnement.inclurePhases,
      inclureDatesCles: abonnement.inclureDatesCles,
      inclureReunions: abonnement.inclureReunions,
    })
    setEcheances(abonnement.inclureEcheances)
  }

  const creeLe = abonnement ? dateCourte(abonnement.creeLe) : ''
  const finAdresse = abonnement?.fin ?? ''
  const derniereLecture = abonnement?.dernierAccesLe
    ? dateCourte(abonnement.dernierAccesLe)
    : null

  const reglages = {
    perimetreIds: tous ? null : choisis,
    ...types,
    inclureEcheances: echeances,
  }
  // « Enregistrer » reste désactivé tant que le formulaire suit le serveur.
  const modifie =
    abonnement !== null &&
    !(
      memesTypes(types, abonnement) &&
      echeances === abonnement.inclureEcheances &&
      memesPerimetres(reglages.perimetreIds, abonnement.perimetreIds ?? null)
    )

  const creerAdresse = async () => {
    try {
      const r = await creer({ variables: reglages })
      setAdresse(r.data?.creerMonAbonnementAgenda.adresse ?? null)
      await refetch()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const nouvelleAdresse = () =>
    void modal.confirm({
      title: t`Créer une nouvelle adresse ?`,
      content: t`L’adresse actuelle cesse aussitôt de servir. Vous devrez abonner de nouveau vos agendas.`,
      okText: t`Nouvelle adresse`,
      cancelText: t`Annuler`,
      onOk: creerAdresse,
    })

  const revoquerAdresse = () =>
    void modal.confirm({
      title: t`Révoquer votre abonnement ?`,
      content: t`L’adresse cesse aussitôt de servir. Vos agendas gardent les événements déjà lus jusqu’à leur prochaine relecture.`,
      okText: t`Révoquer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await revoquer()
          setAdresse(null)
          await refetch()
          message.success(t`Abonnement révoqué.`)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })

  return (
    <Panneau titre={t`Votre agenda dans Outlook, Google ou Apple`}>
      <p className="rt-texte-secondaire">
        <Trans>
          Une adresse secrète ajoute vos dates à votre agenda personnel, en
          lecture seule : l’agenda global de vos activités, les réunions de vos
          périmètres et vos convocations.
        </Trans>
      </p>
      <Radio.Group
        value={tous ? 'tous' : 'choix'}
        onChange={e => setTous(e.target.value === 'tous')}
        options={[
          { value: 'tous', label: t`Tous les périmètres que je lis` },
          { value: 'choix', label: t`Seulement ces périmètres` },
        ]}
      />
      {!tous && (
        <Select
          mode="multiple"
          aria-label={t`Périmètres de l’abonnement`}
          placeholder={t`Choisir des périmètres`}
          optionFilterProp="label"
          value={choisis}
          onChange={setChoisis}
          options={(perimetres?.perimetres ?? [])
            .filter(p => !p.archive && p.acces === 'COMPLET')
            .map(p => ({ value: p.id, label: p.nom }))}
        />
      )}
      <CasesTypes types={types} onChange={setTypes} />
      <Checkbox
        checked={echeances}
        onChange={e => setEcheances(e.target.checked)}
      >
        <Trans>Les échéances des tâches qui me sont assignées</Trans>
      </Checkbox>
      {adresse && <AdresseUnique adresse={adresse} />}
      {abonnement ? (
        <>
          <p className="rt-note">
            <Trans>
              Adresse active, créée le {creeLe}, se terminant par « {finAdresse}{' '}
              ».
            </Trans>{' '}
            {derniereLecture
              ? t`Dernière lecture par un agenda le ${derniereLecture}.`
              : t`Aucun agenda ne l’a encore lue.`}
          </p>
          <Space wrap>
            <Button
              type="primary"
              loading={reglage.loading}
              disabled={!modifie}
              onClick={() => {
                void regler({ variables: reglages }).then(
                  () => message.success(t`Abonnement enregistré.`),
                  (e: unknown) => message.error(messageErreur(e))
                )
              }}
            >
              <Trans>Enregistrer</Trans>
            </Button>
            <Button onClick={nouvelleAdresse}>
              <Trans>Nouvelle adresse</Trans>
            </Button>
            <Button danger onClick={revoquerAdresse}>
              <Trans>Révoquer</Trans>
            </Button>
          </Space>
        </>
      ) : (
        // La création révoque l'adresse existante : elle attend que la lecture
        // ait établi qu'il n'y en a pas.
        <Button
          type="primary"
          loading={creation.loading}
          disabled={data === undefined}
          onClick={() => void creerAdresse()}
          style={{ alignSelf: 'flex-start' }}
        >
          <Trans>Créer mon adresse</Trans>
        </Button>
      )}
      {error && !data && !loading && (
        <p className="rt-note">
          <Trans>
            Votre abonnement n’a pas pu être lu. Rechargez la page dans un
            instant.
          </Trans>
        </p>
      )}
      <p className="rt-note">{t(AIDE)}</p>
    </Panneau>
  )
}

/** L'abonnement à l'agenda global d'une activité, pour ses admins (ADR 0037). */
export function AbonnementActivite({
  activiteId,
  nom,
}: {
  activiteId: string
  nom: string
}) {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const { data, loading, error, refetch } = useQuery(ABONNEMENT_ACTIVITE, {
    variables: { activiteId },
  })
  const [creer, creation] = useMutation(CREER_ACTIVITE)
  const [regler, reglage] = useMutation(REGLER_ACTIVITE)
  const [revoquer] = useMutation(REVOQUER_ACTIVITE)
  const [adresse, setAdresse] = useState<string | null>(null)
  const abonnement = data?.abonnementAgendaActivite ?? null
  const finAdresse = abonnement?.fin ?? ''
  const derniereLecture = abonnement?.dernierAccesLe
    ? dateCourte(abonnement.dernierAccesLe)
    : null
  const [types, setTypes] = useState<Types>(TYPES_PAR_DEFAUT)

  // Les réglages lus se recopient dans le formulaire quand ils changent sur le
  // serveur : un autre admin a pu les enregistrer.
  const cleLue = abonnement
    ? `${abonnement.id}:${abonnement.inclurePhases}:${abonnement.inclureDatesCles}:${abonnement.inclureReunions}`
    : null
  const [lue, setLue] = useState<string | null>(null)
  if (abonnement && cleLue !== lue) {
    setLue(cleLue)
    setTypes({
      inclurePhases: abonnement.inclurePhases,
      inclureDatesCles: abonnement.inclureDatesCles,
      inclureReunions: abonnement.inclureReunions,
    })
  }

  const modifie = abonnement !== null && !memesTypes(types, abonnement)

  const creerAdresse = async () => {
    try {
      const r = await creer({ variables: { activiteId, ...types } })
      setAdresse(r.data?.creerAbonnementAgendaActivite.adresse ?? null)
      await refetch()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Panneau titre={t`Abonnement de l’activité`}>
      <p className="rt-texte-secondaire">
        <Trans>
          Une adresse secrète publie l’agenda global de {nom}, sans les réunions
          des périmètres. Un agenda partagé de l’association s’y abonne. Vous
          choisissez les types d’événements qu’il reçoit.
        </Trans>
      </p>
      <CasesTypes types={types} onChange={setTypes} />
      {adresse && <AdresseUnique adresse={adresse} />}
      {abonnement ? (
        <>
          <p className="rt-note">
            <Trans>Adresse active, se terminant par « {finAdresse} ».</Trans>{' '}
            {derniereLecture
              ? t`Dernière lecture le ${derniereLecture}.`
              : t`Aucun agenda ne l’a encore lue.`}
          </p>
          <Space wrap>
            <Button
              size="small"
              type="primary"
              loading={reglage.loading}
              disabled={!modifie}
              onClick={() => {
                void regler({ variables: { activiteId, ...types } }).then(
                  () => message.success(t`Abonnement enregistré.`),
                  (e: unknown) => message.error(messageErreur(e))
                )
              }}
            >
              <Trans>Enregistrer</Trans>
            </Button>
            <Button
              size="small"
              onClick={() =>
                void modal.confirm({
                  title: t`Créer une nouvelle adresse ?`,
                  content: t`L’adresse actuelle cesse aussitôt de servir pour tous les agendas abonnés.`,
                  okText: t`Nouvelle adresse`,
                  cancelText: t`Annuler`,
                  onOk: creerAdresse,
                })
              }
            >
              <Trans>Nouvelle adresse</Trans>
            </Button>
            <Button
              size="small"
              danger
              onClick={() =>
                void modal.confirm({
                  title: t`Révoquer l’abonnement de l’activité ?`,
                  okText: t`Révoquer`,
                  okButtonProps: { danger: true },
                  cancelText: t`Annuler`,
                  // Un échec garde la fenêtre ouverte, pour réessayer.
                  onOk: async () => {
                    try {
                      await revoquer({ variables: { activiteId } })
                    } catch (e) {
                      message.error(messageErreur(e))
                      throw e
                    }
                    setAdresse(null)
                    await refetch()
                    message.success(t`Abonnement révoqué.`)
                  },
                })
              }
            >
              <Trans>Révoquer</Trans>
            </Button>
          </Space>
        </>
      ) : (
        <Button
          size="small"
          loading={creation.loading}
          disabled={data === undefined}
          onClick={() => void creerAdresse()}
          style={{ alignSelf: 'flex-start' }}
        >
          <Trans>Créer l’adresse</Trans>
        </Button>
      )}
      {error && !data && !loading && (
        <p className="rt-note">
          <Trans>
            L’abonnement de l’activité n’a pas pu être lu. Rechargez la page
            dans un instant.
          </Trans>
        </p>
      )}
    </Panneau>
  )
}
