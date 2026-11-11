import { CopyOutlined, KeyOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, App, Button, Checkbox, Input, Radio, Select, Tag } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

import { graphql } from '../gql'
import type { EtatApi, PorteeJeton } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import { API_ORGANISATION, apiOuverte } from '../lib/jetons'
import { MOI } from '../lib/requetes'

import { Panneau } from './Panneau'

// Jetons d'accès des programmes tiers (ADR 0064). Une personne crée ses jetons
// ici, avec sa session : un jeton agit en son nom, dans cette organisation, avec
// ses droits. Sa valeur ne s'affiche qu'une fois, et sa création arrive par mail,
// avec un lien de révocation. La gestion des membres se coche à dessein.

const MES_JETONS = graphql(`
  query MesJetonsAcces {
    mesJetonsAcces {
      id
      nom
      apercu
      portee
      gestionMembres
      activiteIds
      expireLe
      dernierAccesLe
      revoqueLe
      creeLe
    }
  }
`)

const CREER = graphql(`
  mutation CreerJetonAcces(
    $nom: String!
    $portee: PorteeJeton!
    $activiteIds: [ID!]
    $expireLe: DateTime
    $gestionMembres: Boolean
  ) {
    creerJetonAcces(
      nom: $nom
      portee: $portee
      activiteIds: $activiteIds
      expireLe: $expireLe
      gestionMembres: $gestionMembres
    ) {
      jeton
      jetonAcces {
        id
      }
    }
  }
`)

const REVOQUER = graphql(`
  mutation RevoquerJetonAcces($id: ID!) {
    revoquerJetonAcces(id: $id)
  }
`)

const REVOQUER_TOUS = graphql(`
  mutation RevoquerMesJetonsAcces {
    revoquerMesJetonsAcces
  }
`)

/** Jetons actifs d'une personne dans une organisation, comme le serveur l'exige. */
const JETONS_ACTIFS_MAX = 10

/** Durées proposées, en jours. Un jeton vaut un an au plus. */
const DUREES = [30, 90, 180, 365] as const

/** La valeur d'un jeton, affichée une seule fois, à sa création. */
export function JetonUnique({ jeton }: { jeton: string }) {
  const { t } = useLingui()
  const { message } = App.useApp()
  return (
    <Alert
      type="success"
      showIcon
      title={t`Votre jeton d’accès`}
      description={
        <div className="rt-abonnement-adresse">
          <code>{jeton}</code>
          <p className="rt-note">
            <Trans>
              Ce jeton ne s’affichera plus. Copiez-le maintenant dans le
              programme qui l’utilise. Toute personne qui le détient agit en
              votre nom : ne le partagez pas et ne le publiez jamais.
            </Trans>
          </p>
          <div className="rt-abonnement-boutons">
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                void navigator.clipboard.writeText(jeton).then(
                  () => message.success(t`Le jeton est copié.`),
                  () =>
                    message.error(
                      t`La copie a échoué : sélectionnez le jeton à la main.`
                    )
                )
              }}
            >
              <Trans>Copier le jeton</Trans>
            </Button>
          </div>
        </div>
      }
    />
  )
}

/** Le message d'une API fermée, selon sa cause. */
function ApiFermee({
  etat,
  motif,
}: {
  etat: EtatApi
  motif: string | null | undefined
}) {
  const { t } = useLingui()
  if (etat === 'SUSPENDUE') {
    return (
      <Alert
        type="warning"
        showIcon
        title={t`L’API de votre organisation est suspendue.`}
        description={
          motif
            ? t`L’administration de l’installation l’a suspendue : ${motif}. Vos jetons ont été révoqués.`
            : t`L’administration de l’installation l’a suspendue. Vos jetons ont été révoqués.`
        }
      />
    )
  }
  return (
    <Alert
      type="info"
      showIcon
      title={
        etat === 'INTERDITE'
          ? t`Votre hébergeur ne propose pas l’API à votre organisation.`
          : t`L’API de votre organisation n’est pas activée.`
      }
      description={
        etat === 'INTERDITE'
          ? undefined
          : t`Un admin de l’organisation l’active dans l’écran « Organisation ». Vous pourrez alors créer vos jetons ici.`
      }
    />
  )
}

