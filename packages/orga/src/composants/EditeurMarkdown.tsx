import {
  BoldOutlined,
  CheckSquareOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  QuestionCircleOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Button, Input, Tooltip } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import type { KeyboardEvent, ReactNode } from 'react'
import { useRef } from 'react'

import {
  appliquer,
  mettreEnForme,
  type Format,
  type Remplacement,
} from '../lib/mise-en-forme'

interface Outil {
  format: Format
  libelle: string
  icone: ReactNode
  raccourci?: string
}

// Le raccourci s'affiche avec la touche de commande du système.
const MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)
const COMMANDE = MAC ? '⌘' : 'Ctrl+'

const GROUPES: Outil[][] = [
  [
    {
      format: 'gras',
      libelle: 'Gras',
      icone: <BoldOutlined />,
      raccourci: 'B',
    },
    {
      format: 'italique',
      libelle: 'Italique',
      icone: <ItalicOutlined />,
      raccourci: 'I',
    },
  ],
  [
    { format: 'titre2', libelle: 'Titre de section', icone: 'Titre' },
    { format: 'titre3', libelle: 'Sous-titre', icone: 'Sous-titre' },
  ],
  [
    {
      format: 'puces',
      libelle: 'Liste à puces',
      icone: <UnorderedListOutlined />,
    },
    {
      format: 'numeros',
      libelle: 'Liste numérotée',
      icone: <OrderedListOutlined />,
    },
    {
      format: 'cases',
      libelle: 'Liste de cases à cocher',
      icone: <CheckSquareOutlined />,
    },
  ],
  [
    {
      format: 'lien',
      libelle: 'Lien',
      icone: <LinkOutlined />,
      raccourci: 'K',
    },
    { format: 'tableau', libelle: 'Tableau', icone: <TableOutlined /> },
  ],
]

const RACCOURCIS: Record<string, Format> = {
  b: 'gras',
  i: 'italique',
  k: 'lien',
}

/**
 * Zone de saisie Markdown avec sa barre de mise en forme. Un bouton agit sur la
 * sélection : il ajoute la marque, ou la retire quand elle est déjà posée. Le
 * texte change par une insertion du navigateur, ce qui garde l'annulation
 * (⌘Z ou Ctrl+Z).
 */
export default function EditeurMarkdown({
  valeur,
  onChange,
  onAide,
  libelle,
}: {
  valeur: string
  onChange: (valeur: string) => void
  /** Ouvre le guide de la syntaxe. */
  onAide: () => void
  libelle: string
}) {
  const ref = useRef<TextAreaRef>(null)

  const formater = (format: Format) => {
    const zone = ref.current?.resizableTextArea?.textArea
    if (!zone) return
    const r = mettreEnForme(format, {
      texte: zone.value,
      debut: zone.selectionStart,
      fin: zone.selectionEnd,
    })
    remplacer(zone, r, onChange)
  }

  const surTouche = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
    const format = RACCOURCIS[e.key.toLowerCase()]
    if (format === undefined) return
    e.preventDefault()
    formater(format)
  }

  return (
    <div className="rt-editeur-markdown">
      <div
        className="rt-barre-markdown"
        role="toolbar"
        aria-label="Mise en forme"
      >
        {/* Sur téléphone, ce conteneur défile et estompe son bord droit, sous le
            fond de la barre. */}
        <div className="rt-barre-markdown-outils">
          {GROUPES.map((groupe, i) => (
            <div key={i} className="rt-barre-markdown-groupe">
              {groupe.map(outil => {
                const titre = outil.raccourci
                  ? `${outil.libelle} (${COMMANDE}${outil.raccourci})`
                  : outil.libelle
                return (
                  <Tooltip key={outil.format} title={titre}>
                    <Button
                      type="text"
                      size="small"
                      aria-label={outil.libelle}
                      // La zone garde le focus et sa sélection pendant le clic.
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => formater(outil.format)}
                      icon={
                        typeof outil.icone === 'string'
                          ? undefined
                          : outil.icone
                      }
                    >
                      {typeof outil.icone === 'string' ? outil.icone : null}
                    </Button>
                  </Tooltip>
                )
              })}
            </div>
          ))}
          <Tooltip title="Guide de la syntaxe Markdown">
            <Button
              type="link"
              size="small"
              className="rt-barre-markdown-aide"
              icon={<QuestionCircleOutlined />}
              onClick={onAide}
            >
              Aide
            </Button>
          </Tooltip>
        </div>
      </div>
      <Input.TextArea
        ref={ref}
        value={valeur}
        onChange={e => onChange(e.target.value)}
        onKeyDown={surTouche}
        autoSize={{ minRows: 18 }}
        className="rt-zone-markdown"
        aria-label={libelle}
      />
    </div>
  )
}

/**
 * Remplace le passage dans la zone par une insertion du navigateur : l'événement
 * `input` met l'état à jour et l'annulation reste possible. Un navigateur qui
 * refuse l'insertion reçoit le texte complet, sans historique.
 */
function remplacer(
  zone: HTMLTextAreaElement,
  r: Remplacement,
  onChange: (valeur: string) => void
) {
  const attendu = appliquer(zone.value, r)
  zone.focus()
  zone.setSelectionRange(r.debut, r.fin)
  // execCommand reste la seule insertion qui garde l'historique d'annulation.
  const insere =
    r.insertion === ''
      ? r.debut === r.fin || document.execCommand('delete')
      : document.execCommand('insertText', false, r.insertion)
  if (!insere || zone.value !== attendu) {
    onChange(attendu)
    // L'état mis à jour réécrit la zone : la sélection se pose ensuite.
    requestAnimationFrame(() => {
      zone.focus()
      zone.setSelectionRange(...r.selection)
    })
    return
  }
  zone.setSelectionRange(...r.selection)
}
