import { AsyncLocalStorage } from 'node:async_hooks'

import { setupI18n, type I18n, type Messages } from '@lingui/core'
import {
  estUneLangue,
  LANGUE_SOURCE,
  resoudreLangue,
  type Langue,
} from '@relaytour/commun'

import { messages as messagesEn } from '../locales/en/messages.ts'
import { messages as messagesFr } from '../locales/fr/messages.ts'

// Langue des textes que le serveur compose : mails, notifications, messages
// d'erreur (ADR 0047). Une requête GraphQL et un envoi du worker s'exécutent dans
// la langue de la personne concernée, posée par `avecLangue`. Hors de ce cadre,
// le français s'applique.

const CATALOGUES: Record<Langue, Messages> = { fr: messagesFr, en: messagesEn }

const instances = new Map<Langue, I18n>()

function instance(langue: Langue): I18n {
  let resultat = instances.get(langue)
  if (resultat === undefined) {
    resultat = setupI18n({
      locale: langue,
      // Un message absent du catalogue anglais se lit en français.
      messages: { [langue]: { ...CATALOGUES.fr, ...CATALOGUES[langue] } },
    })
    instances.set(langue, resultat)
  }
  return resultat
}

/**
 * La langue d'une requête ou d'un envoi. Le contexte GraphQL la précise une fois la
 * session connue : un objet modifiable, partagé par toute la requête.
 */
interface Cadre {
  langue: Langue
}

const stockage = new AsyncLocalStorage<Cadre>()

/** Exécute `fn` dans une langue : ses textes et ceux de ses appels s'y composent. */
export function avecLangue<T>(langue: Langue, fn: () => T): T {
  return stockage.run({ langue }, fn)
}

/**
 * Précise la langue de la requête en cours, si elle en a une. Le contexte GraphQL
 * l'appelle quand il connaît la personne et son organisation.
 */
export function preciserLangue(langue: Langue): void {
  const cadre = stockage.getStore()
  if (cadre !== undefined) cadre.langue = langue
}

export function langueCourante(): Langue {
  return stockage.getStore()?.langue ?? LANGUE_SOURCE
}

/**
 * Le traducteur des textes du serveur, dans la langue courante. Il garde le nom
 * `i18n` : l'extraction de Lingui ne lit que les appels `i18n._(…)`.
 *
 * ```ts
 * i18n._('Le titre est obligatoire.')
 * i18n._('{nom} vous a assigné une tâche.', { nom })
 * i18n._('Faite', {}, { comment: 'Statut d’une tâche' })
 * ```
 */
export const i18n: Pick<I18n, '_'> = {
  _: ((...args: Parameters<I18n['_']>) =>
    instance(langueCourante())._(...args)) as I18n['_'],
}

/**
 * La langue d'une personne : son choix, sinon la langue de son organisation, sinon
 * le français (ADR 0047). Sans personne, les préférences de son navigateur passent
 * avant la langue de l'organisation.
 */
export function langueDe(
  choix: string | null | undefined,
  langueOrganisation: string | null | undefined,
  navigateur: readonly string[] = []
): Langue {
  if (choix && estUneLangue(choix)) return choix
  return resoudreLangue([...navigateur, langueOrganisation])
}

/** Les langues d'un en-tête Accept-Language, de la préférée à la moins préférée. */
export function languesDuNavigateur(entete: string | undefined): string[] {
  if (!entete) return []
  return entete
    .split(',')
    .map((partie, rang) => {
      const [balise = '', ...parametres] = partie.trim().split(';')
      const poids = Number(
        parametres.find(p => p.trim().startsWith('q='))?.split('=')[1] ?? '1'
      )
      return {
        balise: balise.trim(),
        poids: Number.isNaN(poids) ? 0 : poids,
        rang,
      }
    })
    .filter(l => l.balise !== '' && l.balise !== '*' && l.poids > 0)
    .sort((a, b) => b.poids - a.poids || a.rang - b.rang)
    .map(l => l.balise)
}
