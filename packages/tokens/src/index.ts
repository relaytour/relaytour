/**
 * Thème par défaut de Relaytour : jetons de design
 * Déposer dans `src/design/tokens.ts`.
 *
 * Valeurs exactes du design system validé (septembre 2026). Ne pas arrondir.
 * Ce fichier ne remplace aucun asset ni aucun composant existant : il ne fait
 * qu'exposer les valeurs.
 */

export const colors = {
  marine: '#2F6B4F',
  marineDeep: '#01143a', // socle de bouton marine
  corail: '#FC685F',
  corailDeep: '#c94a43', // socle de bouton corail
  turquoise: '#2399A9',
  papier: '#F6EBDD',
  roseSable: '#CE8A88',
  sable: '#EDE0D1',
  menthe: '#8FC9B7',
  indigo: '#323379',
  blanc: '#FFFFFF',
  blancSocle: '#c9d3e0', // socle de bouton blanc
} as const

/** Les 8 bandes du soleil — logo, accents festifs, accent par sport. Jamais en fond de section. */
export const sunBands = [
  '#F32988',
  '#FB557D',
  '#FB8B36',
  '#FBBB50',
  '#8FC9B7',
  '#02ADB8',
  '#006691',
  '#6F4AA3',
] as const

/** Jaune soleil — kickers de section. */
export const kickerYellow = '#FBBB50'

export type SportKey =
  | 'swimming'
  | 'running'
  | 'volleyball'
  | 'badminton'
  | 'basketball'
  | 'football'
  | 'squash'
  | 'tableTennis'

/**
 * Un sport = UNE bande du soleil.
 * `base` : pastilles, points, jauges, marqueurs, coches (aplats).
 * `onCold` : version éclaircie, pour le TEXTE posé sur verre froid ou marine.
 *            Toujours accompagnée de `textShadow.colored`.
 */
export const sportAccents: Record<SportKey, { base: string; onCold: string }> =
  {
    swimming: { base: '#02ADB8', onCold: '#8FE3EA' },
    running: { base: '#FB8B36', onCold: '#FFC79A' },
    volleyball: { base: '#F32988', onCold: '#FF9CC2' },
    badminton: { base: '#FBBB50', onCold: '#FFD9A0' },
    basketball: { base: '#FB557D', onCold: '#FFA8BE' },
    football: { base: '#8FC9B7', onCold: '#BFE6D9' },
    squash: { base: '#6F4AA3', onCold: '#C2A7E0' },
    tableTennis: { base: '#006691', onCold: '#8FD0E8' },
  }

/** Pattern de programme retenu par sport (voir README, section « Programme »). */
export const sportProgramPattern: Record<SportKey, 1 | 2 | 3 | 4> = {
  swimming: 1,
  running: 1,
  squash: 1,
  badminton: 2,
  volleyball: 2,
  basketball: 2,
  football: 3,
  tableTennis: 3,
  // Pattern 4 (« maintenant ») n'est pas un choix de sport :
  // il se substitue au pattern du sport le jour J.
}

export const fonts = {
  display: "'Bebas Neue', sans-serif",
  text: 'Quicksand, sans-serif',
  mono: 'ui-monospace, Menlo, monospace', // méta techniques uniquement
} as const

/** Bebas Neue, font-weight 400. [desktop, mobile] en px. */
export const display = {
  page: { size: [120, 64], lineHeight: 0.9 },
  figure: { size: [92, 52], lineHeight: 0.92 },
  section: { size: [62, 40], lineHeight: 1 },
  card: { size: [34, 28], lineHeight: 1 },
  time: { size: [32, 26], lineHeight: 1 },
  kicker: {
    size: [18, 15],
    lineHeight: 1,
    letterSpacing: '.2em',
    uppercase: true,
  },
} as const

/**
 * Quicksand.
 *
 * GRAISSE PASSÉE DE 500 À 600 POUR LE CHAPEAU ET LE CORPS, décision de Quentin
 * du 15 septembre 2026. À 500, Quicksand est trop fine pour être lue
 * confortablement, en particulier sur les cartes de verre et sur les fonds
 * colorés. Les méta restaient déjà à 600 ; les libellés restent à 700.
 */
export const text = {
  lead: { weight: 600, size: 17, lineHeight: 1.5 },
  body: { weight: 600, size: 16, lineHeight: 1.45 },
  label: { weight: 700, size: 15 },
  meta: { weight: 600, size: 13, opacity: 0.65 },
} as const