/** Le panneau « Jetons et API » des préférences (ADR 0064). */
export default function PreferenceJetons({
  modesDEmploi,
}: {
  modesDEmploi: string
}) {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const { activites } = useActivite()
  const { data: session } = useQuery(MOI)
  const { data: api } = useQuery(API_ORGANISATION)
  const etat = api?.apiOrganisation.etat
  const ouverte = apiOuverte(etat)
  const { data, refetch } = useQuery(MES_JETONS, { skip: !ouverte })
  const [creer, creation] = useMutation(CREER)
  const [revoquer] = useMutation(REVOQUER)
  const [revoquerTous, revocation] = useMutation(REVOQUER_TOUS)
  // Le jeton créé, affiché une seule fois, et son identifiant dans la liste.
  const [cree, setCree] = useState<{ id: string; jeton: string } | null>(null)
  const [nom, setNom] = useState('')
  const [portee, setPortee] = useState<PorteeJeton>('LECTURE')
  // La gestion des membres se coche à dessein : un jeton fuité ne change pas l'équipe.
  const [gestionMembres, setGestionMembres] = useState(false)
  // Seule une personne qui gère des membres a un usage de cette dimension.
  const gereDesMembres =
    session?.moi?.estAdmin === true || activites.some(a => a.estAdministree)
  const [toutes, setToutes] = useState(true)
  const [choisies, setChoisies] = useState<string[]>([])
  const [duree, setDuree] = useState<number>(365)
  // L'entrée « Jetons et API » du menu du compte mène ici par l'ancre #jetons.
  const { hash } = useLocation()
  const ancre = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (hash === '#jetons') ancre.current?.scrollIntoView({ block: 'start' })
  }, [hash])

  const ouvertes = activites.filter(a => !a.archive)
  const nomsActivites = new Map(activites.map(a => [a.id, a.nom]))
  // L'instant de l'affichage : un jeton expire à l'heure près, la page se relit.
  const [maintenant] = useState(() => Date.now())
  const jetons = data?.mesJetonsAcces ?? []
  const actif = (j: (typeof jetons)[number]) =>
    j.revoqueLe === null && new Date(j.expireLe).getTime() > maintenant
  const actifs = jetons.filter(actif).length
  const plafond = actifs >= JETONS_ACTIFS_MAX

  const creerJeton = async () => {
    try {
      const r = await creer({
        variables: {
          nom,
          portee,
          activiteIds: toutes ? null : choisies,
          expireLe: new Date(
            Date.now() + duree * 86_400_000 - 60_000
          ).toISOString(),
          gestionMembres: portee === 'LECTURE_ECRITURE' && gestionMembres,
        },
      })
      const resultat = r.data?.creerJetonAcces
      setCree(
        resultat ? { id: resultat.jetonAcces.id, jeton: resultat.jeton } : null
      )
      setNom('')
      await refetch()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const revoquerJeton = (id: string, libelle: string) =>
    void modal.confirm({
      title: t`Révoquer le jeton « ${libelle} » ?`,
      content: t`Le jeton cesse aussitôt de servir. Le programme qui l’utilise perd son accès.`,
      okText: t`Révoquer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await revoquer({ variables: { id } })
          // Le jeton affiché à sa création ne sert plus à rien une fois révoqué.
          // La révocation d'un autre jeton le laisse affiché.
          setCree(actuel => (actuel?.id === id ? null : actuel))
          await refetch()
          message.success(t`Jeton révoqué.`)
        } catch (e) {
          message.error(messageErreur(e))
          throw e
        }
      },
    })

  const revoquerTout = () =>
    void modal.confirm({
      title: t`Révoquer tous vos jetons ?`,
      content: t`Vos ${actifs} jetons actifs dans cette organisation cessent aussitôt de servir. Les programmes qui les utilisent perdent leur accès.`,
      okText: t`Tout révoquer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await revoquerTous()
          setCree(null)
          await refetch()
          message.success(t`Tous vos jetons sont révoqués.`)
        } catch (e) {
          message.error(messageErreur(e))
          throw e
        }
      },
    })

  return (
    <div id="jetons" ref={ancre}>
      <Panneau titre={t`Jetons et API`}>
        <p className="rt-texte-secondaire">
          <Trans>
            Un jeton d’accès permet à un programme de travailler dans cette
            organisation en votre nom, sans passer par l’espace organisateur :
            un script, une ligne de commande ou un outil de gestion de projet.
            Le programme a vos droits, jamais plus.
          </Trans>
        </p>
        {api !== undefined && !ouverte && etat !== undefined && (
          <ApiFermee etat={etat} motif={api.apiOrganisation.suspensionMotif} />
        )}
        {ouverte && (
          <>
            <Input
              aria-label={t`Nom du jeton`}
              placeholder={t`Nom du jeton, par exemple « script d’import »`}
              maxLength={80}
              value={nom}
              onChange={e => setNom(e.target.value)}
            />
            <Radio.Group
              value={portee}
              onChange={e => setPortee(e.target.value as PorteeJeton)}
              options={[
                { value: 'LECTURE', label: t`Lecture seule` },
                { value: 'LECTURE_ECRITURE', label: t`Lecture et écriture` },
              ]}
            />
            <Radio.Group
              value={toutes ? 'toutes' : 'choix'}
              onChange={e => setToutes(e.target.value === 'toutes')}
              options={[
                { value: 'toutes', label: t`Toutes mes activités` },
                { value: 'choix', label: t`Seulement ces activités` },
              ]}
            />
            {!toutes && (
              <Select
                mode="multiple"
                aria-label={t`Activités du jeton`}
                placeholder={t`Choisir des activités`}
                optionFilterProp="label"
                value={choisies}
                onChange={setChoisies}
                options={ouvertes.map(a => ({ value: a.id, label: a.nom }))}
              />
            )}
            {gereDesMembres && portee === 'LECTURE_ECRITURE' && (
              <Checkbox
                checked={gestionMembres}
                onChange={e => setGestionMembres(e.target.checked)}
              >
                <Trans>
                  Ce jeton peut inviter, retirer et promouvoir des membres
                </Trans>
                <span className="rt-note rt-note-ligne">
                  <Trans>
                    Décoché, le jeton garde vos autres droits, mais l’équipe ne
                    change pas par son intermédiaire.
                  </Trans>
                </span>
              </Checkbox>
            )}
            <Select
              aria-label={t`Durée du jeton`}
              value={duree}
              onChange={setDuree}
              style={{ maxWidth: 260 }}
              options={DUREES.map(jours => ({
                value: jours,
                label:
                  jours === 365
                    ? t`Valable un an`
                    : jours === 180
                      ? t`Valable six mois`
                      : t`Valable ${jours} jours`,
              }))}
            />
            <Button
              type="primary"
              icon={<KeyOutlined />}
              loading={creation.loading}
              disabled={
                plafond ||
                nom.trim() === '' ||
                (!toutes && choisies.length === 0)
              }
              onClick={() => void creerJeton()}
              style={{ alignSelf: 'flex-start' }}
            >
              <Trans>Créer le jeton</Trans>
            </Button>
            <p className="rt-note">
              {plafond
                ? t`Vous avez ${JETONS_ACTIFS_MAX} jetons actifs, le maximum : révoquez-en un avant d’en créer un autre.`
                : t`Jetons actifs : ${actifs} sur ${JETONS_ACTIFS_MAX}.`}{' '}
              <Trans>
                Chaque création vous est signalée par mail, avec un lien pour
                révoquer le jeton.
              </Trans>
            </p>
            {cree && <JetonUnique jeton={cree.jeton} />}
            {actifs > 1 && (
              <Button
                danger
                loading={revocation.loading}
                onClick={revoquerTout}
                style={{ alignSelf: 'flex-start' }}
              >
                <Trans>Révoquer tous mes jetons</Trans>
              </Button>
            )}
            {jetons.length > 0 && (
              <ul className="rt-jetons">
                {jetons.map(j => {
                  const fin = jourDeLInstant(j.expireLe)
                  const dernier = j.dernierAccesLe
                    ? jourDeLInstant(j.dernierAccesLe)
                    : null
                  const perimetre =
                    j.activiteIds === null || j.activiteIds === undefined
                      ? t`Toutes mes activités`
                      : j.activiteIds
                          .map(id => nomsActivites.get(id) ?? '?')
                          .join(', ')
                  return (
                    <li key={j.id} className="rt-jeton">
                      <span className="rt-jeton-texte">
                        <span className="rt-choix-titre">
                          {j.nom}{' '}
                          <span className="rt-mono rt-jeton-apercu">
                            rt_{j.apercu}…
                          </span>
                        </span>
                        <span className="rt-choix-detail">
                          {j.portee === 'LECTURE'
                            ? t`Lecture seule`
                            : t`Lecture et écriture`}{' '}
                          · {perimetre}
                          {j.gestionMembres && (
                            <>
                              {' · '}
                              <Trans>Gestion des membres</Trans>
                            </>
                          )}
                        </span>
                        <span className="rt-note">
                          {actif(j)
                            ? t`Valable jusqu’au ${fin}.`
                            : j.revoqueLe
                              ? t`Révoqué.`
                              : t`Expiré le ${fin}.`}{' '}
                          {dernier
                            ? t`Dernier usage le ${dernier}.`
                            : t`Jamais utilisé.`}
                        </span>
                      </span>
                      {actif(j) ? (
                        <Button
                          size="small"
                          danger
                          onClick={() => revoquerJeton(j.id, j.nom)}
                        >
                          <Trans>Révoquer</Trans>
                        </Button>
                      ) : (
                        <Tag>{j.revoqueLe ? t`Révoqué` : t`Expiré`}</Tag>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
        <p className="rt-note">
          <Trans>
            Un programme envoie le jeton dans l’en-tête « Authorization: Bearer
            ». Créez un jeton par programme, avec la durée la plus courte
            possible.
          </Trans>{' '}
          <a href={modesDEmploi} target="_blank" rel="noopener noreferrer">
            <Trans>Consulter les modes d’emploi</Trans>
          </a>
        </p>
      </Panneau>
    </div>
  )
}
