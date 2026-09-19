import { useQuery } from '@apollo/client/react'
import { ConfigProvider, Spin } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { useEffect, useMemo, type ReactNode } from 'react'

import {
  ContexteOrganisation,
  ORGANISATION,
  ORGANISATION_PAR_DEFAUT,
  type Organisation,
} from '../lib/organisation'
import { appliquerTheme, construireTheme } from '../lib/theme'

/**
 * Charge l'identité de l'organisation, applique son thème et construit la
 * configuration Ant Design. Tant que l'API n'a pas répondu, un voile d'attente
 * couvre l'écran ; si elle ne répond pas, le thème de Relaytour reste en place.
 */
export function OrganisationProvider({ children }: { children: ReactNode }) {
  const { data, loading } = useQuery(ORGANISATION)

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
      pageEquipe: o.pageEquipe ?? null,
      theme: {
        couleurs: o.theme.couleurs,
        fond: o.theme.fond,
        polices: o.theme.polices,
        typographie: o.theme.typographie,
      },
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
  }, [organisation])

  const theme = useMemo(
    () => construireTheme(organisation.theme),
    [organisation.theme]
  )

  return (
    <ConfigProvider locale={frFR} theme={theme}>
      <ContexteOrganisation.Provider value={organisation}>
        {loading && !data ? <Spin fullscreen /> : children}
      </ContexteOrganisation.Provider>
    </ConfigProvider>
  )
}
