import { colors, fonts } from '@relaytour/tokens'
import type { ThemeConfig } from 'antd'

// Identité 2027 appliquée à un outil de travail : fond papier, texte marine,
// marine pour les actions. Le corail reste réservé à l'engagement (design system).
export const theme: ThemeConfig = {
  token: {
    colorPrimary: colors.marine,
    colorLink: colors.marine,
    colorText: colors.marine,
    colorBgLayout: colors.papier,
    colorError: colors.corailDeep,
    fontFamily: `${fonts.text}`,
    fontSize: 15,
    borderRadius: 10,
  },
  components: {
    Layout: { headerBg: colors.marine, siderBg: colors.blanc },
    Menu: { itemSelectedBg: colors.sable, itemSelectedColor: colors.marine },
    Button: { fontWeight: 700, primaryShadow: 'none' },
    Table: { headerBg: colors.sable },
  },
}
