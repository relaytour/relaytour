/**
 * Thème de Relaytour : le modèle d'un thème, le thème par défaut et le thème
 * alternatif de l'application.
 *
 * Deux couches (docs/design-system.md) :
 *
 * 1. Le MATÉRIAU appartient à Relaytour et ne change pas d'une organisation à
 *    l'autre : verre, rayons, ombres, flou, mouvement. Il vit dans la feuille
 *    de style de l'espace organisateur (`global.css`) et dans `rayons` ci-dessous.
 * 2. Le THÈME vient de l'organisation (ADR 0006) : sa palette, son fond (arrêt
 *    de transition du sol et halos), ses polices et la typographie de ses titres. Une organisation peut ne donner qu'une
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
  /**
   * Engagement d'une personne : « je m'en occupe », notification non lue.
   * L'accent colore des surfaces et des traits, jamais un texte.
   */
  accent: string
  accentClair: string
  /** L'accent d'un texte : plus sombre, pour qu'un titre ne se lise pas comme une erreur. */
  accentTexte: string
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

/** Un halo du fond : une tache de couleur floue, fixe, derrière le verre. */
export interface HaloTheme {
  /** Hexadécimal `#RRGGBB`. */
  couleur: string
  /** Opacité de 0 à `INTENSITE_HALO_MAX`. Un halo reste un décor. */
  intensite: number
}

/**
 * Le fond d'un thème, en plus des trois arrêts du sol. Sans déclaration, il se
 * dérive des couleurs (`fondDerive`) : transition = sol1, halos en primaire et
 * en accent.
 */
export interface FondTheme {
  /** L'arrêt à 18 % du dégradé du sol, entre sol1 et sol2 (un blanc crème, par exemple). */
  transition: string
  halo1: HaloTheme
  halo2: HaloTheme
}

export interface Theme {
  couleurs: CouleursTheme
  fond: FondTheme
  polices: PolicesTheme
  typographie: TypographieTheme
}

/** Un thème partiel, tel qu'une organisation peut le décrire. */
export interface ThemePartiel {
  couleurs?: Partial<CouleursTheme>
  fond?: {
    transition?: string
    halo1?: Partial<HaloTheme>
    halo2?: Partial<HaloTheme>
  }
  polices?: Partial<PolicesTheme>
  typographie?: Partial<TypographieTheme>
}

/**
 * L'accent d'un texte quand le thème ne le déclare pas : l'accent mêlé d'un
 * tiers d'encre, dans l'espace sRGB.
 */
export function accentTexteDerive(accent: string, encre: string): string {
  const a = parseInt(accent.slice(1), 16)
  const e = parseInt(encre.slice(1), 16)
  const composante = (decalage: number) =>
    Math.round(
      ((a >> decalage) & 255) * (2 / 3) + ((e >> decalage) & 255) * (1 / 3)
    )
  const n = (composante(16) << 16) | (composante(8) << 8) | composante(0)
  return `#${n.toString(16).padStart(6, '0').toUpperCase()}`
}

