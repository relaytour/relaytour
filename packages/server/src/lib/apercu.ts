import { LANGUE_SOURCE } from '@relaytour/commun'

import { avecLangue, i18n } from './langue.ts'
import type { ConfigurationOrganisation } from './organisation.ts'

// Aperçu d'un lien partagé (ADR 0073). Une messagerie lit les balises Open Graph
// de la page sans exécuter de script : le serveur les écrit dans index.html avant
// de le servir. Ce module est pur ; il n'importe ni Prisma ni l'environnement.

const DEBUT = '<!-- apercu:debut -->'
const FIN = '<!-- apercu:fin -->'

/** Image livrée avec l'espace organisateur : le logo et l'adresse de Relaytour. */
export const IMAGE_APERCU_PAR_DEFAUT = '/apercu.jpg'

export interface ReglagesApercu {
  /** Nom du site affiché par la messagerie (`og:site_name`). */
  nomSite: string | undefined
  /** Description qui remplace celle de Relaytour. */
  description: string | undefined
  /** Adresse https ou chemin de l'espace organisateur. */
  image: string | undefined
  /** Origine de l'espace organisateur, qui complète un chemin d'image. */
  origineOrga: string
}

export interface Apercu {
  langue: string
  titre: string
  description: string
  nomSite: string
  image: string
}

function echapper(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * L'aperçu d'une page de l'espace organisateur. `organisation` vaut null quand
 * la page ne désigne aucune organisation : l'aperçu ne nomme alors personne. Il
 * ne porte que le nom public de l'organisation, jamais le contenu d'une page.
 */
export function apercu(
  organisation: Pick<ConfigurationOrganisation, 'nom' | 'langue'> | null,
  reglages: ReglagesApercu
): Apercu {
  const langue = organisation?.langue ?? LANGUE_SOURCE
  const image = reglages.image ?? IMAGE_APERCU_PAR_DEFAUT
  return avecLangue(langue, () => ({
    langue,
    titre:
      organisation === null
        ? i18n._('Espace organisateur')
        : i18n._('Espace organisateur · {nom}', { nom: organisation.nom }),
    description:
      reglages.description ??
      (organisation === null
        ? i18n._(
            'Les équipes d’une organisation préparent ici leurs activités avec Relaytour, logiciel libre présenté sur relaytour.org.'
          )
        : i18n._(
            'Les équipes de l’organisation {nom} préparent ici leurs activités avec Relaytour, logiciel libre présenté sur relaytour.org.',
            { nom: organisation.nom }
          )),
    nomSite: reglages.nomSite ?? 'Relaytour',
    image: image.startsWith('/') ? `${reglages.origineOrga}${image}` : image,
  }))
}

/** Les balises de l'aperçu, échappées, qui remplacent le bloc de la page. */
export function balisesApercu(a: Apercu): string {
  const meta = (attribut: 'name' | 'property', cle: string, valeur: string) =>
    `<meta ${attribut}="${cle}" content="${echapper(valeur)}" />`
  return [
    `<title>${echapper(a.titre)}</title>`,
    meta('name', 'description', a.description),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', a.nomSite),
    meta('property', 'og:title', a.titre),
    meta('property', 'og:description', a.description),
    meta('property', 'og:locale', a.langue === 'en' ? 'en_US' : 'fr_FR'),
    meta('property', 'og:image', a.image),
    // Les dimensions ne valent que pour l'image livrée : une image de
    // l'hébergeur garde les siennes, que la messagerie lit elle-même.
    ...(a.image.endsWith(IMAGE_APERCU_PAR_DEFAUT)
      ? [
          meta('property', 'og:image:width', '1200'),
          meta('property', 'og:image:height', '630'),
        ]
      : []),
    meta('name', 'twitter:card', 'summary_large_image'),
  ].join('\n    ')
}

/**
 * La page avec l'aperçu à la place du bloc fixe, et sa langue. Rend null si la
 * page ne porte pas le bloc : le serveur ne sert jamais une page qu'il ne
 * reconnaît pas.
 */
export function pageAvecApercu(page: string, a: Apercu): string | null {
  const debut = page.indexOf(DEBUT)
  const fin = page.indexOf(FIN)
  if (debut === -1 || fin === -1 || fin < debut) return null
  return (
    page
      .slice(0, debut + DEBUT.length)
      .replace(/<html lang="[a-z-]+"/, `<html lang="${a.langue}"`) +
    '\n    ' +
    balisesApercu(a) +
    '\n    ' +
    page.slice(fin)
  )
}