/**
 * L'ombre de texte selon le fond, décision du 15 septembre 2026.
 *
 * Sans ombre, le texte paraît posé à plat sur des fonds riches — dégradé, verre,
 * affiche — et perd en lisibilité. UNE SEULE valeur ne convient pas partout :
 *
 * - `surClair`   : texte marine sur le ciel, le sable ou le verre clair. Un
 *                  liseré clair d'un pixel détache la lettre du fond ; une ombre
 *                  sombre, sous un texte sombre, le salirait.
 * - `surCouleur` : texte clair sur le verre froid, le verre marine, la nuit.
 * - `surAffiche` : texte clair sur une photo ou une affiche, dont le détail
 *                  impose une ombre plus marquée.
 * - `bouton`     : texte blanc sur un bouton plein.
 *
 * Elles restent DISCRÈTES par principe : l'ombre doit donner de la profondeur,
 * pas se voir.
 *
 * Ces valeurs passent par la variable CSS `--ombre-texte`, posée par chaque
 * conteneur (layout, carte de verre, affiche) et lue par les composants de
 * typographie. Un texte hérite ainsi de l'ombre de son fond sans qu'on la
 * choisisse à chaque usage.
 */
export const ombreTexte = {
  surClair: '0 1px 0 rgba(255,255,255,.55)',
  surCouleur: '0 1px 2px rgba(0,30,60,.35), 0 2px 10px rgba(0,30,60,.2)',
  surAffiche: '0 1px 2px rgba(0,20,50,.55), 0 2px 16px rgba(0,20,50,.35)',
  bouton: '0 1px 1px rgba(0,0,0,.22)',
} as const

/** La propriété à lire dans tout composant de texte. */
export const OMBRE = 'var(--ombre-texte, none)'

export const textShadow = {
  /** Tout texte blanc posé sur verre froid. */
  onCold: '0 1px 2px rgba(0,50,70,.3)',
  /** Tout texte COLORÉ (accent) posé sur verre froid ou marine. Obligatoire. */
  colored: '0 1px 2px rgba(0,30,50,.35)',
  /** Titres de section blancs posés directement sur le fond. */
  onBackground: '0 2px 10px rgba(0,50,80,.35)',
} as const

/** Verre — 3 niveaux. Jamais deux verres superposés. */
export const glass = {
  clear: {
    background: 'rgba(255,255,255,.36)',
    backdropFilter: 'blur(30px) saturate(1.5)',
    border: '1px solid rgba(255,255,255,.62)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,.8), 0 40px 80px -30px rgba(3,37,101,.35)',
    color: colors.marine,
  },
  cold: {
    background: 'rgba(255,255,255,.20)',
    backdropFilter: 'blur(26px) saturate(1.5)',
    border: '1px solid rgba(255,255,255,.50)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,.7), 0 40px 80px -30px rgba(0,40,70,.5)',
    color: '#fff',
  },
  navy: {
    background: 'rgba(3,37,101,.45)',
    backdropFilter: 'blur(30px) saturate(1.4)',
    border: '1px solid rgba(255,255,255,.34)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,.4), 0 50px 90px -30px rgba(0,20,50,.6)',
    color: '#fff',
  },
} as const

export const radii = {
  chipMobile: 16,
  small: 22, // petites cartes, cadre d'icône 76
  tile: 26,
  card: 32,
  pill: 999,
} as const

export const space = [8, 12, 16, 20, 28, 40, 64] as const

export const layout = {
  gutter: { desktop: 60, mobile: 20 },
  betweenCards: { desktop: 40, mobile: 16 },
  cardPadding: { desktop: '36px 40px', mobile: '20px 22px' },
  betweenSections: { desktop: 96, mobile: 48 },
  maxWidth: 1320,
  touchTarget: 48,
} as const

