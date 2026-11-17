import type { ClientApplication } from '@relaytour/database'

import { builder } from './builder.ts'

// Une application tierce connue de l'installation (ADR 0067), telle que l'écran de
// consentement et la liste des autorisations la présentent.

/** L'hôte d'un identifiant d'application ou d'une adresse de retour. */
export function hoteDe(adresse: string): string {
  try {
    return new URL(adresse).host
  } catch {
    return adresse
  }
}

export const ApplicationTierceRef = builder
  .objectRef<ClientApplication>('ApplicationTierce')
  .implement({
    description:
      'Une application tierce. Son nom vient de son document de métadonnées, ou de l’application elle-même quand elle s’est enregistrée seule.',
    fields: t => ({
      nom: t.exposeString('nom'),
      clientId: t.exposeString('clientId', {
        description:
          'L’identifiant OAuth : l’adresse du document de métadonnées, ou un identifiant tiré par l’installation.',
      }),
      hote: t.string({
        nullable: true,
        description:
          'L’hôte qui publie le document de métadonnées. Nul pour une application enregistrée seule.',
        resolve: c => (c.source === 'CIMD' ? hoteDe(c.clientId) : null),
      }),
      verifiee: t.boolean({
        description:
          'Vrai quand l’application publie un document de métadonnées. Faux quand elle s’est enregistrée seule : son nom n’est pas vérifié.',
        resolve: c => c.source === 'CIMD',
      }),
    }),
  })
