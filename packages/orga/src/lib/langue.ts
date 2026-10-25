import { i18n, type Messages } from '@lingui/core'
import {
  estUneLangue,
  LANGUE_SOURCE,
  LANGUES,
  resoudreLangue,
  type Langue,
} from '@relaytour/commun'
import enUS from 'antd/locale/en_US'
import frFR from 'antd/locale/fr_FR'
import type { Locale } from 'antd/es/locale'

import etatDesCatalogues from '../locales/etat.json'
import { messages as messagesFr } from '../locales/fr/messages.po'

/**
 * Langue de l'interface (ADR 0047).
 *
 * Ce module tient la langue active, ses catalogues, la locale d'antd, les formats
 * de date et l'ordre de tri. Aucun autre module n'écrit `'fr-FR'` ni `'fr'` en dur :
 * il lit la langue ici, pour qu'un changement de langue touche tout l'écran.
 */

export {
  estUneLangue,
  LANGUE_SOURCE,
  LANGUES,
  resoudreLangue,
  type Langue,
} from '@relaytour/commun'

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

/**
 * Taux de traduction à partir duquel une langue se propose (ADR 0047). La même
 * valeur vaut dans `outils/langues.mjs`, qui écrit `locales/etat.json`.
 */
const SEUIL = 90

/** Les langues proposées : la langue source, et celles traduites à SEUIL % au moins. */
export const LANGUES_PROPOSEES: readonly Langue[] = LANGUES.filter(langue => {
  if (langue === LANGUE_SOURCE) return true
  const etat = (
    etatDesCatalogues as Record<string, { messages: number; traduits: number }>
  )[langue]
  return (
    etat !== undefined &&
    etat.messages > 0 &&
    etat.traduits * 100 >= etat.messages * SEUIL
  )
})

/** Première langue proposée d'une liste de préférences, sinon le français. */
function premiereProposee(preferences: readonly (string | null | undefined)[]) {
  const proposees = preferences.filter(
    p => !!p && LANGUES_PROPOSEES.includes(resoudreLangue([p]))
  )
  return resoudreLangue(proposees)
}

/**
 * Langue d'une personne connectée : son choix, sinon la langue de l'organisation,
 * sinon le français (ADR 0047).
 */
export function langueDeLaSession(
  choix: string | null | undefined,
  langueOrganisation: string | null | undefined
): Langue {
  return premiereProposee([choix, langueOrganisation])
}

/**
 * Langue d'un visiteur sans session (connexion, formulaire public, espace
 * bénévole) : la langue de son navigateur, sinon celle de l'organisation.
 */
export function langueDuVisiteur(
  langueOrganisation: string | null | undefined,
  navigateur: readonly string[] = globalThis.navigator?.languages ?? []
): Langue {
  return premiereProposee([...navigateur, langueOrganisation])
}

const LOCALES_ANTD: Record<Langue, Locale> = { fr: frFR, en: enUS }

const chargees = new Set<Langue>([LANGUE_SOURCE])

// Activée dès l'import : les modules lus hors de React trouvent une langue.
i18n.load(LANGUE_SOURCE, messagesFr)
i18n.activate(LANGUE_SOURCE)

export function langueActive(): Langue {
  const langue = i18n.locale
  return estUneLangue(langue) ? langue : LANGUE_SOURCE
}

// La dernière langue demandée. Deux demandes rapprochées chargent chacune leur
// catalogue : seule la plus récente s'active, quel que soit l'ordre des chargements.
let demandee: Langue = LANGUE_SOURCE

/** Charge le catalogue d'une langue s'il manque, puis l'active. */
export async function activerLangue(langue: Langue): Promise<void> {
  demandee = langue
  if (langue !== 'fr' && !chargees.has(langue)) {
    const { messages } = await CHARGEURS[langue]()
    i18n.load(langue, messages)
    chargees.add(langue)
  }
  if (demandee !== langue || langue === langueActive()) return
  i18n.activate(langue)
  if (typeof document !== 'undefined') document.documentElement.lang = langue
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