/** Bouton flat 3D : socle 5px au repos, 2px au survol (+ translateY(3px)). */
export const buttons = {
  heights: { primary: 52, inCard: 48, header: 44 },
  radius: radii.pill,
  padding: '0 26px',
  font: { weight: 700, size: 16, family: fonts.text },
  variants: {
    marine: {
      background: colors.marine,
      color: '#fff',
      rest: `0 5px 0 ${colors.marineDeep}, 0 18px 30px -12px rgba(3,37,101,.6)`,
      hover: `0 2px 0 ${colors.marineDeep}, 0 10px 18px -10px rgba(3,37,101,.6)`,
    },
    corail: {
      background: colors.corail,
      color: '#fff',
      rest: `0 5px 0 ${colors.corailDeep}, 0 18px 30px -12px rgba(201,74,67,.6)`,
      hover: `0 2px 0 ${colors.corailDeep}, 0 10px 18px -10px rgba(201,74,67,.6)`,
    },
    blanc: {
      background: '#fff',
      color: colors.marine,
      rest: `0 5px 0 ${colors.blancSocle}, 0 18px 30px -12px rgba(0,0,0,.35)`,
      hover: `0 2px 0 ${colors.blancSocle}`,
    },
    glass: {
      background: 'rgba(255,255,255,.3)',
      backdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,.65)',
      color: '#fff',
      rest: 'inset 0 1px 0 rgba(255,255,255,.7)',
      hoverBackground: 'rgba(255,255,255,.45)',
    },
    disabled: {
      background: 'rgba(255,255,255,.18)',
      border: '1px solid rgba(255,255,255,.3)',
      color: 'rgba(255,255,255,.55)',
    },
  },
  transition: 'transform 120ms ease-out, box-shadow 120ms ease-out',
} as const

/** Cadre d'icône sport : rayon = 29 % du côté. */
export const sportIconFrame = {
  sizes: [76, 56, 40] as const,
  radiusRatio: 0.29,
  gloss:
    'linear-gradient(160deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,.08) 45%, rgba(255,255,255,0) 60%)',
  shadow: {
    76: '0 12px 20px -10px rgba(0,40,70,.55), inset 0 -6px 12px rgba(3,37,101,.18), inset 0 2px 0 rgba(255,255,255,.7)',
    56: '0 10px 16px -8px rgba(0,40,70,.55), inset 0 -5px 10px rgba(3,37,101,.18), inset 0 2px 0 rgba(255,255,255,.7)',
    40: '0 8px 14px -8px rgba(0,40,70,.55), inset 0 2px 0 rgba(255,255,255,.7)',
  },
} as const

/** Fond continu — UNE seule règle pour tout le site, montée dans le layout. */
export const pageBackground =
  'linear-gradient(180deg,' +
  '#CE8A88 0%, #DFA59A 8%, #E2D2BB 18%, #E8D8C5 26%,' +
  '#EDE0D1 34%, #DCD8C6 44%, #89CABF 56%, #2399A9 68%,' +
  '#0E5F80 80%, #2F6B4F 90%, #323379 100%)'

export const sunGlow = {
  width: 1100,
  height: 1100,
  top: 120,
  background:
    'radial-gradient(circle, rgba(255,215,170,.6) 0%, rgba(255,215,170,0) 60%)',
} as const

/** Vagues, en bas de page seulement. */
export const waves = {
  opacity: 0.4,
  width: '90%',
  height: 30,
  durations: ['40s', '30s'] as const,
  bottoms: [74, 38] as const,
} as const

/** Pastille d'heure (programme). */
export const timeBadge = {
  height: 44,
  padding: '0 16px',
  radius: 14,
  fontSize: 30,
  states: {
    highlight: {
      background: '#fff',
      color: colors.marine,
      socle: '0 4px 0 rgba(3,37,101,.35)',
    },
    anchor: {
      background: colors.marine,
      color: '#fff',
      socle: `0 4px 0 ${colors.marineDeep}`,
    },
    now: {
      background: colors.corail,
      color: '#fff',
      socle: `0 4px 0 ${colors.corailDeep}`,
    },
    pause: {
      background: 'rgba(255,255,255,.22)',
      border: '1px solid rgba(255,255,255,.45)',
      color: '#fff',
      opacity: 0.7,
    },
  },
} as const

/** Édition 2027. Montants et date limite À CONFIRMER avant mise en ligne. */
export const edition = {
  year: 2027,
  number: 6,
  dates: { from: '2027-08-27', to: '2027-08-29' },
  pricing: {
    oneSport: 25,
    twoSports: 35,
    party: 12,
    currency: '€',
    confirmed: false,
  },
  registrationDeadline: { date: '2027-08-10', confirmed: false },
  partyTime: '22h',
} as const
