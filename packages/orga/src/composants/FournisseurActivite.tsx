import { useApolloClient, useQuery } from '@apollo/client/react'
import { Result, Spin } from 'antd'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'

import {
  activiteParDefaut,
  construireContexte,
  ContexteActivite,
} from '../lib/activite'
import { ACTIVITES } from '../lib/requetes'
import { activiteAffichee, afficherActivite } from '../lib/selection'

// Premiers segments des adresses d'avant l'ADR 0008, sans activité : une adresse
// comme /fiches ou /admin/postes mène à la même page de l'activité par défaut.
const PAGES = new Set([
  'admin',
  'fiches',
  'perimetres',
  'preferences',
  'retroplanning',
])

function AucuneActivite() {
  return (
    <Result
      status="info"
      title="Cette organisation n’a encore aucune activité."
      subTitle="Un admin de l’organisation crée la première activité, ou l’import du dépôt d’organisation la crée."
    />
  )
}

/**
 * Mène une adresse sans activité (l'accueil, une adresse d'avant l'ADR 0008, un
 * lien de mail) vers la même page de l'activité par défaut.
 */
export function VersActivite() {
  const { data, loading } = useQuery(ACTIVITES)
  const { pathname, search, hash } = useLocation()
  if (loading) return <Spin fullscreen description="Chargement" />
  const cible = activiteParDefaut(data?.activites ?? [])
  if (cible === undefined) return <AucuneActivite />
  const suite = pathname === '/' ? '/' : pathname
  return <Navigate to={`/${cible.slug}${suite}${search}${hash}`} replace />
}

/**
 * Fournit l'activité de l'adresse /<slug>/ aux écrans. Elle part en en-tête des
 * requêtes ; un changement d'activité vide le cache, pour ne jamais afficher les
 * données d'une autre activité.
 */
export default function FournisseurActivite({
  children,
}: {
  children: ReactNode
}) {
  const apollo = useApolloClient()
  const { activite: slug = '' } = useParams()
  const { pathname, search, hash } = useLocation()
  const { data, loading } = useQuery(ACTIVITES)
  const activites = useMemo(() => data?.activites ?? [], [data])
  const trouvee = activites.find(a => a.slug === slug)

  // L'en-tête suit l'adresse avant le premier rendu des écrans : leurs requêtes
  // partent déjà pour la bonne activité.
  const precedente = useRef(activiteAffichee())
  if (trouvee !== undefined && activiteAffichee() !== trouvee.slug) {
    afficherActivite(trouvee.slug)
  }
  useEffect(() => {
    if (trouvee === undefined) return
    if (precedente.current !== null && precedente.current !== trouvee.slug) {
      void apollo.resetStore()
    }
    precedente.current = trouvee.slug
  }, [trouvee, apollo])

  const valeur = useMemo(
    () =>
      trouvee === undefined ? null : construireContexte(trouvee, activites),
    [trouvee, activites]
  )

  if (loading && data === undefined) {
    return <Spin fullscreen description="Chargement" />
  }
  if (valeur === null) {
    const cible = activiteParDefaut(activites)
    if (cible === undefined) return <AucuneActivite />
    // Une adresse d'avant l'ADR 0008 garde sa page ; une activité inconnue mène à
    // l'accueil de l'activité par défaut.
    const suite = PAGES.has(slug) ? pathname : '/'
    return (
      <Navigate
        to={`/${cible.slug}${suite}${PAGES.has(slug) ? search + hash : ''}`}
        replace
      />
    )
  }
  return (
    <ContexteActivite.Provider value={valeur}>
      {children}
    </ContexteActivite.Provider>
  )
}
