/**
 * Thème de Relaytour : le modèle d'un thème, le thème par défaut et le thème
 * alternatif de l'application.
 *
 * Deux couches (docs/identite.md) :
 *
 * 1. Le MATÉRIAU appartient à Relaytour et ne change pas d'une organisation à
 *    l'autre : verre, rayons, ombres, flou, mouvement. Il vit dans la feuille
 *    de style de l'espace organisateur (`global.css`) et dans `rayons` ci-dessous.
 * 2. Le THÈME vient de l'organisation (ADR 0006) : sa palette, ses polices et
 *    la typographie de ses titres. Une organisation peut ne donner qu'une
 *    partie des valeurs ; `fusionnerTheme` complète avec le thème par défaut.
 *
 * Les composants ne lisent jamais une couleur en dur : ils lisent les
 * variables CSS `--rt-*` posées par `variablesCss`.
 */

export {
  contraste,
  contrastePercu,
  texteSurCouleur,
  verifierAccessibilite,
} from './contraste.ts'
export type { Manquement } from './contraste.ts'

/** Les couleurs d'un thème. Toutes en hexadécimal `#RRGGBB`. */
export interface CouleursTheme {
  /** Texte, icônes, ombres. La hiérarchie du texte est une transparence de l'encre. */
  encre: string
  /** Actions principales, liens, élément de menu actif. */
  primaire: string
  /** Fond des états « en cours » et des en-têtes de tableau. */
  primaireClair: string
  /** Engagement d'une personne : « je m'en occupe », notification non lue. */
  accent: string
  accentClair: string
  succes: string
  succesClair: string
  alerte: string
  alerteClair: string
  erreur: string
  erreurClair: string
  /** Les trois arrêts du sol : blanc, bande claire, bande dense. */
  sol1: string
  sol2: string
  sol3: string
}

/** Les familles de police d'un thème, en piles CSS complètes. */
export interface PolicesTheme {
  texte: string
  titre: string
  mono: string
}

/** Ce qui distingue une police de titre d'une autre, au-delà de sa famille. */
export interface TypographieTheme {
  /** Graisse des titres : 600 pour une grotesque, 400 pour une police d'affiche. */
  graisseTitre: number
  graisseCorps: number
  /** Espacement des lettres des titres, en em. */
  espacementTitre: string
  /** Facteur appliqué à la taille des titres : 1 pour Hanken Grotesk, 1,35 pour Bebas Neue. */
  echelleTitre: number
}

export interface Theme {
  couleurs: CouleursTheme
  polices: PolicesTheme
  typographie: TypographieTheme
}

/** Un thème partiel, tel qu'une organisation peut le décrire. */
export interface ThemePartiel {
  couleurs?: Partial<CouleursTheme>
  polices?: Partial<PolicesTheme>
  typographie?: Partial<TypographieTheme>
}

/**
 * Les familles embarquées dans l'espace organisateur (paquets fontsource,
 * licence OFL). Un thème ne peut nommer qu'une famille de cette liste.
 */
export const POLICES_DISPONIBLES = [
  'Hanken Grotesk',
  'IBM Plex Mono',
  'Bebas Neue',
  'Quicksand',
] as const

export type PoliceDisponible = (typeof POLICES_DISPONIBLES)[number]

const PILE_SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"
const PILE_MONO = 'ui-monospace, Menlo, monospace'

/** La pile CSS d'une famille embarquée. */
export function pile(famille: PoliceDisponible): string {
  switch (famille) {
    case 'Hanken Grotesk':
      return `'Hanken Grotesk Variable', ${PILE_SANS}`
    case 'Quicksand':
      return `'Quicksand Variable', ${PILE_SANS}`
    case 'Bebas Neue':
      return `'Bebas Neue', ${PILE_SANS}`
    case 'IBM Plex Mono':
      return `'IBM Plex Mono', ${PILE_MONO}`
  }
}

const POLICES_RELAYTOUR: PolicesTheme = {
  texte: pile('Hanken Grotesk'),
  titre: pile('Hanken Grotesk'),
  mono: pile('IBM Plex Mono'),
}

