import { KeyOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Input, Radio, Select, Space, Tag } from 'antd'
import { useState } from 'react'

import { graphql } from '../gql'
import type { PorteeJeton, RobotsQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'

import { JetonUnique } from './PreferenceJetons'

// Robots de l'organisation (ADR 0064) : des membres sans connexion qui portent
// les jetons d'une automatisation partagée. Un admin de l'organisation les crée,
// leur donne des activités, leur crée des jetons et les archive.

const ROBOTS = graphql(`
  query Robots {
    robots {
      id
      nom
      archive
      activites {
        id
        nom
      }
      jetons {
        id
        nom
        apercu
        portee
        expireLe
        dernierAccesLe
        revoqueLe
      }
    }
  }
`)

const CREER_ROBOT = graphql(`
  mutation CreerRobot($nom: String!, $activiteIds: [ID!]!) {
    creerRobot(nom: $nom, activiteIds: $activiteIds) {
      id
    }
  }
`)

const CREER_JETON_ROBOT = graphql(`
  mutation CreerJetonRobot(
    $robotId: ID!
    $nom: String!
    $portee: PorteeJeton!
    $expireLe: DateTime
  ) {
    creerJetonRobot(
      robotId: $robotId
      nom: $nom
      portee: $portee
      expireLe: $expireLe
    ) {
      jeton
      jetonAcces {
        id
      }
    }
  }
`)

const REVOQUER_JETON_ROBOT = graphql(`
  mutation RevoquerJetonRobot($id: ID!) {
    revoquerJetonRobot(id: $id)
  }
`)

const ARCHIVER_ROBOT = graphql(`
  mutation ArchiverRobot($id: ID!, $archive: Boolean!) {
    archiverPersonne(id: $id, archive: $archive) {
      id
      archive
    }
  }
`)

type Robot = RobotsQuery['robots'][number]

/** Le formulaire d'un jeton de robot, et le jeton créé, affiché une fois. */
function JetonDuRobot({
  robot,
  relire,
}: {
  robot: Robot
  relire: () => Promise<unknown>
}) {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const [creer, creation] = useMutation(CREER_JETON_ROBOT)
  const [revoquer] = useMutation(REVOQUER_JETON_ROBOT)
  const [nom, setNom] = useState('')
  const [portee, setPortee] = useState<PorteeJeton>('LECTURE')
  const [cree, setCree] = useState<{ id: string; jeton: string } | null>(null)
  const [maintenant] = useState(() => Date.now())
  const actif = (j: Robot['jetons'][number]) =>
    j.revoqueLe === null && new Date(j.expireLe).getTime() > maintenant

  const creerJeton = async () => {
    try {
      const r = await creer({
        variables: { robotId: robot.id, nom, portee },
      })
      const resultat = r.data?.creerJetonRobot
      if (resultat) {
        setCree({ id: resultat.jetonAcces.id, jeton: resultat.jeton })
      }
      setNom('')
      await relire()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <>
      <Space wrap>
        <Input
          aria-label={t`Nom du jeton du robot`}
          placeholder={t`Nom du jeton, par exemple « synchronisation »`}
          maxLength={80}
          value={nom}
          onChange={e => setNom(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <Radio.Group
          value={portee}
          onChange={e => setPortee(e.target.value as PorteeJeton)}
          options={[
            { value: 'LECTURE', label: t`Lecture seule` },
            { value: 'LECTURE_ECRITURE', label: t`Lecture et écriture` },
          ]}
        />
        <Button
          size="small"
          icon={<KeyOutlined />}
          loading={creation.loading}
          disabled={nom.trim() === ''}
          onClick={() => void creerJeton()}
        >
          <Trans>Créer un jeton</Trans>
        </Button>
      </Space>
      {cree && <JetonUnique jeton={cree.jeton} />}
      {robot.jetons.length > 0 && (
        <ul className="rt-jetons">
          {robot.jetons.map(j => {
            const fin = jourDeLInstant(j.expireLe)
            const dernier = j.dernierAccesLe
              ? jourDeLInstant(j.dernierAccesLe)
              : null
            return (
              <li key={j.id} className="rt-jeton">
                <span className="rt-jeton-texte">
                  <span className="rt-choix-titre">
                    {j.nom}{' '}
                    <span className="rt-mono rt-jeton-apercu">
                      rt_{j.apercu}…
                    </span>
                  </span>
                  <span className="rt-note">
                    {j.portee === 'LECTURE'
                      ? t`Lecture seule`
                      : t`Lecture et écriture`}
                    {' · '}
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
                    onClick={() =>
                      void modal.confirm({
                        title: t`Révoquer ce jeton du robot ?`,
                        content: t`Le jeton cesse aussitôt de servir.`,
                        okText: t`Révoquer`,
                        okButtonProps: { danger: true },
                        cancelText: t`Annuler`,
                        onOk: async () => {
                          try {
                            await revoquer({ variables: { id: j.id } })
                            setCree(c => (c?.id === j.id ? null : c))
                            await relire()
                          } catch (e) {
                            message.error(messageErreur(e))
                            throw e
                          }
                        },
                      })
                    }
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
  )
}

/** Les robots de l'organisation, sous le module « API » de l'écran « Organisation ». */
export default function RobotsApi() {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const { activites } = useActivite()
  const { data, refetch } = useQuery(ROBOTS)
  const [creer, creation] = useMutation(CREER_ROBOT)
  const [archiver] = useMutation(ARCHIVER_ROBOT)
  const [nom, setNom] = useState('')
  const [choisies, setChoisies] = useState<string[]>([])
  const robots = data?.robots ?? []

  const creerRobot = async () => {
    try {
      await creer({ variables: { nom, activiteIds: choisies } })
      setNom('')
      setChoisies([])
      await refetch()
      message.success(t`Robot créé.`)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const basculer = (robot: Robot) => {
    const nomRobot = robot.nom
    void modal.confirm({
      title: robot.archive
        ? t`Rétablir le robot « ${nomRobot} » ?`
        : t`Archiver le robot « ${nomRobot} » ?`,
      content: robot.archive
        ? t`Le robot reprend une place de membre. Ses anciens jetons restent révoqués.`
        : t`Ses jetons sont révoqués aussitôt, et sa place de membre se libère.`,
      okText: robot.archive ? t`Rétablir` : t`Archiver`,
      okButtonProps: robot.archive ? {} : { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await archiver({
            variables: { id: robot.id, archive: !robot.archive },
          })
          await refetch()
        } catch (e) {
          message.error(messageErreur(e))
          throw e
        }
      },
    })
  }

  return (
    <div className="rt-robots">
      <span className="rt-choix-titre">
        <RobotOutlined /> <Trans>Robots</Trans>
      </span>
      <p className="rt-texte-secondaire" style={{ margin: 0 }}>
        <Trans>
          Un robot porte les jetons d’une automatisation partagée, comme une
          synchronisation avec un outil de gestion de projet. Il n’a pas
          d’adresse, ne se connecte jamais et ne reçoit aucun mail. Il reçoit
          ses droits comme une personne : activités, affectations, rôle d’admin
          d’une activité. Il prend une place de membre.
        </Trans>
      </p>
      <Space wrap>
        <Input
          aria-label={t`Nom du robot`}
          placeholder={t`Nom du robot, par exemple « Synchronisation »`}
          maxLength={120}
          value={nom}
          onChange={e => setNom(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <Select
          mode="multiple"
          aria-label={t`Activités du robot`}
          placeholder={t`Ses activités`}
          optionFilterProp="label"
          value={choisies}
          onChange={setChoisies}
          style={{ minWidth: 220 }}
          options={activites
            .filter(a => !a.archive)
            .map(a => ({ value: a.id, label: a.nom }))}
        />
        <Button
          icon={<RobotOutlined />}
          loading={creation.loading}
          disabled={nom.trim() === '' || choisies.length === 0}
          onClick={() => void creerRobot()}
        >
          <Trans>Créer le robot</Trans>
        </Button>
      </Space>
      {robots.map(robot => (
        <div key={robot.id} className="rt-robot">
          <div className="rt-robot-entete">
            <span className="rt-choix-titre">
              {robot.nom}{' '}
              {robot.archive && (
                <Tag>
                  <Trans>archivé</Trans>
                </Tag>
              )}
            </span>
            <Button size="small" onClick={() => basculer(robot)}>
              {robot.archive ? t`Rétablir` : t`Archiver`}
            </Button>
          </div>
          <span className="rt-note">
            {robot.activites.length > 0
              ? robot.activites.map(a => a.nom).join(', ')
              : t`Aucune activité.`}
          </span>
          {!robot.archive && (
            <JetonDuRobot robot={robot} relire={() => refetch()} />
          )}
        </div>
      ))}
      <p className="rt-note" style={{ margin: 0 }}>
        <Trans>
          Les affectations et le rôle d’admin d’une activité se donnent depuis
          l’écran « Équipe » de chaque activité, comme pour une personne.
        </Trans>
      </p>
    </div>
  )
}
