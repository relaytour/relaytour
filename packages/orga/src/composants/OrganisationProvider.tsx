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
import {
  activerLangue,
  estUneLangue,
  langueDeLaSession,
  langueDuVisiteur,
  localeAntd,
} from '../lib/langue'
import { LANGUE_DE_MOI } from '../lib/requetes'
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
  // Sans session, `moi` vaut null : le visiteur reçoit la langue de son navigateur.
  const session = useQuery(LANGUE_DE_MOI)

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
      langue: o.langue ?? null,
      codeSource: o.codeSource,
      modesDEmploi: o.modesDEmploi,
      support: o.support ?? null,
      theme: themeDepuisApi(o.theme),
    }
  }, [data])

  const moi = session.data?.moi
  const langue = moi
    ? langueDeLaSession(moi.langue, organisation.langue)
    : langueDuVisiteur(organisation.langue)
  useEffect(() => {
    void activerLangue(langue)
  }, [langue])

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
        {(loading && !data) || (session.loading && !session.data) ? (
          <Spin fullscreen />
        ) : (
          children
        )}
      </ContexteOrganisation.Provider>
    </ConfigProvider>
  )
}
