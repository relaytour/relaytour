import { select, t } from '@lingui/core/macro'
import { createContext, useContext } from 'react'

import type { ActivitesQuery, NatureActivite } from '../gql/graphql'

import { derniereActivite } from './selection'

// L'activité affichée (ADR 0008) : un événement, une section, une instance. Ses
// pages vivent sous /<slug>/ ; sa nature fixe le mot qui désigne une période.

export type Activite = ActivitesQuery['activites'][number]

/** Les formes du mot qui désigne une période, accordées dans la langue active. */
export interface FormesPeriode {
  /** édition, saison, mandat */
  nom: string
  /** Édition, Saison, Mandat */
  Nom: string
  /** Éditions, Saisons, Mandats */
  Pluriel: string
  /** l’édition, la saison, le mandat */
  la: string
  /** une édition, une saison, un mandat */
  une: string
  /** cette édition, cette saison, ce mandat */
  cette: string
  /** Aucune édition, Aucune saison, Aucun mandat */
  Aucune: string
  /** Nouvelle édition, Nouvelle saison, Nouveau mandat */
  Nouvelle: string
  /** archivée, archivée, archivé */
  archivee: string
  /** créée, créée, créé */
  creee: string
  /** enregistrée, enregistrée, enregistré */
  enregistree: string
  /** de l’édition, de la saison, du mandat */
  de: string
  /** d’une édition à l’autre, d’une saison à l’autre, d’un mandat à l’autre */
  dUneALAutre: string
}

// Chaque forme est un message dont le texte dépend de la nature (ADR 0047) : une
// langue accorde le mot à sa façon, sans que le code connaisse son genre. Les
// formes se calculent à chaque appel, dans la langue active ; l'application se
// remonte quand la langue change.
export function formesPeriode(nature: NatureActivite): FormesPeriode {
  return {
    nom: t({
      message: select(nature, {
        EVENEMENT: 'édition',
        SAISON: 'saison',
        other: 'mandat',
      }),
      comment: 'Le mot qui désigne une période d’une activité, en minuscules.',
    }),
    Nom: t`${select(nature, { EVENEMENT: 'Édition', SAISON: 'Saison', other: 'Mandat' })}`,
    Pluriel: t`${select(nature, { EVENEMENT: 'Éditions', SAISON: 'Saisons', other: 'Mandats' })}`,
    la: t`${select(nature, { EVENEMENT: 'l’édition', SAISON: 'la saison', other: 'le mandat' })}`,
    une: t`${select(nature, { EVENEMENT: 'une édition', SAISON: 'une saison', other: 'un mandat' })}`,
    cette: t`${select(nature, { EVENEMENT: 'cette édition', SAISON: 'cette saison', other: 'ce mandat' })}`,
    Aucune: t`${select(nature, { EVENEMENT: 'Aucune édition', SAISON: 'Aucune saison', other: 'Aucun mandat' })}`,
    Nouvelle: t`${select(nature, { EVENEMENT: 'Nouvelle édition', SAISON: 'Nouvelle saison', other: 'Nouveau mandat' })}`,
    archivee: t({
      message: select(nature, {
        EVENEMENT: 'archivée',
        SAISON: 'archivée',
        other: 'archivé',
      }),
      comment: 'Participe accordé avec le mot qui désigne la période.',
    }),
    creee: t({
      message: select(nature, {
        EVENEMENT: 'créée',
        SAISON: 'créée',
        other: 'créé',
      }),
      comment: 'Participe accordé avec le mot qui désigne la période.',
    }),
    enregistree: t({
      message: select(nature, {
        EVENEMENT: 'enregistrée',
        SAISON: 'enregistrée',
        other: 'enregistré',
      }),
      comment: 'Participe accordé avec le mot qui désigne la période.',
    }),
    de: t`${select(nature, { EVENEMENT: 'de l’édition', SAISON: 'de la saison', other: 'du mandat' })}`,
    dUneALAutre: t`${select(nature, { EVENEMENT: 'd’une édition à l’autre', SAISON: 'd’une saison à l’autre', other: 'd’un mandat à l’autre' })}`,
  }
}

export interface ContexteActiviteValeur {
  activite: Activite
  /**
   * Vrai quand la personne administre l'activité affichée : admin de l'organisation,
   * ou admin de cette activité (ADR 0010). Le serveur vérifie chaque opération.
   */
  gere: boolean
  /**
   * Vrai quand la personne ne fait que découvrir l'activité (ADR 0012, 0045) : elle
   * y est rattachée ou y a un souhait. Elle voit la page « Tous les périmètres »,
   * sans lire les tâches ni les fiches.
   */
  decouverte: boolean
  /** Les activités ouvertes de l'organisation, pour le sélecteur. */
  activites: Activite[]
  periode: FormesPeriode
  /** Préfixe une adresse de l'espace organisateur par le slug de l'activité. */
  lien: (chemin: string) => string
  /** Libellé d'un groupe de périmètres, au singulier ou au pluriel. */
  libelleGroupe: (cle: string, pluriel?: boolean) => string
}

export const ContexteActivite = createContext<ContexteActiviteValeur | null>(
  null
)

/** L'activité affichée. Disponible sous /<slug>/ seulement. */
export function useActivite(): ContexteActiviteValeur {
  const valeur = useContext(ContexteActivite)
  if (valeur === null) {
    throw new Error('useActivite exige le fournisseur d’activité.')
  }
  return valeur
}

export function construireContexte(
  activite: Activite,
  activites: Activite[]
): ContexteActiviteValeur {
  const groupes = new Map(activite.groupes.map(g => [g.cle, g]))
  return {
    activite,
    gere: activite.estAdministree,
    decouverte: activite.acces === 'DECOUVERTE',
    activites: activites.filter(a => !a.archive || a.id === activite.id),
    periode: formesPeriode(activite.nature),
    lien: chemin =>
      `/${activite.slug}${chemin === '/' ? '/' : chemin.startsWith('/') ? chemin : `/${chemin}`}`,
    libelleGroupe: (cle, pluriel = false) => {
      const groupe = groupes.get(cle)
      if (groupe === undefined) return cle
      return pluriel ? groupe.libellePluriel : groupe.libelle
    },
  }
}

/**
 * L'activité ouverte par défaut : la dernière affichée, sinon la première ouverte
 * que la personne voit, avant une activité qu'elle découvre seulement (ADR 0045).
 */
export function activiteParDefaut(activites: Activite[]): Activite | undefined {
  const ouvertes = activites.filter(a => !a.archive)
  const derniere = derniereActivite()
  return (
    ouvertes.find(a => a.slug === derniere) ??
    ouvertes.find(a => a.acces !== 'DECOUVERTE') ??
    ouvertes[0] ??
    activites[0]
  )
}
