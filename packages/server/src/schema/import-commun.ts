import type { LigneRapport } from '../lib/import-taches.ts'

import { builder } from './builder.ts'

// Types communs aux imports de tableurs de l'espace organisateur (ADR 0049) : l'état
// de chaque ligne du fichier, et la raison d'une ligne écartée.

/** Lignes au plus par appel : le navigateur envoie un gros fichier par lots. */
export const LIGNES_PAR_LOT = 500

/** L'état d'une ligne, commun à tous les imports, bénévoles compris (ADR 0042). */
export const EtatLigneImportEnum = builder.enumType('EtatLigneImport', {
  values: ['A_IMPORTER', 'IMPORTEE', 'DEJA_IMPORTEE', 'ECARTEE'] as const,
})

export const LigneImportRef = builder
  .objectRef<LigneRapport>('LigneImportTableur')
  .implement({
    description:
      'Ce que l’import fait d’une ligne du fichier, numérotée en-têtes compris.',
    fields: t => ({
      ligne: t.exposeInt('ligne'),
      etat: t.expose('etat', { type: EtatLigneImportEnum }),
      raison: t.exposeString('raison', { nullable: true }),
      avertissements: t.exposeStringList('avertissements'),
    }),
  })
