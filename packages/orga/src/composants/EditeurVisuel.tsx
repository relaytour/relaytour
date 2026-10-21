import type { Editor } from '@milkdown/core'
import { Button, Form, Input, Modal } from 'antd'
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react'

import {
  creerEditeurVisuel,
  formaterVisuel,
  lierVisuel,
  remplacerAvantLeCurseur,
  selectionDe,
} from '../lib/editeur-visuel'
import type { Format } from '../lib/mise-en-forme'

export interface PoigneeVisuel {
  formater: (format: Format) => void
  /** Remplace les caractères qui précèdent le curseur (une mention en cours). */
  remplacerAvant: (longueur: number, texte: string) => void
}

type SelectionGardee = ReturnType<typeof selectionDe>

/**
 * Éditeur visuel d'une fiche : la personne écrit dans le rendu. Il part du texte
 * reçu au montage ; un texte remplacé de l'extérieur (brouillon repris, sections
 * du gabarit) demande un nouveau montage, par la clé du composant.
 */
export default function EditeurVisuel({
  valeur,
  onChange,
  onCurseur,
  libelle,
  ref,
}: {
  valeur: string
  onChange: (valeur: string) => void
  onCurseur?: (avant: string | null) => void
  libelle: string
  ref?: Ref<PoigneeVisuel>
}) {
  const racine = useRef<HTMLDivElement>(null)
  const editeur = useRef<Editor | null>(null)
  const surChangement = useRef(onChange)
  const surCurseur = useRef(onCurseur)
  useEffect(() => {
    surChangement.current = onChange
    surCurseur.current = onCurseur
  }, [onChange, onCurseur])
  const depart = useRef(valeur)
  const [lien, setLien] = useState<SelectionGardee | null>(null)
  const [adresse, setAdresse] = useState('')

  useEffect(() => {
    // Chaque montage écrit dans son propre conteneur : un double montage du
    // mode strict ne mélange pas deux éditeurs.
    const conteneur = document.createElement('div')
    racine.current?.append(conteneur)
    let annule = false
    let cree: Editor | null = null
    void creerEditeurVisuel({
      racine: conteneur,
      valeur: depart.current,
      libelle,
      onChange: markdown => surChangement.current(markdown),
      onCurseur: avant => surCurseur.current?.(avant),
    }).then(e => {
      if (annule) {
        e.destroy()
        return
      }
      cree = e
      editeur.current = e
    })
    return () => {
      annule = true
      void cree?.destroy()
      editeur.current = null
      conteneur.remove()
    }
  }, [libelle])

  const demanderLien = () => {
    if (!editeur.current) return
    setAdresse('')
    setLien(selectionDe(editeur.current))
  }

  useImperativeHandle(ref, () => ({
    formater: format => {
      if (!editeur.current) return
      if (format === 'lien') demanderLien()
      else formaterVisuel(editeur.current, format)
    },
    remplacerAvant: (longueur, texte) => {
      if (editeur.current)
        remplacerAvantLeCurseur(editeur.current, longueur, texte)
    },
  }))

  const surTouche = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
    if (e.key.toLowerCase() !== 'k') return
    e.preventDefault()
    demanderLien()
  }

  const poser = (valeurAdresse: string) => {
    if (editeur.current && lien)
      lierVisuel(editeur.current, lien, valeurAdresse)
    setLien(null)
  }

  return (
    <>
      <div
        ref={racine}
        className="rt-editeur-visuel"
        onKeyDownCapture={surTouche}
      />
      <Modal
        title="Lien"
        open={lien !== null}
        onCancel={() => setLien(null)}
        destroyOnHidden
        footer={[
          // Retirer un lien demande de sélectionner son texte : au curseur, la plage
          // à retirer serait vide.
          lien?.dejaLie && !lien.empty && (
            <Button key="retirer" onClick={() => poser('')}>
              Retirer le lien
            </Button>
          ),
          <Button key="annuler" onClick={() => setLien(null)}>
            Annuler
          </Button>,
          <Button
            key="poser"
            type="primary"
            disabled={adresse.trim() === ''}
            onClick={() => poser(adresse.trim())}
          >
            Poser le lien
          </Button>,
        ]}
      >
        <Form layout="vertical" onFinish={() => poser(adresse.trim())}>
          <Form.Item
            label="Adresse"
            extra={
              lien?.empty
                ? 'L’adresse s’insère à l’emplacement du curseur.'
                : 'Le texte sélectionné devient le texte du lien.'
            }
          >
            <Input
              autoFocus
              value={adresse}
              onChange={e => setAdresse(e.target.value)}
              placeholder="https://"
              inputMode="url"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
