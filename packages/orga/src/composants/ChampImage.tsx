import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { useLingui } from '@lingui/react/macro'
import { App, Button, Space } from 'antd'
import { useRef } from 'react'

import type { FormatMedia } from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'
import { urlImage, useTeleverserImage } from '../lib/medias'

/**
 * Champ de formulaire pour une image d'identité. La valeur est l'empreinte de
 * l'image enregistrée, ou null. L'aperçu se lit à l'adresse publique de l'image.
 */
export default function ChampImage({
  value,
  onChange,
  format,
  libelle,
}: {
  value?: string | null
  onChange?: (valeur: string | null) => void
  format: FormatMedia
  libelle: string
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const [televerser, enCours] = useTeleverserImage()
  const selecteur = useRef<HTMLInputElement>(null)
  const extension = format === 'PNG' ? 'png' : 'svg'
  const apercu = urlImage(value, extension)

  const choisir = async (fichier: File | undefined) => {
    if (fichier === undefined) return
    try {
      const image = await televerser(fichier, format)
      onChange?.(image.empreinte)
    } catch (e) {
      void message.error(messageErreur(e))
    } finally {
      if (selecteur.current) selecteur.current.value = ''
    }
  }

  return (
    <Space align="center" wrap>
      <span
        className="rt-verre"
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          width: 64,
          height: 64,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {apercu ? (
          <img
            src={apercu}
            alt={libelle}
            style={{ maxWidth: 56, maxHeight: 56 }}
          />
        ) : (
          <span className="rt-texte-secondaire" style={{ fontSize: 12 }}>
            {t({
              message: 'Aucune',
              comment: 'Aperçu d’une image : aucune image enregistrée',
            })}
          </span>
        )}
      </span>
      <input
        ref={selecteur}
        type="file"
        accept={format === 'PNG' ? 'image/png' : 'image/svg+xml'}
        aria-label={libelle}
        style={{ display: 'none' }}
        onChange={e => void choisir(e.target.files?.[0])}
      />
      <Button
        icon={<UploadOutlined />}
        loading={enCours}
        onClick={() => selecteur.current?.click()}
      >
        {apercu ? t`Remplacer` : t`Choisir un fichier ${format}`}
      </Button>
      {apercu && (
        <Button
          icon={<DeleteOutlined />}
          aria-label={t`Retirer : ${libelle}`}
          onClick={() => onChange?.(null)}
        />
      )}
    </Space>
  )
}
