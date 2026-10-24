import { i18n, type Messages } from '@lingui/core'
import enUS from 'antd/locale/en_US'
import frFR from 'antd/locale/fr_FR'
import type { Locale } from 'antd/es/locale'

import { messages as messagesFr } from '../locales/fr/messages.po'

/**
 * Langue de l'interface (ADR 0047).
 *
 * Ce module tient la langue active, ses catalogues, la locale d'antd, les formats
 * de date et l'ordre de tri. Aucun autre module n'écrit `'fr-FR'` ni `'fr'` en dur :
 * il lit la langue ici, pour qu'un changement de langue touche tout l'écran.
 */

export const LANGUES = ['fr', 'en'] as const
export type Langue = (typeof LANGUES)[number]
export const LANGUE_SOURCE: Langue = 'fr'

/** Nom de chaque langue, écrit dans cette langue, pour le sélecteur. */
export const NOMS_DES_LANGUES: Record<Langue, string> = {
  fr: 'Français',
  en: 'English',
}

// Le français est chargé d'avance : c'est la langue source et le repli. Les autres
// catalogues se chargent à la demande, pour ne pas alourdir le premier chargement.
const CHARGEURS: Record<
  Exclude<Langue, 'fr'>,
  () => Promise<{ messages: Messages }>
> = { en: () => import('../locales/en/messages.po') }

const LOCALES_ANTD: Record<Langue, Locale> = { fr: frFR, en: enUS }

const chargees = new Set<Langue>([LANGUE_SOURCE])

// Activée dès l'import : les modules lus hors de React trouvent une langue.
i18n.load(LANGUE_SOURCE, messagesFr)
i18n.activate(LANGUE_SOURCE)

export function estUneLangue(valeur: string): valeur is Langue {
  return (LANGUES as readonly string[]).includes(valeur)
}

/**
 * Première langue connue d'une liste de préférences, comme `navigator.languages`.
 * Une balise régionale vaut sa langue : `en-GB` donne `en`.
 */
export function resoudreLangue(
  preferences: readonly (string | null | undefined)[]
): Langue {
  for (const preference of preferences) {
    if (!preference) continue
    const langue = preference.toLowerCase().split(/[-_]/)[0]!
    if (estUneLangue(langue)) return langue
  }
  return LANGUE_SOURCE
}

export function langueActive(): Langue {
  const langue = i18n.locale
  return estUneLangue(langue) ? langue : LANGUE_SOURCE
}

/** Charge le catalogue d'une langue s'il manque, puis l'active. */
export async function activerLangue(langue: Langue): Promise<void> {
  if (langue === langueActive()) return
  if (langue !== 'fr' && !chargees.has(langue)) {
    const { messages } = await CHARGEURS[langue]()
    i18n.load(langue, messages)
    chargees.add(langue)
  }
  i18n.activate(langue)
  document.documentElement.lang = langue
}

export function localeAntd(langue: Langue = langueActive()): Locale {
  return LOCALES_ANTD[langue]
}

const formats = new Map<string, Intl.DateTimeFormat>()

/** Format de date de la langue active, gardé en cache par langue et par options. */
export function formatDate(
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const cle = `${langueActive()}|${JSON.stringify(options)}`
  let format = formats.get(cle)
  if (format === undefined) {
    format = new Intl.DateTimeFormat(langueActive(), options)
    formats.set(cle, format)
  }
  return format
}

const comparateurs = new Map<string, Intl.Collator>()

/** Comparateur de textes de la langue active, gardé en cache par options. */
export function comparateur(options?: Intl.CollatorOptions): Intl.Collator {
  const cle = `${langueActive()}|${JSON.stringify(options ?? {})}`
  let collator = comparateurs.get(cle)
  if (collator === undefined) {
    collator = new Intl.Collator(langueActive(), options)
    comparateurs.set(cle, collator)
  }
  return collator
}

/** Ordre alphabétique de la langue active, pour `Array.prototype.sort`. */
export function comparerTextes(a: string, b: string): number {
  return comparateur().compare(a, b)
}

/** Met la première lettre en majuscule, selon les règles de la langue active. */
export function majusculeInitiale(texte: string): string {
  return texte.charAt(0).toLocaleUpperCase(langueActive()) + texte.slice(1)
}
