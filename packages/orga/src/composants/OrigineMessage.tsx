import { AppstoreOutlined, CodeOutlined } from '@ant-design/icons'
import { useLingui } from '@lingui/react/macro'
import { Tag, Typography } from 'antd'

import type { MessagesQuery } from '../gql/graphql'

// L'origine d'un message préparé par un programme (ADR 0071). La mention s'affiche
// sous l'auteur, hors de l'objet et du corps : le texte copié vers la messagerie
// reste celui que le programme a préparé.

type Origine = NonNullable<MessagesQuery['messages'][number]['origine']>

export default function OrigineMessage({
  origine,
}: {
  origine: Origine | null | undefined
}) {
  const { t } = useLingui()
  if (origine === null || origine === undefined) return null
  const nom = origine.nom
  const hote = origine.hote
  const texte =
    origine.sorte === 'JETON_ACCES'
      ? t`Préparé par un programme : ${nom}`
      : hote
        ? t`Préparé par une application : ${nom} (${hote})`
        : t`Préparé par une application : ${nom}`
  return (
    <Typography.Text type="secondary">
      {origine.sorte === 'JETON_ACCES' ? (
        <CodeOutlined aria-hidden />
      ) : (
        <AppstoreOutlined aria-hidden />
      )}{' '}
      {texte}
      {origine.nonVerifiee && (
        <>
          {' '}
          <Tag color="warning">{t`non vérifiée`}</Tag>
        </>
      )}
    </Typography.Text>
  )
}
