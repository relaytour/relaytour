// Éditeur visuel des fiches (Milkdown) : la personne écrit dans le rendu, et
// l'éditeur produit le Markdown de la fiche. Il ne connaît que la syntaxe que le
// rendu des fiches affiche (CommonMark et GFM, sans HTML).
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  editorViewOptionsCtx,
  remarkStringifyOptionsCtx,
  rootCtx,
  serializerCtx,
} from '@milkdown/core'
import { clipboard } from '@milkdown/plugin-clipboard'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import {
  bulletListSchema,
  commonmark,
  liftListItemCommand,
  linkSchema,
  orderedListSchema,
  toggleEmphasisCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/preset-commonmark'
import { gfm, remarkGFMPlugin } from '@milkdown/preset-gfm'
import type { Ctx } from '@milkdown/ctx'
import type { Node } from '@milkdown/prose/model'
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import type { EditorView } from '@milkdown/prose/view'
import { $prose, callCommand, insert } from '@milkdown/utils'

import { TABLEAU } from './mise-en-forme'
import { estLienLitteral, retoucher } from './retouche-markdown'
import { defaultHandlers } from 'mdast-util-to-markdown'

/**
 * L'écriture du Markdown suit les choix de la barre de mise en forme et du
 * guide : tiret pour les puces, tiret bas pour l'italique, deux astérisques
 * pour le gras. Une fiche relue sans modification garde ainsi sa forme.
 */
export const OPTIONS_MARKDOWN = {
  bullet: '-',
  bulletOther: '*',
  emphasis: '_',
  strong: '*',
  rule: '-',
  fence: '`',
  fences: true,
  listItemIndent: 'one',
  incrementListMarker: true,
  tightDefinitions: true,
} as const

/**
 * Une adresse écrite telle quelle (`contact@exemple.org`, `https://…`) devient un
 * lien GFM à la lecture. Elle se réécrit telle quelle, et non entre chevrons.
 */
function lien(
  ...[node, parent, state, info]: Parameters<typeof defaultHandlers.link>
) {
  const [enfant] = node.children
  return node.children.length === 1 &&
    enfant?.type === 'text' &&
    estLienLitteral(node.url, enfant.value, node.title)
    ? enfant.value
    : defaultHandlers.link(node, parent, state, info)
}
lien.peek = defaultHandlers.link.peek

/** Coche ou décoche l'élément à cocher qui contient la position. */
function basculerLaCase(vue: EditorView, position: number): boolean {
  const $pos = vue.state.doc.resolve(position)
  for (let profondeur = $pos.depth; profondeur > 0; profondeur--) {
    const noeud = $pos.node(profondeur)
    if (noeud.type.name !== 'list_item') continue
    if (noeud.attrs.checked == null) return false
    vue.dispatch(
      vue.state.tr.setNodeMarkup($pos.before(profondeur), undefined, {
        ...noeud.attrs,
        checked: !noeud.attrs.checked,
      })
    )
    return true
  }
  return false
}

/**
 * Les cases des éléments à cocher : une vraie case, avec son état annoncé, devant
 * le texte de l'élément. Un clic, ou la touche Espace sur la case, la coche ; dans
 * le texte de l'élément, ⌘Entrée ou Ctrl+Entrée fait de même.
 */
const casesACocher = $prose(
  () =>
    new Plugin({
      key: new PluginKey('rt-cases-a-cocher'),
      props: {
        decorations: etat => {
          const decorations: Decoration[] = []
          etat.doc.descendants((noeud, position) => {
            if (noeud.type.name !== 'list_item' || noeud.attrs.checked == null)
              return
            const cochee = Boolean(noeud.attrs.checked)
            // La case se place au début du premier paragraphe de l'élément.
            decorations.push(
              Decoration.widget(
                position + 2,
                (vue, positionDeLaCase) => {
                  const caseACocher = document.createElement('input')
                  caseACocher.type = 'checkbox'
                  caseACocher.checked = cochee
                  caseACocher.className = 'rt-case-visuelle'
                  caseACocher.contentEditable = 'false'
                  caseACocher.setAttribute(
                    'aria-label',
                    noeud.textContent.trim() || 'Élément à cocher'
                  )
                  caseACocher.addEventListener('mousedown', e =>
                    e.preventDefault()
                  )
                  caseACocher.addEventListener('change', () => {
                    const ici = positionDeLaCase()
                    if (ici !== undefined) basculerLaCase(vue, ici)
                  })
                  return caseACocher
                },
                {
                  side: -1,
                  ignoreSelection: true,
                  key: `case-${position}-${cochee}`,
                  stopEvent: () => true,
                }
              )
            )
          })
          return DecorationSet.create(etat.doc, decorations)
        },
        handleKeyDown: (vue, evenement) => {
          if (evenement.key !== 'Enter') return false
          if (!(evenement.metaKey || evenement.ctrlKey)) return false
          return basculerLaCase(vue, vue.state.selection.from)
        },
      },
    })
)

export interface OptionsEditeurVisuel {
  racine: HTMLElement
  valeur: string
  /** Appelé à chaque modification de la personne, avec le Markdown obtenu. */
  onChange?: (markdown: string) => void
  /**
   * Appelé quand le curseur bouge, avec le texte de son bloc qui le précède. Null
   * pour une sélection qui n'est pas un curseur. Les suggestions de mention s'en
   * servent (ADR 0039).
   */
  onCurseur?: (avant: string | null) => void
  libelle?: string
}

export async function creerEditeurVisuel({
  racine,
  valeur,
  onChange,
  onCurseur,
  libelle,
}: OptionsEditeurVisuel): Promise<Editor> {
  return Editor.make()
    .config(ctx => {
      ctx.set(rootCtx, racine)
      ctx.set(defaultValueCtx, valeur)
      ctx.update(remarkStringifyOptionsCtx, options => ({
        ...options,
        ...OPTIONS_MARKDOWN,
        handlers: { ...options.handlers, link: lien },
      }))
      // Un tableau garde des colonnes non alignées : une cellule modifiée ne
      // réécrit pas tout le tableau.
      ctx.set(remarkGFMPlugin.options.key, { tablePipeAlign: false })
      ctx.update(editorViewOptionsCtx, options => ({
        ...options,
        attributes: {
          class: 'rt-markdown rt-editeur-visuel-zone',
          role: 'textbox',
          'aria-multiline': 'true',
          ...(libelle ? { 'aria-label': libelle } : {}),
        },
      }))
      if (onChange)
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, precedent) => {
          if (markdown !== precedent) onChange(retoucher(markdown, valeur))
        })
      if (onCurseur)
        ctx.get(listenerCtx).selectionUpdated((_ctx, selection) => {
          const { $from, empty } = selection
          onCurseur(
            empty
              ? $from.parent.textBetween(0, $from.parentOffset, undefined, ' ')
              : null
          )
        })
    })
    .use(commonmark)
    .use(gfm)
    .use(casesACocher)
    .use(history)
    .use(listener)
    .use(clipboard)
    .create()
}

