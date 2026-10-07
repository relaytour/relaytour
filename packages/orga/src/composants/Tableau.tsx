import { EditOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Input, Space, Table } from 'antd'
import type { TableColumnType, TableProps } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ThHTMLAttributes,
} from 'react'

import {
  bornerLargeur,
  comparer,
  contient,
  ecrireLargeurs,
  lireLargeurs,
} from '../lib/tableau'
import type { Largeurs, ValeurTri } from '../lib/tableau'

/** Colonne d'un tableau de l'application. */
export interface ColonneTableau<T> extends Omit<
  TableColumnType<T>,
  'key' | 'sorter' | 'filters' | 'onFilter' | 'filterDropdown' | 'children'
> {
  /** Clé stable : elle identifie la largeur enregistrée de la colonne. */
  key: string
  /** Valeur de tri d'une ligne. La colonne devient triable. */
  tri?: (ligne: T) => ValeurTri
  /** Filtre par valeurs : les valeurs proposées, et celles que porte une ligne. */
  filtre?: {
    options: { text: string; value: string }[]
    valeurs: (ligne: T) => string | string[]
  }
  /** Texte d'une ligne dans lequel l'utilisateur recherche une saisie. */
  recherche?: (ligne: T) => string
  /** Une colonne d'actions garde sa largeur. */
  redimensionnable?: boolean
}

interface Props<T> extends Omit<
  TableProps<T>,
  'columns' | 'onRow' | 'components'
> {
  /** Identifiant du tableau, pour enregistrer les largeurs de ses colonnes. */
  id: string
  colonnes: ColonneTableau<T>[]
  /** Ouvre la fiche d'une ligne, par le bouton de la première colonne ou par un clic sur la ligne. */
  ouvrir?: (ligne: T) => void
  /** Indique si une ligne a une fiche à ouvrir. Par défaut, toutes en ont une. */
  peutOuvrir?: (ligne: T) => boolean
  /** Libellé du bouton d'ouverture, lu par les lecteurs d'écran. */
  libelleOuvrir?: (ligne: T) => string
}

/** Pas d'un redimensionnement au clavier, en pixels. */
const PAS_CLAVIER = 16

const INTERACTIFS =
  'a, button, input, select, textarea, label, [role="button"], [role="separator"], .ant-popover, .ant-select, .ant-dropdown, .ant-modal-root'

interface PropsEnTete extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Reçoit la nouvelle largeur, ou `null` pour revenir à la largeur automatique. */
  redimensionner?: (largeur: number | null) => void
  libelle?: string
}

/** Cellule d'en-tête, avec une poignée de redimensionnement sur son bord droit. */
function EnTete({ redimensionner, libelle, children, ...reste }: PropsEnTete) {
  if (redimensionner === undefined) return <th {...reste}>{children}</th>

  const largeurActuelle = (poignee: Element) =>
    poignee.closest('th')?.getBoundingClientRect().width ?? 0

  const saisir = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const poignee = e.currentTarget
    const origine = e.clientX
    const largeur = largeurActuelle(poignee)
    poignee.setPointerCapture(e.pointerId)
    const deplacer = (ev: globalThis.PointerEvent) =>
      redimensionner(largeur + ev.clientX - origine)
    const relacher = () => {
      // Le contenu d'une colonne borne sa largeur : la valeur gardée est celle
      // que le navigateur affiche réellement.
      redimensionner(largeurActuelle(poignee))
      poignee.removeEventListener('pointermove', deplacer)
      poignee.removeEventListener('pointerup', relacher)
      poignee.removeEventListener('pointercancel', relacher)
    }
    poignee.addEventListener('pointermove', deplacer)
    poignee.addEventListener('pointerup', relacher)
    poignee.addEventListener('pointercancel', relacher)
  }

  const auClavier = (e: KeyboardEvent<HTMLSpanElement>) => {
    const sens =
      e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : undefined
    if (sens === undefined) return
    e.preventDefault()
    e.stopPropagation()
    redimensionner(largeurActuelle(e.currentTarget) + sens * PAS_CLAVIER)
  }

  // Un clic sur la poignée ne doit pas déclencher le tri de la colonne.
  const retenir = (e: MouseEvent) => e.stopPropagation()

  return (
    <th {...reste}>
      {children}
      <span
        className="rt-poignee-colonne"
        role="separator"
        aria-orientation="vertical"
        aria-label={`Largeur de la colonne ${libelle ?? ''}`.trim()}
        title="Faites glisser pour ajuster la largeur. Un double-clic rétablit la largeur automatique."
        tabIndex={0}
        onPointerDown={saisir}
        onKeyDown={auClavier}
        onClick={retenir}
        onDoubleClick={e => {
          retenir(e)
          redimensionner(null)
        }}
      />
    </th>
  )
}

const COMPOSANTS = { header: { cell: EnTete } }

