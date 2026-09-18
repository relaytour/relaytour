import { ApolloProvider } from '@apollo/client/react'
import { App as AntdApp, ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './global.css'
import Application from './App'
import { apollo } from './lib/apollo'
import { theme } from './lib/theme'

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <ApolloProvider client={apollo}>
      <ConfigProvider locale={frFR} theme={theme}>
        <AntdApp>
          <Application />
        </AntdApp>
      </ConfigProvider>
    </ApolloProvider>
  </StrictMode>
)
