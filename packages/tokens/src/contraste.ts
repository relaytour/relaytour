/**
 * Contraste WCAG 2 entre deux couleurs hexadécimales, et vérification d'un
 * thème : chaque couleur de texte doit atteindre 4,5:1 sur le blanc et sur la
 * bande la plus dense du sol.
 */
import type { Theme } from './index.ts'

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const composante = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * composante((n >> 16) & 255) +
    0.7152 * composante((n >> 8) & 255) +
    0.0722 * composante(n & 255)
  )
}

/** Rapport de contraste WCAG 2, de 1 à 21. */
export function contraste(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export interface Manquement {
  couleur: string
  fond: string
  rapport: number
}

const SEUIL_TEXTE = 4.5

/**
 * Les couples couleur / fond sous le seuil AA du texte normal. Une liste vide
 * signifie que le thème est accessible tel quel.
 */
export function verifierAccessibilite(theme: Theme): Manquement[] {
  const c = theme.couleurs
  const textes = [
    'encre',
    'primaire',
    'accent',
    'succes',
    'alerte',
    'erreur',
  ] as const
  const fonds = ['#FFFFFF', c.sol3, theme.fond.transition]
  const manquements: Manquement[] = []
  for (const nom of textes) {
    for (const fond of fonds) {
      const rapport = contraste(c[nom], fond)
      if (rapport < SEUIL_TEXTE) {
        manquements.push({ couleur: nom, fond, rapport })
      }
    }
  }
  // Le texte blanc des boutons pleins et de l'élément de menu actif.
  for (const nom of ['primaire', 'accent'] as const) {
    const rapport = contraste('#FFFFFF', c[nom])
    if (rapport < SEUIL_TEXTE) {
      manquements.push({ couleur: '#FFFFFF', fond: nom, rapport })
    }
  }
  return manquements
}

// ── Contraste perçu (APCA) ───────────────────────────────────────────────────
//
// La formule WCAG 2 préfère le noir sur les teintes saturées de luminosité
// moyenne (turquoise, rose, corail), où l'œil lit pourtant mieux le blanc.
// APCA (Accessible Perceptual Contrast Algorithm, version 0.0.98G), candidate
// de WCAG 3, mesure le contraste perçu et tient compte du sens clair sur foncé.

function luminanceApca(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => (v / 255) ** 2.4
  const y =
    0.2126729 * c((n >> 16) & 255) +
    0.7151522 * c((n >> 8) & 255) +
    0.072175 * c(n & 255)
  return y > 0.022 ? y : y + (0.022 - y) ** 1.414
}

/**
 * Contraste perçu APCA (Lc) d'un texte sur un fond, en valeur absolue, de 0 à
 * 106 environ. Repères : 60 pour un texte courant en gras, 75 pour un texte fin.
 */
export function contrastePercu(texte: string, fond: string): number {
  const yt = luminanceApca(texte)
  const yf = luminanceApca(fond)
  const s =
    yf > yt
      ? (yf ** 0.56 - yt ** 0.57) * 1.14
      : (yf ** 0.65 - yt ** 0.62) * 1.14
  if (Math.abs(s) < 0.1) return 0
  return Math.abs(s > 0 ? s - 0.027 : s + 0.027) * 100
}

/** Le texte le plus lisible sur une couleur pleine, blanc ou presque noir, selon APCA. */
export function texteSurCouleur(fond: string): '#FFFFFF' | '#111111' {
  return contrastePercu('#FFFFFF', fond) >= contrastePercu('#111111', fond)
    ? '#FFFFFF'
    : '#111111'
}
