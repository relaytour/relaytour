import { CopyOutlined } from '@ant-design/icons'
import { App, Button, Segmented, Space } from 'antd'
import { useState, type ReactNode } from 'react'

import {
  SEPARATEURS,
  separateurPropose,
  type CleMessagerie,
  type Separateur,
} from '../lib/messagerie'
import { adressesACopier, type Adresses } from '../lib/messages'

// Boutons de copie des adresses d'un message (ADR 0020), avec le choix du signe
// qui les sépare (ADR 0022). Outlook attend un point-virgule, les autres
// messageries une virgule : la cible propose le signe, et l'admin le change ici.

interface Props {
  adresses: Adresses
  /** Vrai pour un message à une seule personne : le champ « À » se copie aussi. */
  seul: boolean
  /** La messagerie qui reçoit le message : elle fixe le séparateur proposé. */
  cible: CleMessagerie
  /** Les autres boutons de copie, placés à la suite : objet, texte. */
  children?: ReactNode
}

export default function CopierAdresses({
  adresses,
  seul,
  cible,
  children,
}: Props) {
  const { message } = App.useApp()
  // Null : le séparateur suit la cible. Un choix de l'admin le fige.
  const [choisi, setChoisi] = useState<Separateur | null>(null)
  const separateur = choisi ?? separateurPropose(cible)
  const plusieurs = [adresses.a, adresses.cc, adresses.cci].some(
    liste => liste.length > 1
  )

  const copier = async (liste: string[]) => {
    try {
      await navigator.clipboard.writeText(adressesACopier(liste, separateur))
      message.success(
        liste.length === 1
          ? 'L’adresse est copiée.'
          : `Les ${liste.length} adresses sont copiées.`
      )
    } catch {
      message.error(
        'La copie a échoué. Sélectionnez le texte, puis copiez-le vous-même.'
      )
    }
  }

  return (
    <Space orientation="vertical" size={8}>
      <Space wrap>
        {(
          [
            ['a', seul ? 'Copier l’adresse' : null],
            ['cc', 'Copier les adresses en Cc'],
            ['cci', 'Copier les adresses en Cci'],
          ] as const
        ).map(
          ([cle, libelle]) =>
            libelle !== null &&
            adresses[cle].length > 0 && (
              <Button
                key={cle}
                icon={<CopyOutlined />}
                onClick={() => void copier(adresses[cle])}
              >
                {libelle}
              </Button>
            )
        )}
        {children}
      </Space>
      {plusieurs && (
        <div className="rt-separateur-adresses">
          <Space wrap size={8}>
            <span id="rt-separateur-adresses">Séparateur des adresses</span>
            <Segmented<Separateur>
              aria-labelledby="rt-separateur-adresses"
              size="small"
              value={separateur}
              onChange={setChoisi}
              options={(Object.keys(SEPARATEURS) as Separateur[]).map(s => ({
                value: s,
                label: `${SEPARATEURS[s]} (${s})`,
              }))}
            />
          </Space>
          <p className="rt-note">
            Outlook attend un point-virgule entre deux adresses collées. Les
            autres messageries acceptent une virgule. Vos préférences fixent le
            séparateur proposé pour la messagerie par défaut.
          </p>
        </div>
      )}
    </Space>
  )
}
