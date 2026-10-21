import {
  BoldOutlined,
  CheckSquareOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  QuestionCircleOutlined,
  TeamOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Button, Input, Skeleton, Tooltip } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import type { KeyboardEvent, ReactNode } from 'react'
import { lazy, Suspense, useRef, useState } from 'react'

import {
  appliquer,
  mettreEnForme,
  type Format,
  type Remplacement,
} from '../lib/mise-en-forme'
import { mentionEnCours, suggestions } from '../lib/concerne'
import type { Mentions } from '../lib/mentions'
import type { PoigneeVisuel } from './EditeurVisuel'

// Milkdown ne se charge qu'à l'ouverture de l'éditeur visuel.
const EditeurVisuel = lazy(() => import('./EditeurVisuel'))

/** Visuel : la personne écrit dans le rendu. Markdown : elle écrit le texte source. */
export type ModeEditeur = 'visuel' | 'markdown'

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
 * Éditeur d'une fiche avec sa barre de mise en forme. En mode visuel, la personne
 * écrit dans le rendu. En mode Markdown, un bouton agit sur la sélection du texte
 * source : il ajoute la marque, ou la retire quand elle est déjà posée. Dans les
 * deux modes, ⌘Z ou Ctrl+Z annule une mise en forme.
 */
export default function EditeurMarkdown({
  valeur,
  onChange,
  onAide,
  libelle,
  mode,
  cleVisuel,
  mentions,
}: {
  valeur: string
  onChange: (valeur: string) => void
  /** Ouvre le guide de la syntaxe. */
  onAide: () => void
  libelle: string
  mode: ModeEditeur
  /** Change quand le texte est remplacé de l'extérieur : l'éditeur visuel repart. */
  cleVisuel: number
  /** Les périmètres et les groupes que `@` propose (ADR 0039). */
  mentions?: Mentions
}) {
  const ref = useRef<TextAreaRef>(null)
  const visuel = useRef<PoigneeVisuel>(null)
  // La mention que la personne saisit, et les périmètres ou groupes qui y répondent.
  const [enCours, setEnCours] = useState<{
    debut: number
    requete: string
  } | null>(null)
  const proposees =
    enCours !== null && mentions !== undefined
      ? suggestions(enCours.requete, mentions)
      : []

  const suivreLeCurseur = (avant: string | null) =>
    setEnCours(avant === null ? null : mentionEnCours(avant))

  const suivreLaZone = () => {
    const zone = ref.current?.resizableTextArea?.textArea
    if (!zone || zone.selectionStart !== zone.selectionEnd) {
      setEnCours(null)
      return
    }
    suivreLeCurseur(zone.value.slice(0, zone.selectionStart))
  }

  /** Remplace la mention en cours par la mention choisie, suivie d'une espace. */
  const mentionner = (texte: string) => {
    if (enCours === null) return
    const longueur = enCours.requete.length + 1
    setEnCours(null)
    if (mode === 'visuel') {
      visuel.current?.remplacerAvant(longueur, `${texte} `)
      return
    }
    const zone = ref.current?.resizableTextArea?.textArea
    if (!zone) return
    const fin = zone.selectionStart
    const insertion = `${texte} `
    remplacer(
      zone,
      {
        debut: fin - longueur,
        fin,
        insertion,
        selection: [
          fin - longueur + insertion.length,
          fin - longueur + insertion.length,
        ],
      },
      onChange
    )
  }

  // Tab choisit la première suggestion, Échap les ferme.
  const surToucheMention = (e: KeyboardEvent<HTMLElement>) => {
    if (proposees.length === 0) return false
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      mentionner(proposees[0]!.texte)
      return true
    }
    if (e.key === 'Escape') {
      setEnCours(null)
      return true
    }
    return false
  }

  const formater = (format: Format) => {
    if (mode === 'visuel') {
      visuel.current?.formater(format)
      return
    }
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
    if (surToucheMention(e)) return
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
        {proposees.length > 0 && (
          <div className="rt-suggestions-mention" aria-label="Mentionner">
            <span className="rt-texte-secondaire">Mentionner</span>
            {proposees.map(p => (
              <button
                key={p.texte}
                type="button"
                className="rt-etiquette rt-mention-groupe"
                // La zone garde le focus et son curseur pendant le clic.
                onMouseDown={e => e.preventDefault()}
                onClick={() => mentionner(p.texte)}
              >
                {p.groupe && <TeamOutlined aria-hidden />} {p.libelle}
              </button>
            ))}
          </div>
        )}
      </div>
      {mode === 'visuel' ? (
        <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
          <div onKeyDownCapture={e => void surToucheMention(e)}>
            <EditeurVisuel
              key={cleVisuel}
              ref={visuel}
              valeur={valeur}
              onChange={onChange}
              onCurseur={mentions === undefined ? undefined : suivreLeCurseur}
              libelle={libelle}
            />
          </div>
        </Suspense>
      ) : (
        <Input.TextArea
          ref={ref}
          value={valeur}
          onChange={e => onChange(e.target.value)}
          onKeyDown={surTouche}
          onSelect={mentions === undefined ? undefined : suivreLaZone}
          onKeyUp={mentions === undefined ? undefined : suivreLaZone}
          onBlur={() => setEnCours(null)}
          autoSize={{ minRows: 18 }}
          className="rt-zone-markdown"
          aria-label={libelle}
        />
      )}
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
