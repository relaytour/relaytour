import {
  contraste,
  rayons,
  rgb,
  texteSurCouleur,
  variablesCss,
  type Theme,
} from '@relaytour/tokens'
import type { ThemeConfig } from 'antd'

/**
 * Pose les variables CSS du thème sur `:root`. Appelé avant le premier rendu
 * pour que le sol et les surfaces aient leurs couleurs dès le premier pixel.
 */
export function appliquerTheme(theme: Theme): void {
  const racine = document.documentElement
  for (const [nom, valeur] of Object.entries(variablesCss(theme))) {
    racine.style.setProperty(nom, valeur)
  }
}

/**
 * Configuration Ant Design construite depuis le thème. Le verre n'est pas un
 * jeton antd : `global.css` le pose sur le corps, la Coquille et les conteneurs.
 * ConfigProvider ne reçoit que la palette, les polices et les rayons.
 */
export function construireTheme(theme: Theme): ThemeConfig {
  const c = theme.couleurs
  const encre = rgb(c.encre)
  return {
    token: {
      colorPrimary: c.primaire,
      colorLink: c.primaire,
      colorText: c.encre,
      colorTextSecondary: `rgba(${encre}, 0.78)`,
      colorTextTertiary: `rgba(${encre}, 0.64)`,
      colorTextQuaternary: `rgba(${encre}, 0.38)`,
      colorError: c.erreur,
      colorSuccess: c.succes,
      colorWarning: c.alerte,
      colorBgLayout: 'transparent',
      colorBgContainer: 'rgba(255, 255, 255, 0.62)',
      colorBgElevated: 'rgba(255, 255, 255, 0.9)',
      colorBorder: `rgba(${encre}, 0.12)`,
      colorBorderSecondary: `rgba(${encre}, 0.07)`,
      colorFillSecondary: `rgba(${encre}, 0.07)`,
      fontFamily: theme.polices.texte,
      fontFamilyCode: theme.polices.mono,
      fontSize: 15,
      borderRadius: rayons.champ,
      borderRadiusSM: 8,
      borderRadiusLG: rayons.carte,
      boxShadow: `0 8px 30px rgba(${encre}, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.85)`,
      boxShadowSecondary: `0 20px 56px rgba(${encre}, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.85)`,
      controlHeight: 40,
      motionEaseOut: 'cubic-bezier(0.32, 0.72, 0, 1)',
      motionDurationMid: '0.24s',
    },
    components: {
      Menu: {
        itemBg: 'transparent',
        itemSelectedBg: c.encre,
        itemSelectedColor: '#ffffff',
        itemHoverBg: `rgba(${encre}, 0.07)`,
        itemBorderRadius: rayons.chip,
        itemHeight: 42,
        itemMarginInline: 0,
        itemMarginBlock: 3,
        groupTitleFontSize: 11,
        iconSize: 16,
      },
      Button: {
        borderRadius: rayons.pilule,
        borderRadiusLG: rayons.pilule,
        borderRadiusSM: rayons.pilule,
        fontWeight: 600,
        primaryShadow: `0 6px 18px rgba(${rgb(c.primaire)}, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.25)`,
        defaultShadow: `0 2px 10px rgba(${encre}, 0.05), 0 6px 18px rgba(${encre}, 0.045)`,
        // Un bouton sans fond plein garde un liseré de verre pour se lire comme
        // cliquable ; le survol assombrit légèrement son fond (docs/identite.md).
        defaultBg: 'rgba(255, 255, 255, 0.7)',
        defaultBorderColor: `rgba(${encre}, 0.14)`,
        defaultColor: c.encre,
        defaultHoverBg: `rgba(${encre}, 0.07)`,
        defaultHoverBorderColor: `rgba(${encre}, 0.22)`,
        defaultHoverColor: c.encre,
        defaultActiveBg: `rgba(${encre}, 0.12)`,
        defaultActiveBorderColor: `rgba(${encre}, 0.28)`,
        defaultActiveColor: c.encre,
      },
      Card: {
        borderRadiusLG: rayons.panneau,
        colorBorderSecondary: 'transparent',
      },
      Drawer: { colorBgElevated: 'transparent' },
      Modal: { borderRadiusLG: rayons.panneau, contentBg: 'transparent' },
      Table: {
        headerBg: c.primaireClair,
        borderColor: `rgba(${encre}, 0.07)`,
        headerBorderRadius: rayons.chip,
      },
      Tag: { borderRadiusSM: rayons.pilule, defaultBg: `rgba(${encre}, 0.07)` },
      Input: {
        colorBgContainer: 'rgba(255, 255, 255, 0.55)',
        activeShadow: `0 0 0 4px rgba(${encre}, 0.12)`,
      },
      Select: { colorBgContainer: 'rgba(255, 255, 255, 0.55)' },
      Progress: {
        defaultColor: c.primaire,
        remainingColor: `rgba(${encre}, 0.07)`,
      },
    },
  }
}

/**
 * Le texte le plus lisible sur une couleur pleine : blanc ou presque noir, au
 * meilleur contraste perçu (APCA). La formule WCAG 2 choisissait le noir sur
 * les teintes saturées moyennes, où il se lit mal.
 */
export function texteSur(fond: string): string {
  return texteSurCouleur(fond)
}

function versRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function versHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

/**
 * La couleur d'un périmètre, assombrie vers l'encre jusqu'à tenir 4,5:1 sur
 * blanc. Elle sert de texte sur le fond teinté d'une étiquette.
 */
export function teinteLisible(couleur: string, encre: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(couleur)) return encre
  const depart = versRgb(couleur)
  const arrivee = versRgb(encre)
  for (let part = 0; part <= 1; part += 0.05) {
    const melange = versHex(
      depart.map((v, i) => v + (arrivee[i]! - v) * part) as [
        number,
        number,
        number,
      ]
    )
    if (contraste(melange, '#FFFFFF') >= 4.5) return melange
  }
  return encre
}
