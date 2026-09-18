import { ApolloProvider } from '@apollo/client/react'
import { themeParDefaut } from '@relaytour/tokens'
import { App as AntdApp, ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './polices'
import './global.css'
import Application from './App'
import { apollo } from './lib/apollo'
import { appliquerTheme, construireTheme } from './lib/theme'

// Le thème s'applique avant le premier rendu : aucun éclair de couleurs de repli.
// Le thème de l'organisation, servi par l'API, remplacera cet appel (ADR 0006).
appliquerTheme(themeParDefaut)

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <ApolloProvider client={apollo}>
      <ConfigProvider locale={frFR} theme={construireTheme(themeParDefaut)}>
        <AntdApp>
          <Application />
        </AntdApp>
      </ConfigProvider>
    </ApolloProvider>
  </StrictMode>
)