/**
 * Tableau commun à l'application : tri, filtres et largeur des colonnes, et
 * ouverture de la fiche d'une ligne par un bouton ou par un clic sur la ligne.
 */
export default function Tableau<T extends object>({
  id,
  colonnes,
  ouvrir,
  peutOuvrir,
  libelleOuvrir,
  ...reste
}: Props<T>) {
  const [largeurs, setLargeurs] = useState<Largeurs>(() => lireLargeurs(id))
  useEffect(() => ecrireLargeurs(id, largeurs), [id, largeurs])

  const columns = useMemo(() => {
    const ouvrable = (ligne: T) => peutOuvrir?.(ligne) ?? true

    const liste: TableColumnType<T>[] = colonnes.map(
      ({ tri, filtre, recherche, redimensionnable = true, ...colonne }) => {
        const largeur = largeurs[colonne.key]
        const libelle =
          typeof colonne.title === 'string' ? colonne.title : undefined
        return {
          ...colonne,
          width: largeur ?? colonne.width,
          ...(largeur !== undefined && {
            className:
              `${colonne.className ?? ''} rt-colonne-redimensionnee`.trim(),
          }),
          ...(tri && {
            sorter: (a: T, b: T) => comparer(tri(a), tri(b)),
            showSorterTooltip: false,
          }),
          ...(filtre && {
            filters: filtre.options,
            onFilter: (valeur, ligne: T) =>
              [filtre.valeurs(ligne)].flat().includes(String(valeur)),
          }),
          ...(recherche && {
            filterIcon: (actif: boolean) => (
              <SearchOutlined
                style={{ color: actif ? 'var(--rt-primaire)' : undefined }}
              />
            ),
            onFilter: (valeur, ligne: T) =>
              contient(recherche(ligne), String(valeur)),
            filterDropdown: ({
              selectedKeys,
              setSelectedKeys,
              confirm,
              clearFilters,
            }) => (
              <div className="rt-recherche-colonne">
                <Input
                  autoFocus
                  allowClear
                  placeholder="Rechercher"
                  aria-label={`Rechercher dans la colonne ${libelle ?? ''}`.trim()}
                  value={String(selectedKeys[0] ?? '')}
                  onChange={e =>
                    setSelectedKeys(e.target.value ? [e.target.value] : [])
                  }
                  onPressEnter={() => confirm()}
                />
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      clearFilters?.()
                      confirm()
                    }}
                  >
                    Réinitialiser
                  </Button>
                  <Button size="small" type="primary" onClick={() => confirm()}>
                    Rechercher
                  </Button>
                </Space>
              </div>
            ),
          }),
          ...(redimensionnable && {
            // antd transmet ces propriétés telles quelles à la cellule d'en-tête.
            onHeaderCell: () => {
              const proprietes: PropsEnTete = {
                libelle,
                redimensionner: valeur =>
                  setLargeurs(courantes => {
                    const suivantes = { ...courantes }
                    if (valeur === null) delete suivantes[colonne.key]
                    else suivantes[colonne.key] = bornerLargeur(valeur)
                    return suivantes
                  }),
              }
              return proprietes
            },
          }),
        } satisfies TableColumnType<T>
      }
    )

    if (ouvrir === undefined) return liste
    return [
      {
        key: 'ouvrir',
        title: <span className="rt-masque">Ouvrir</span>,
        width: 48,
        // Le bouton rend l'ouverture accessible au clavier ; le clic sur la ligne
        // reste un raccourci.
        render: (_: unknown, ligne: T) =>
          ouvrable(ligne) && (
            <Button
              size="small"
              icon={<EditOutlined />}
              aria-label={libelleOuvrir?.(ligne) ?? 'Ouvrir la fiche'}
              title={libelleOuvrir?.(ligne) ?? 'Ouvrir la fiche'}
              onClick={() => ouvrir(ligne)}
            />
          ),
      } satisfies TableColumnType<T>,
      ...liste,
    ]
  }, [colonnes, largeurs, ouvrir, peutOuvrir, libelleOuvrir])

  return (
    <Table<T>
      scroll={{ x: 'max-content' }}
      {...reste}
      className={`rt-tableau ${reste.className ?? ''}`.trim()}
      components={COMPOSANTS}
      columns={columns}
      onRow={
        ouvrir &&
        (ligne =>
          (peutOuvrir?.(ligne) ?? true)
            ? {
                className: 'rt-ligne-ouvrable',
                onClick: e => {
                  // Un bouton, un lien ou une fenêtre de confirmation de la ligne
                  // garde son propre clic. Une sélection de texte n'ouvre rien.
                  if ((e.target as Element).closest(INTERACTIFS)) return
                  if (window.getSelection()?.toString()) return
                  ouvrir(ligne)
                },
              }
            : {})
      }
    />
  )
}
