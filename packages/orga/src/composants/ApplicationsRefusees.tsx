import { StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Input, Space } from 'antd'
import { useState } from 'react'

import { graphql } from '../gql'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'

// Applications tierces refusées par les admins de l'organisation (ADR 0067). Un
// refus révoque les autorisations de l'application dans l'organisation, prévient
// leurs porteuses par mail et bloque les nouvelles demandes.

const REFUSEES = graphql(`
  query ApplicationsRefuseesOrganisation {
    applicationsRefuseesOrganisation {
      clientId
      nom
      hote
      refuseeLe
      refuseePar
    }
  }
`)

const REFUSER = graphql(`
  mutation RefuserApplicationOrganisation($clientId: String!) {
    refuserApplicationOrganisation(clientId: $clientId)
  }
`)

const LEVER = graphql(`
  mutation AutoriserApplicationOrganisation($clientId: String!) {
    autoriserApplicationOrganisation(clientId: $clientId)
  }
`)

export default function ApplicationsRefusees() {
  const { t } = useLingui()
  const { message, modal } = App.useApp()
  const { data, refetch } = useQuery(REFUSEES)
  const [refuser, refus] = useMutation(REFUSER)
  const [lever] = useMutation(LEVER)
  const [saisie, setSaisie] = useState('')
  const refusees = data?.applicationsRefuseesOrganisation ?? []

  const refuserApplication = () => {
    const clientId = saisie.trim()
    void modal.confirm({
      title: t`Refuser cette application dans l’organisation ?`,
      content: t`Ses autorisations sont révoquées, et les personnes concernées en sont prévenues par mail. Elle ne peut plus demander d’accès.`,
      okText: t`Refuser l’application`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          const r = await refuser({ variables: { clientId } })
          const nombre = r.data?.refuserApplicationOrganisation ?? 0
          setSaisie('')
          await refetch()
          message.success(
            t`Application refusée. Autorisations révoquées : ${nombre}.`
          )
        } catch (e) {
          message.error(messageErreur(e))
          throw e
        }
      },
    })
  }

  const leverRefus = async (clientId: string) => {
    try {
      await lever({ variables: { clientId } })
      await refetch()
      message.success(t`Le refus est levé.`)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <div className="rt-robots">
      <span className="rt-choix-titre">
        <StopOutlined /> <Trans>Applications refusées</Trans>
      </span>
      <p className="rt-texte-secondaire" style={{ margin: 0 }}>
        <Trans>
          Une application refusée perd ses autorisations dans l’organisation et
          ne peut plus en demander. Indiquez son identifiant, tel que la liste
          des jetons ou le mail d’autorisation le montrent.
        </Trans>
      </p>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          aria-label={t`Identifiant de l’application`}
          placeholder={t`https://exemple.org/client.json`}
          maxLength={512}
          value={saisie}
          onChange={e => setSaisie(e.target.value)}
        />
        <Button
          danger
          loading={refus.loading}
          disabled={saisie.trim() === ''}
          onClick={refuserApplication}
        >
          <Trans>Refuser</Trans>
        </Button>
      </Space.Compact>
      {refusees.length > 0 && (
        <ul className="rt-jetons">
          {refusees.map(a => {
            const le = jourDeLInstant(a.refuseeLe)
            const par = a.refuseePar ?? ''
            return (
              <li key={a.clientId} className="rt-jeton">
                <span className="rt-jeton-texte">
                  <span className="rt-choix-titre">{a.nom ?? a.hote}</span>
                  <span className="rt-choix-detail rt-mono">{a.clientId}</span>
                  <span className="rt-note">
                    {par !== ''
                      ? t`Refusée le ${le} par ${par}.`
                      : t`Refusée le ${le}.`}
                  </span>
                </span>
                <Button
                  size="small"
                  onClick={() => void leverRefus(a.clientId)}
                >
                  <Trans>Lever le refus</Trans>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
