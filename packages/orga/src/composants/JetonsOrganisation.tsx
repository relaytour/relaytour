import { KeyOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Tag } from 'antd'
import { useState } from 'react'

import { graphql } from '../gql'
import type { JetonsAccesOrganisationQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'

// Les jetons d'accès de toute l'organisation (ADR 0064), pour ses admins : ceux des
// membres et des robots, sans leur valeur. Un admin révoque un jeton qui ne sert plus
// ou qui a fuité ; la personne l'apprend par mail.

const JETONS_ORGANISATION = graphql(`
  query JetonsAccesOrganisation {
    jetonsAccesOrganisation {
      jeton {
        id
        nom
        apercu
        portee
        gestionMembres
        activiteIds
        expireLe
        dernierAccesLe
        revoqueLe
      }
      porteur {
        id
        nom
        robot
      }
      revoquePar
    }
  }
`)

const REVOQUER = graphql(`
  mutation RevoquerJetonOrganisation($id: ID!) {
    revoquerJetonOrganisation(id: $id)
  }
`)

type Ligne = JetonsAccesOrganisationQuery['jetonsAccesOrganisation'][number]

export default function JetonsOrganisation() {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const { activites } = useActivite()
  const { data, refetch } = useQuery(JETONS_ORGANISATION)
  const [revoquer] = useMutation(REVOQUER)
  // L'instant de l'affichage : un jeton expire à l'heure près, la page se relit.
  const [maintenant] = useState(() => Date.now())
  const lignes = data?.jetonsAccesOrganisation ?? []
  const nomsActivites = new Map(activites.map(a => [a.id, a.nom]))
  const actif = (l: Ligne) =>
    l.jeton.revoqueLe === null &&
    new Date(l.jeton.expireLe).getTime() > maintenant

  const revoquerJeton = (l: Ligne) => {
    const porteur = l.porteur.nom
    const libelle = l.jeton.nom
    void modal.confirm({
      title: t`Révoquer le jeton « ${libelle} » de ${porteur} ?`,
      content: l.porteur.robot
        ? t`Le jeton cesse aussitôt de servir. Le programme qui l’utilise perd son accès.`
        : t`Le jeton cesse aussitôt de servir, et ${porteur} en est prévenu par mail.`,
      okText: t`Révoquer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await revoquer({ variables: { id: l.jeton.id } })
          await refetch()
          message.success(t`Jeton révoqué.`)
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
        <KeyOutlined /> <Trans>Jetons de l’organisation</Trans>
      </span>
      <p className="rt-texte-secondaire" style={{ margin: 0 }}>
        <Trans>
          Les jetons d’accès de tous les membres et des robots, sans leur valeur
          : les jetons actifs, puis ceux révoqués ou expirés depuis moins de
          trente jours. Révoquez un jeton qui ne sert plus ou qui a fuité : la
          personne en est prévenue par mail.
        </Trans>
      </p>
      {data !== undefined && lignes.length === 0 && (
        <p className="rt-note">
          <Trans>Aucun jeton d’accès n’a été créé dans l’organisation.</Trans>
        </p>
      )}
      {lignes.length > 0 && (
        <ul className="rt-jetons">
          {lignes.map(l => {
            const j = l.jeton
            const fin = jourDeLInstant(j.expireLe)
            const dernier = j.dernierAccesLe
              ? jourDeLInstant(j.dernierAccesLe)
              : null
            const par = l.revoquePar ?? ''
            const perimetre =
              j.activiteIds === null || j.activiteIds === undefined
                ? t`Toutes ses activités`
                : j.activiteIds
                    .map(id => nomsActivites.get(id) ?? '?')
                    .join(', ')
            return (
              <li key={j.id} className="rt-jeton">
                <span className="rt-jeton-texte">
                  <span className="rt-choix-titre">
                    {l.porteur.nom}{' '}
                    {l.porteur.robot && (
                      <Tag icon={<RobotOutlined />}>
                        <Trans>robot</Trans>
                      </Tag>
                    )}
                    · {j.nom}{' '}
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
                    {actif(l)
                      ? t`Valable jusqu’au ${fin}.`
                      : j.revoqueLe
                        ? par !== ''
                          ? t`Révoqué par ${par}.`
                          : t`Révoqué.`
                        : t`Expiré le ${fin}.`}{' '}
                    {dernier
                      ? t`Dernier usage le ${dernier}.`
                      : t`Jamais utilisé.`}
                  </span>
                </span>
                {actif(l) ? (
                  <Button size="small" danger onClick={() => revoquerJeton(l)}>
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
    </div>
  )
}
