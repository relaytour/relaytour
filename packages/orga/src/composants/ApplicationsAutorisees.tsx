import { AppstoreOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Tag } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'

import { Panneau } from './Panneau'

// Applications tierces que la personne a autorisées dans l'organisation (ADR 0067).
// Chaque autorisation se révoque seule, sans toucher aux autres ni aux jetons
// d'accès. Le mail d'autorisation et le rappel de fin mènent ici par #applications.

const MES_AUTORISATIONS = graphql(`
  query MesAutorisationsApplications {
    mesAutorisationsApplications {
      id
      portee
      activiteIds
      expireLe
      dernierAccesLe
      revoqueLe
      creeLe
      application {
        nom
        hote
        verifiee
      }
    }
  }
`)

const REVOQUER = graphql(`
  mutation RevoquerAutorisationApplication($id: ID!) {
    revoquerJetonAcces(id: $id)
  }
`)

export default function ApplicationsAutorisees() {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const { activites } = useActivite()
  const { data, refetch } = useQuery(MES_AUTORISATIONS)
  const [revoquer] = useMutation(REVOQUER)
  const { hash } = useLocation()
  const ancre = useRef<HTMLDivElement>(null)
  // L'instant de l'affichage : une autorisation expire à l'heure près.
  const [maintenant] = useState(() => Date.now())
  const autorisations = data?.mesAutorisationsApplications ?? []
  // Le panneau n'existe qu'une fois la liste lue : le défilement l'attend.
  const affiche = autorisations.length > 0
  useEffect(() => {
    if (hash === '#applications' && affiche)
      ancre.current?.scrollIntoView({ block: 'start' })
  }, [hash, affiche])
  const nomsActivites = new Map(activites.map(a => [a.id, a.nom]))
  const active = (a: (typeof autorisations)[number]) =>
    a.revoqueLe === null && new Date(a.expireLe).getTime() > maintenant

  const revoquerAutorisation = (id: string, nom: string) =>
    void modal.confirm({
      title: t`Révoquer l’accès de « ${nom} » ?`,
      content: t`L’application perd aussitôt son accès à votre compte dans cette organisation.`,
      okText: t`Révoquer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await revoquer({ variables: { id } })
          await refetch()
          message.success(t`Autorisation révoquée.`)
        } catch (e) {
          message.error(messageErreur(e))
          throw e
        }
      },
    })

  // Le panneau n'apparaît qu'avec au moins une autorisation, active ou récente.
  if (autorisations.length === 0) return null
  return (
    <div id="applications" ref={ancre}>
      <Panneau titre={t`Applications autorisées`} icone={<AppstoreOutlined />}>
        <p className="rt-texte-secondaire">
          <Trans>
            Ces applications travaillent dans cette organisation en votre nom,
            avec vos droits. Vous les avez autorisées depuis leur propre écran.
          </Trans>
        </p>
        <ul className="rt-jetons">
          {autorisations.map(a => {
            const fin = jourDeLInstant(a.expireLe)
            const accordee = jourDeLInstant(a.creeLe)
            const dernier = a.dernierAccesLe
              ? jourDeLInstant(a.dernierAccesLe)
              : null
            const nom = a.application?.nom ?? t`Application`
            const perimetre =
              a.activiteIds === null || a.activiteIds === undefined
                ? t`Toutes mes activités`
                : a.activiteIds
                    .map(id => nomsActivites.get(id) ?? '?')
                    .join(', ')
            return (
              <li key={a.id} className="rt-jeton">
                <span className="rt-jeton-texte">
                  <span className="rt-choix-titre">
                    {nom}{' '}
                    {a.application?.hote && <Tag>{a.application.hote}</Tag>}
                    {a.application?.verifiee === false && (
                      <Tag color="warning">{t`Non vérifiée`}</Tag>
                    )}
                  </span>
                  <span className="rt-choix-detail">
                    {a.portee === 'LECTURE'
                      ? t`Lecture seule`
                      : t`Lecture et écriture`}{' '}
                    · {perimetre}
                  </span>
                  <span className="rt-note">
                    {t`Autorisée le ${accordee}.`}{' '}
                    {active(a)
                      ? t`Valable jusqu’au ${fin}.`
                      : a.revoqueLe
                        ? t`Révoquée.`
                        : t`Expirée le ${fin}.`}{' '}
                    {dernier
                      ? t`Dernier usage le ${dernier}.`
                      : t`Jamais utilisée.`}
                  </span>
                </span>
                {active(a) ? (
                  <Button
                    size="small"
                    danger
                    onClick={() => revoquerAutorisation(a.id, nom)}
                  >
                    <Trans>Révoquer</Trans>
                  </Button>
                ) : (
                  <Tag>{a.revoqueLe ? t`Révoquée` : t`Expirée`}</Tag>
                )}
              </li>
            )
          })}
        </ul>
      </Panneau>
    </div>
  )
}
