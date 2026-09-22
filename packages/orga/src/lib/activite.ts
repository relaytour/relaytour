import { createContext, useContext } from 'react'

import type { ActivitesQuery, NatureActivite } from '../gql/graphql'

import { derniereActivite } from './selection'

// L'activité affichée (ADR 0008) : un événement, une section, une instance. Ses
// pages vivent sous /<slug>/ ; sa nature fixe le mot qui désigne une période.

export type Activite = ActivitesQuery['activites'][number]

/** Les formes du mot qui désigne une période, accordées en genre. */
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

const FEMININ = (nom: string, elision: boolean): FormesPeriode => {
  const Nom = nom.charAt(0).toUpperCase() + nom.slice(1)
  return {
    nom,
    Nom,
    Pluriel: `${Nom}s`,
    la: elision ? `l’${nom}` : `la ${nom}`,
    une: `une ${nom}`,
    cette: `cette ${nom}`,
    Aucune: `Aucune ${nom}`,
    Nouvelle: `Nouvelle ${nom}`,
    archivee: 'archivée',
    creee: 'créée',
    enregistree: 'enregistrée',
    de: elision ? `de l’${nom}` : `de la ${nom}`,
    dUneALAutre: `d’une ${nom} à l’autre`,
  }
}

const FORMES: Record<NatureActivite, FormesPeriode> = {
  EVENEMENT: FEMININ('édition', true),
  SAISON: FEMININ('saison', false),
  MANDAT: {
    nom: 'mandat',
    Nom: 'Mandat',
    Pluriel: 'Mandats',
    la: 'le mandat',
    une: 'un mandat',
    cette: 'ce mandat',
    Aucune: 'Aucun mandat',
    Nouvelle: 'Nouveau mandat',
    archivee: 'archivé',
    creee: 'créé',
    enregistree: 'enregistré',
    de: 'du mandat',
    dUneALAutre: 'd’un mandat à l’autre',
  },
}

export function formesPeriode(nature: NatureActivite): FormesPeriode {
  return FORMES[nature]
}

export interface ContexteActiviteValeur {
  activite: Activite
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

/** L'activité ouverte par défaut : la dernière affichée, sinon la première ouverte. */
export function activiteParDefaut(activites: Activite[]): Activite | undefined {
  const ouvertes = activites.filter(a => !a.archive)
  const derniere = derniereActivite()
  return ouvertes.find(a => a.slug === derniere) ?? ouvertes[0] ?? activites[0]
}