const TYPOGRAPHIE_RELAYTOUR: TypographieTheme = {
  graisseTitre: 600,
  graisseCorps: 400,
  espacementTitre: '-0.02em',
  echelleTitre: 1,
}

/**
 * Thème par défaut de Relaytour : bleu-vert et terre cuite sur un sol froid.
 * Validé le 18 septembre 2026 (docs/identite.md).
 */
export const themeParDefaut: Theme = {
  couleurs: {
    encre: '#1B2730',
    primaire: '#1E5A63',
    primaireClair: '#DCEAEB',
    accent: '#AD412B',
    accentClair: '#F6E1DB',
    succes: '#3A7042',
    succesClair: '#E3F0E4',
    alerte: '#8A5A0E',
    alerteClair: '#FBF0D8',
    erreur: '#A23A2C',
    erreurClair: '#F8E3DF',
    sol1: '#FFFFFF',
    sol2: '#F4F6F7',
    sol3: '#E9EEF0',
  },
  polices: POLICES_RELAYTOUR,
  typographie: TYPOGRAPHIE_RELAYTOUR,
}

/**
 * Thème alternatif de Relaytour : les actions en encre, un seul accent lagon.
 * Le plus neutre des deux ; une organisation peut le demander tel quel.
 */
export const themeAlternatif: Theme = {
  couleurs: {
    ...themeParDefaut.couleurs,
    primaire: '#1B2730',
    primaireClair: '#E6E9EB',
    accent: '#136D6C',
    accentClair: '#DCEFEE',
  },
  polices: POLICES_RELAYTOUR,
  typographie: TYPOGRAPHIE_RELAYTOUR,
}

/** Les thèmes livrés avec l'application, par nom. */
export const THEMES = {
  'bleu-vert': themeParDefaut,
  'encre-lagon': themeAlternatif,
} as const

export type NomTheme = keyof typeof THEMES

/** Complète un thème partiel avec le thème par défaut. */
export function fusionnerTheme(
  partiel: ThemePartiel,
  base: Theme = themeParDefaut
): Theme {
  return {
    couleurs: { ...base.couleurs, ...partiel.couleurs },
    polices: { ...base.polices, ...partiel.polices },
    typographie: { ...base.typographie, ...partiel.typographie },
  }
}

/** Rayons du matériau, en pixels. Les mêmes pour tous les thèmes. */
export const rayons = {
  champ: 10,
  chip: 14,
  carte: 20,
  panneau: 28,
  barre: 36,
  pilule: 999,
} as const

/** Composantes `r, g, b` d'une couleur hexadécimale, pour `rgba()`. */
export function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/**
 * Les variables CSS d'un thème, à poser sur `:root`. Les dérivés (transparences
 * de l'encre, verre teinté, ombres) sont calculés dans la feuille de style à
 * partir des composantes `-rgb`.
 */
export function variablesCss(theme: Theme): Record<string, string> {
  const c = theme.couleurs
  return {
    '--rt-encre': c.encre,
    '--rt-encre-rgb': rgb(c.encre),
    '--rt-primaire': c.primaire,
    '--rt-primaire-rgb': rgb(c.primaire),
    '--rt-primaire-clair': c.primaireClair,
    '--rt-accent': c.accent,
    '--rt-accent-rgb': rgb(c.accent),
    '--rt-accent-clair': c.accentClair,
    '--rt-succes': c.succes,
    '--rt-succes-clair': c.succesClair,
    '--rt-alerte': c.alerte,
    '--rt-alerte-clair': c.alerteClair,
    '--rt-erreur': c.erreur,
    '--rt-erreur-clair': c.erreurClair,
    '--rt-sol-1': c.sol1,
    '--rt-sol-2': c.sol2,
    '--rt-sol-3': c.sol3,
    '--rt-police': theme.polices.texte,
    '--rt-police-titre': theme.polices.titre,
    '--rt-mono': theme.polices.mono,
    '--rt-titre-graisse': String(theme.typographie.graisseTitre),
    '--rt-corps-graisse': String(theme.typographie.graisseCorps),
    '--rt-titre-espacement': theme.typographie.espacementTitre,
    '--rt-titre-echelle': String(theme.typographie.echelleTitre),
  }
}
