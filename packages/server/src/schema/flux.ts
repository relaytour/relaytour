import { GraphQLError } from 'graphql'

import { buildContext } from '../context.ts'
import { accesRefuse } from '../lib/erreurs.ts'
import {
  FLUX_PAR_PERSONNE,
  ouvrirLeFlux,
  type Changement,
} from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'

import { builder } from './builder.ts'

// Flux des changements (ADR 0017). Le schéma unique porte un type Subscription, servi
// en SSE sur /graphql. Un signal ne porte que des identifiants : le client relit ses
// écrans par les requêtes habituelles, avec ses droits.

const EntiteChangeeEnum = builder.enumType('EntiteChangee', {
  description:
    'Ce qui a changé. EQUIPE couvre les affectations et les souhaits. MESSAGE va aux admins qui lisent le message.',
  values: [
    'TACHE',
    'FICHE',
    'PERIMETRE',
    'EQUIPE',
    'DEMANDE',
    'NOTIFICATION',
    'MESSAGE',
  ] as const,
})

const ChangementRef = builder.objectRef<Changement>('Changement').implement({
  description:
    'Signal qu’une chose a changé dans l’organisation active. Il ne porte aucune donnée : le client relit ses écrans.',
  fields: t => ({
    entite: t.field({ type: EntiteChangeeEnum, resolve: c => c.entite }),
    id: t.id({ nullable: true, resolve: c => c.id ?? null }),
    activiteId: t.id({ nullable: true, resolve: c => c.activiteId ?? null }),
    perimetreId: t.id({ nullable: true, resolve: c => c.perimetreId ?? null }),
    editionId: t.id({ nullable: true, resolve: c => c.editionId ?? null }),
  }),
})

builder.subscriptionType({})

builder.subscriptionField('changements', t =>
  t.field({
    type: ChangementRef,
    authScopes: { connecte: true },
    description:
      'Les changements que la personne peut voir, au fil de l’eau. Le serveur ferme le flux après quinze minutes : le client en rouvre un. Une personne garde quatre flux ouverts au plus.',
    subscribe: async (_root, _args, ctx) => {
      // Le refus se décide ici, à l'ouverture. La portée du champ ne se vérifie qu'à
      // chaque signal livré : sans ce contrôle, une requête sans session ouvrirait
      // un flux, même muet.
      const { personne, organisation } = ctx
      if (personne === null || organisation === null) throw accesRefuse()
      let flux
      try {
        flux = await ouvrirLeFlux(ctx, {
          // Les droits se mémorisent par requête : un flux long les relit. Le
          // serveur HTTP fournit de quoi revalider aussi la session.
          relireLeContexte:
            ctx.relire ??
            (() => buildContext(ctx.ip, personne.id, organisation.slug)),
        })
      } catch (erreur) {
        journal.warn(
          {
            evenement: 'flux-indisponible',
            message: (erreur as Error).message,
          },
          'Un flux n’a pas pu s’ouvrir : le navigateur garde sa relecture périodique.'
        )
        throw new GraphQLError('Le flux des changements ne répond pas.', {
          extensions: { code: 'FLUX_INDISPONIBLE' },
        })
      }
      if (flux === null) {
        throw new GraphQLError(
          `Vous avez déjà ${FLUX_PAR_PERSONNE} flux ouverts. Fermez un onglet, puis réessayez.`,
          { extensions: { code: 'TROP_DE_FLUX' } }
        )
      }
      return flux
    },
    resolve: changement => changement,
  })
)
