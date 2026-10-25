import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { NatureActivite } from '../gql/graphql'

// Natures et groupes de périmètres d'une activité, partagés par l'écran Activités
// et la liste « Premiers pas » (ADR 0048).

export const NATURES: {
  value: NatureActivite
  label: MessageDescriptor
  aide: MessageDescriptor
}[] = [
  {
    value: 'EVENEMENT',
    label: msg({ message: 'Événement', comment: 'Nature d’une activité' }),
    aide: msg`Une manifestation qui revient, une édition à la fois.`,
  },
  {
    value: 'SAISON',
    label: msg({ message: 'Section', comment: 'Nature d’une activité' }),
    aide: msg`Une activité permanente, une saison à la fois.`,
  },
  {
    value: 'MANDAT',
    label: msg({ message: 'Instance', comment: 'Nature d’une activité' }),
    aide: msg`Un bureau ou un conseil, un mandat à la fois.`,
  },
]

export interface Groupe {
  cle: string
  libelle: string
  libellePluriel: string
}

/** Les groupes tels que le serveur les attend, sans espaces autour. */
export function groupesSaisis(groupes: Groupe[]): Groupe[] {
  return groupes.map(g => ({
    cle: g.cle.trim(),
    libelle: g.libelle.trim(),
    libellePluriel: g.libellePluriel.trim(),
  }))
}