/** Le Markdown que l'éditeur écrit pour un texte relu sans modification. */
export function markdownDe(editeur: Editor, modele = ''): string {
  return editeur.action(ctx => {
    const vue = ctx.get(editorViewCtx)
    return retoucher(ctx.get(serializerCtx)(vue.state.doc), modele)
  })
}

/** Les formats que la barre applique dans l'éditeur visuel, sauf le lien. */
export type FormatVisuel =
  | 'gras'
  | 'italique'
  | 'titre2'
  | 'titre3'
  | 'puces'
  | 'numeros'
  | 'cases'
  | 'tableau'

/** Applique un format de la barre à la sélection de l'éditeur visuel. */
export function formaterVisuel(editeur: Editor, format: FormatVisuel): void {
  editeur.action(ctx => {
    switch (format) {
      case 'gras':
        callCommand(toggleStrongCommand.key)(ctx)
        break
      case 'italique':
        callCommand(toggleEmphasisCommand.key)(ctx)
        break
      case 'titre2':
      case 'titre3':
        titre(ctx, format === 'titre2' ? 2 : 3)
        break
      case 'puces':
      case 'numeros':
      case 'cases':
        liste(ctx, format)
        break
      case 'tableau':
        // Le même tableau que le mode Markdown, avec ses titres de colonnes.
        insert(TABLEAU)(ctx)
        break
    }
    ctx.get(editorViewCtx).focus()
  })
}

/** Un titre du même niveau redevient un paragraphe. */
function titre(ctx: Ctx, niveau: number) {
  const bloc = ctx.get(editorViewCtx).state.selection.$from.parent
  const deja = bloc.type.name === 'heading' && bloc.attrs.level === niveau
  callCommand(wrapInHeadingCommand.key, deja ? 0 : niveau)(ctx)
}

