import type { ConfigurationOrganisation } from './organisation.ts'

// Application installée (ADR 0023) : le manifest d'une organisation. Ce module
// est pur ; il n'importe ni Prisma ni l'environnement.

/** Nom de fichier d'un manifest : le slug de l'organisation et son extension. */
const FICHIER_MANIFEST = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.webmanifest$/

/**
 * Icône de Relaytour livrée avec l'espace organisateur. Elle sert tant que
 * l'organisation n'a pas déclaré son icône d'application.
 */
const ICONE_PAR_DEFAUT = '/icon.png'

/** L'adresse du manifest d'une organisation, sous `/medias/` : aucun réglage de proxy. */
export function cheminManifest(slug: string): string {
  return `/medias/application/${encodeURIComponent(slug)}.webmanifest`
}

/** Le slug que désigne un nom de fichier de manifest, ou null. */
export function slugDuManifest(fichier: string): string | null {
  return FICHIER_MANIFEST.exec(fichier)?.[1] ?? null
}

/** L'adresse d'ouverture de l'application : elle désigne l'organisation. */
export function adresseOuverture(slug: string): string {
  return `/?organisation=${encodeURIComponent(slug)}`
}

export interface ManifestApplication {
  id: string
  name: string
  short_name: string
  description: string
  lang: string
  start_url: string
  scope: string
  display: 'standalone'
  theme_color: string
  background_color: string
  icons: { src: string; sizes: string; type: string; purpose: 'any' }[]
}

/**
 * Le manifest d'une organisation : il ne porte que des champs de son identité
 * publique (ADR 0006). `id` et `start_url` désignent l'organisation, pour qu'une
 * installation à plusieurs organisations donne une application par organisation.
 */
export function manifestApplication(
  c: Pick<
    ConfigurationOrganisation,
    'slug' | 'nom' | 'nomCourt' | 'theme' | 'iconeApplicationUrl'
  >
): ManifestApplication {
  const ouverture = adresseOuverture(c.slug)
  return {
    id: ouverture,
    name: c.nom,
    short_name: c.nomCourt,
    description: `Espace organisateur · ${c.nom}`,
    lang: 'fr',
    start_url: ouverture,
    scope: '/',
    display: 'standalone',
    theme_color: c.theme.couleurs.primaire,
    background_color: c.theme.couleurs.sol1,
    icons: [
      {
        src: c.iconeApplicationUrl ?? ICONE_PAR_DEFAUT,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