/** Vrai quand deux couleurs hexadécimales désignent la même couleur, quelle que soit la casse. */
export function memeCouleur(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/** L'intensité maximale d'un halo : au-delà, il gênerait la lecture du texte posé sur le verre. */
export const INTENSITE_HALO_MAX = 0.35

/**
 * Le fond qu'un thème reçoit quand il ne déclare rien : l'arrêt de transition
 * reprend sol1, le premier halo la primaire à 18 %, le second l'accent à 13 %.
 */
export function fondDerive(couleurs: CouleursTheme): FondTheme {
  return {
    transition: couleurs.sol1,
    halo1: { couleur: couleurs.primaire, intensite: 0.18 },
    halo2: { couleur: couleurs.accent, intensite: 0.13 },
  }
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
 * Validé le 18 septembre 2026 ; l'accent de texte brun et l'erreur carmin, le
 * 23 octobre 2026 (docs/design-system.md).
 */
export const themeParDefaut: Theme = {
  couleurs: {
    encre: '#1B2730',
    primaire: '#1E5A63',
    primaireClair: '#DCEAEB',
    accent: '#AD412B',
    accentClair: '#F6E1DB',
    accentTexte: '#7E3A24',
    succes: '#3A7042',
    succesClair: '#E3F0E4',
    alerte: '#8A5A0E',
    alerteClair: '#FBF0D8',
    erreur: '#B0283F',
    erreurClair: '#F9E1E5',
    sol1: '#FFFFFF',
    sol2: '#F4F6F7',
    sol3: '#E9EEF0',
  },
  fond: {
    transition: '#FFFFFF',
    halo1: { couleur: '#1E5A63', intensite: 0.18 },
    halo2: { couleur: '#AD412B', intensite: 0.13 },
  },
  polices: POLICES_RELAYTOUR,
  typographie: TYPOGRAPHIE_RELAYTOUR,
}

/**
 * Thème alternatif de Relaytour : les actions en encre, un seul accent lagon.
 * Le plus neutre des deux ; une organisation peut le demander tel quel.
 */
const COULEURS_ALTERNATIVES: CouleursTheme = {
  ...themeParDefaut.couleurs,
  primaire: '#1B2730',
  primaireClair: '#E6E9EB',
  accent: '#136D6C',
  accentClair: '#DCEFEE',
  accentTexte: accentTexteDerive('#136D6C', themeParDefaut.couleurs.encre),
}

export const themeAlternatif: Theme = {
  couleurs: COULEURS_ALTERNATIVES,
  fond: fondDerive(COULEURS_ALTERNATIVES),
  polices: POLICES_RELAYTOUR,
  typographie: TYPOGRAPHIE_RELAYTOUR,
}

/** Les thèmes livrés avec l'application, par nom. */
export const THEMES = {
  'bleu-vert': themeParDefaut,
  'encre-lagon': themeAlternatif,
} as const

export type NomTheme = keyof typeof THEMES

function sansIndefinis<T extends object>(objet: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(objet ?? {}).filter(([, v]) => v !== undefined)
  ) as Partial<T>
}

/**
 * Complète un thème partiel avec le thème de base. Le fond se dérive des
 * couleurs fusionnées (`fondDerive`), puis reçoit les valeurs déclarées : une
 * organisation qui ne change que sa primaire obtient un halo de sa primaire.
 * Un thème qui déclare un autre accent que sa base, sans accent de texte, reçoit
 * un accent de texte dérivé du sien (`accentTexteDerive`). Un accent redéclaré à
 * l'identique garde l'accent de texte de la base.
 */
export function fusionnerTheme(
  partiel: ThemePartiel,
  base: Theme = themeParDefaut
): Theme {
  const declarees = sansIndefinis(partiel.couleurs)
  const couleurs = { ...base.couleurs, ...declarees }
  if (
    declarees.accent !== undefined &&
    declarees.accentTexte === undefined &&
    !memeCouleur(declarees.accent, base.couleurs.accent)
  ) {
    couleurs.accentTexte = accentTexteDerive(couleurs.accent, couleurs.encre)
  }
  const derive = fondDerive(couleurs)
  const fond = partiel.fond
  return {
    couleurs,
    fond: {
      transition: fond?.transition ?? derive.transition,
      halo1: { ...derive.halo1, ...sansIndefinis(fond?.halo1) },
      halo2: { ...derive.halo2, ...sansIndefinis(fond?.halo2) },
    },
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
    '--rt-accent-texte': c.accentTexte,
    '--rt-succes': c.succes,
    '--rt-succes-clair': c.succesClair,
    '--rt-alerte': c.alerte,
    '--rt-alerte-clair': c.alerteClair,
    '--rt-erreur': c.erreur,
    '--rt-erreur-clair': c.erreurClair,
    '--rt-sol-1': c.sol1,
    '--rt-sol-2': c.sol2,
    '--rt-sol-3': c.sol3,
    '--rt-sol-transition': theme.fond.transition,
    '--rt-halo-1': `rgba(${rgb(theme.fond.halo1.couleur)}, ${theme.fond.halo1.intensite})`,
    '--rt-halo-2': `rgba(${rgb(theme.fond.halo2.couleur)}, ${theme.fond.halo2.intensite})`,
    '--rt-police': theme.polices.texte,
    '--rt-police-titre': theme.polices.titre,
    '--rt-mono': theme.polices.mono,
    '--rt-titre-graisse': String(theme.typographie.graisseTitre),
    '--rt-corps-graisse': String(theme.typographie.graisseCorps),
    '--rt-titre-espacement': theme.typographie.espacementTitre,
    '--rt-titre-echelle': String(theme.typographie.echelleTitre),
  }
}
