import { ApolloProvider } from '@apollo/client/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { themeParDefaut } from '@relaytour/tokens'
import { App as AntdApp, ConfigProvider } from 'antd'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './polices'
import './global.css'
import Application from './App'
import HorsConnexion from './composants/HorsConnexion'
import { apollo } from './lib/apollo'
import { enregistrerServiceWorker } from './lib/application'
import { localeAntd } from './lib/langue'
import { OrganisationProvider } from './composants/OrganisationProvider'
import { appliquerTheme, construireTheme } from './lib/theme'

// Le thème par défaut s'applique avant le premier rendu : aucun éclair de couleurs
// de repli. Le thème de l'organisation, servi par l'API, le remplace dès sa réponse.
appliquerTheme(themeParDefaut)

enregistrerServiceWorker()

// Ouverte sans réseau, l'application n'affiche que l'écran « Hors connexion »
// (ADR 0023) : elle ne garde ni tâche ni fiche, et l'identité de l'organisation vient
// de l'API. Le thème de Relaytour sert alors de repli.
const racine = createRoot(document.getElementById('racine')!)
if (navigator.onLine) {
  racine.render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <ApolloProvider client={apollo}>
          <OrganisationProvider>
            <AntdApp>
              <Application />
            </AntdApp>
          </OrganisationProvider>
        </ApolloProvider>
      </I18nProvider>
    </StrictMode>
  )
} else {
  racine.render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <ConfigProvider
          locale={localeAntd()}
          theme={construireTheme(themeParDefaut)}
        >
          <HorsConnexion />
        </ConfigProvider>
      </I18nProvider>
    </StrictMode>
  )
}
