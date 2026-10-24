import { useQuery } from '@apollo/client/react'
import { useLingui } from '@lingui/react'
import { ConfigProvider, Spin } from 'antd'
import { useEffect, useMemo, type ReactNode } from 'react'

import {
  ContexteOrganisation,
  ORGANISATION,
  ORGANISATION_PAR_DEFAUT,
  themeDepuisApi,
  type Organisation,
} from '../lib/organisation'
import { declarerApplication } from '../lib/application'
import { estUneLangue, localeAntd } from '../lib/langue'
import { organisationChoisie } from '../lib/selection'
import { appliquerTheme, construireTheme } from '../lib/theme'

/**
 * Charge l'identité de l'organisation, applique son thème et construit la
 * configuration Ant Design. Tant que l'API n'a pas répondu, un voile d'attente
 * couvre l'écran ; si elle ne répond pas, le thème de Relaytour reste en place.
 */
export function OrganisationProvider({ children }: { children: ReactNode }) {
  // La locale d'antd suit la langue active : `useLingui` rend à nouveau le
  // composant quand elle change.
  const { i18n } = useLingui()
  const locale = localeAntd(estUneLangue(i18n.locale) ? i18n.locale : undefined)
  const { data, loading } = useQuery(ORGANISATION, {
    variables: { slug: organisationChoisie() },
  })

  const organisation = useMemo<Organisation>(() => {
    if (!data) return ORGANISATION_PAR_DEFAUT
    const o = data.organisation
    return {
      slug: o.slug,
      nom: o.nom,
      sigle: o.sigle ?? null,
      nomCourt: o.sigle ?? o.nom,
      logoUrl: o.logoUrl ?? null,
      faviconUrl: o.faviconUrl ?? null,
      iconeApplicationUrl: o.iconeApplicationUrl ?? null,
      manifestUrl: o.manifestUrl,
      pageEquipe: o.pageEquipe ?? null,
      codeSource: o.codeSource,
      modesDEmploi: o.modesDEmploi,
      support: o.support ?? null,
      theme: themeDepuisApi(o.theme),
    }
  }, [data])

  useEffect(() => {
    appliquerTheme(organisation.theme)
    document.title = `${organisation.nomCourt} · Espace organisateur`
    if (organisation.faviconUrl !== null) {
      for (const lien of document.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"]'
      )) {
        lien.href = organisation.faviconUrl
      }
    }
    declarerApplication(organisation)
  }, [organisation])

  const theme = useMemo(
    () => construireTheme(organisation.theme),
    [organisation.theme]
  )

  return (
    <ConfigProvider locale={locale} theme={theme}>
      <ContexteOrganisation.Provider value={organisation}>
        {loading && !data ? <Spin fullscreen /> : children}
      </ContexteOrganisation.Provider>
    </ConfigProvider>
  )
}
