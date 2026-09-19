import { ApolloProvider } from '@apollo/client/react'
import { themeParDefaut } from '@relaytour/tokens'
import { App as AntdApp } from 'antd'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './polices'
import './global.css'
import Application from './App'
import { apollo } from './lib/apollo'
import { OrganisationProvider } from './composants/OrganisationProvider'
import { appliquerTheme } from './lib/theme'

// Le thème par défaut s'applique avant le premier rendu : aucun éclair de couleurs
// de repli. Le thème de l'organisation, servi par l'API, le remplace dès sa réponse.
appliquerTheme(themeParDefaut)

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <ApolloProvider client={apollo}>
      <OrganisationProvider>
        <AntdApp>
          <Application />
        </AntdApp>
      </OrganisationProvider>
    </ApolloProvider>
  </StrictMode>
)
