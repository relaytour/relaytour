import { useQuery } from '@apollo/client/react'
import { Trans } from '@lingui/react/macro'
import { Button } from 'antd'

import { graphql } from '../gql'

// Un admin reprend sa propre adresse comme contact, par une action explicite
// (ADR 0053). Le bouton n'apparaît que si son adresse est déjà une adresse de
// rôle de l'organisation : Relaytour ne prend jamais une adresse personnelle.

const MON_ADRESSE = graphql(`
  query MonAdresseDeRole {
    moi {
      id
      email
      adresseDeRole
    }
  }
`)

export default function ReprendreMonAdresse({
  onReprendre,
}: {
  onReprendre: (adresse: string) => void
}) {
  const { data } = useQuery(MON_ADRESSE)
  const moi = data?.moi
  if (!moi?.adresseDeRole) return null
  const adresse = moi.email
  return (
    <Button
      type="link"
      size="small"
      style={{ padding: 0 }}
      onClick={() => onReprendre(adresse)}
    >
      <Trans>Reprendre mon adresse ({adresse})</Trans>
    </Button>
  )
}