type NatureListe = 'puces' | 'numeros' | 'cases'

function natureDe(liste: Node): NatureListe {
  if (liste.type.name === 'ordered_list') return 'numeros'
  return liste.firstChild?.attrs.checked != null ? 'cases' : 'puces'
}

/**
 * Une liste de la même nature perd l'élément du curseur. Une liste d'une autre
 * nature change de nature. Hors d'une liste, le paragraphe devient une liste.
 */
function liste(ctx: Ctx, cible: NatureListe) {
  const vue = ctx.get(editorViewCtx)
  const trouvee = listeAutour(vue)
  if (trouvee) {
    if (natureDe(trouvee.noeud) === cible) {
      callCommand(liftListItemCommand.key)(ctx)
      return
    }
    changerNature(ctx, vue, trouvee, cible)
    return
  }
  const commande =
    cible === 'numeros' ? wrapInOrderedListCommand : wrapInBulletListCommand
  if (!callCommand(commande.key)(ctx) || cible !== 'cases') return
  const nouvelle = listeAutour(vue)
  if (nouvelle) changerNature(ctx, vue, nouvelle, 'cases')
}

function listeAutour(vue: EditorView) {
  const { $from } = vue.state.selection
  for (let profondeur = $from.depth; profondeur > 0; profondeur--) {
    const noeud = $from.node(profondeur)
    if (['bullet_list', 'ordered_list'].includes(noeud.type.name))
      return { noeud, position: $from.before(profondeur) }
  }
  return null
}

function changerNature(
  ctx: Ctx,
  vue: EditorView,
  { noeud, position }: { noeud: Node; position: number },
  cible: NatureListe
) {
  const tr = vue.state.tr
  const type =
    cible === 'numeros'
      ? orderedListSchema.type(ctx)
      : bulletListSchema.type(ctx)
  tr.setNodeMarkup(position, type, { spread: noeud.attrs.spread })
  noeud.forEach((element, decalage) => {
    tr.setNodeMarkup(position + 1 + decalage, undefined, {
      ...element.attrs,
      listType: cible === 'numeros' ? 'ordered' : 'bullet',
      checked: cible === 'cases' ? (element.attrs.checked ?? false) : null,
    })
  })
  vue.dispatch(tr)
}

/** La sélection courante, gardée pendant la saisie d'une adresse. */
export function selectionDe(editeur: Editor) {
  return editeur.action(ctx => {
    const { from, to, empty } = ctx.get(editorViewCtx).state.selection
    const lien = linkSchema.type(ctx)
    const dejaLie = ctx
      .get(editorViewCtx)
      .state.doc.rangeHasMark(from, empty ? to + 1 : to, lien)
    return { from, to, empty, dejaLie }
  })
}

/**
 * Pose un lien sur la sélection gardée. Sans sélection, l'adresse s'insère et
 * devient le texte du lien. Une adresse vide retire le lien de la sélection.
 */
export function lierVisuel(
  editeur: Editor,
  { from, to, empty }: { from: number; to: number; empty: boolean },
  adresse: string
) {
  editeur.action(ctx => {
    const vue = ctx.get(editorViewCtx)
    const type = linkSchema.type(ctx)
    const tr = vue.state.tr
    if (adresse === '') {
      tr.removeMark(from, to, type)
    } else if (empty) {
      tr.insertText(adresse, from)
      tr.addMark(from, from + adresse.length, type.create({ href: adresse }))
      tr.setSelection(TextSelection.create(tr.doc, from + adresse.length))
    } else {
      tr.setSelection(TextSelection.create(tr.doc, from, to))
      vue.dispatch(tr)
      callCommand(toggleLinkCommand.key, { href: adresse })(ctx)
      vue.focus()
      return
    }
    vue.dispatch(tr)
    vue.focus()
  })
}

/**
 * Remplace les `longueur` caractères qui précèdent le curseur par `texte` : une
 * mention en cours de saisie devient la mention choisie.
 */
export function remplacerAvantLeCurseur(
  editeur: Editor,
  longueur: number,
  texte: string
): void {
  editeur.action(ctx => {
    const vue = ctx.get(editorViewCtx)
    const { from } = vue.state.selection
    vue.dispatch(vue.state.tr.insertText(texte, from - longueur, from))
    vue.focus()
  })
}
