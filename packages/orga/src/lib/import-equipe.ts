import { t } from '@lingui/core/macro'

import type { LigneEquipeImport } from '../gql/graphql'
import {
  part,
  type LigneEcartee,
  type ReglesDetection,
  type Tableau,
} from './import-tableur'

// Import de l'équipe d'une période depuis un tableur (ADR 0049), côté navigateur :
// les champs, la détection des colonnes et la construction des lignes. Le serveur
// retrouve ensuite les périmètres et crée ce qui manque.

export type ChampEquipe =
  | 'IGNORER'
  | 'NOM_COMPLET'
  | 'PRENOM'
  | 'NOM'
  | 'ADRESSE'
  | 'PERIMETRES'
  | 'CONTACT'

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const OUI = /^(oui|o|x|1|vrai|yes|y|true)$/i

/** Les règles de détection, en français et en anglais (ADR 0047). */
export const REGLES_EQUIPE: ReglesDetection<ChampEquipe> = {
  ignorer: 'IGNORER',
  synonymes: [
    ['ADRESSE', /\b(e-?mail|courriel|mail|adresse)\b/],
    ['CONTACT', /\b(contact principal|main contact)\b/],
    ['PRENOM', /\b(prenom|first ?name)\b/],
    [
      'NOM_COMPLET',
      /^(nom complet|nom et prenom|prenom et nom|personne|full name|name)$/,
    ],
    ['NOM', /\b(nom|last ?name|nom de famille|surname)\b/],
    [
      'PERIMETRES',
      /\b(perimetres?|poles?|sports?|commissions?|areas?|teams?)\b/,
    ],
  ],
  // Le téléphone et les données sensibles ne servent pas à l'équipe : ces
  // colonnes restent ignorées.
  sensibles:
    /\b(telephone|portable|genre|sexe|sante|allergie|handicap|phone|gender|health)\b/,
  parContenu: valeurs => [['ADRESSE', part(valeurs, v => COURRIEL.test(v))]],
  uniques: ['NOM_COMPLET', 'PRENOM', 'NOM', 'ADRESSE', 'PERIMETRES', 'CONTACT'],
}

/** Les lignes à envoyer, et celles qu'un nom ou une adresse vide écarte déjà. */
export function lignesDeEquipe(
  tableau: Tableau,
  associations: readonly ChampEquipe[]
): { lignes: LigneEquipeImport[]; ecartees: LigneEcartee[] } {
  const valeur = (ligne: string[], champ: ChampEquipe) => {
    const i = associations.indexOf(champ)
    return i < 0 ? '' : (ligne[i] ?? '').trim()
  }
  const lignes: LigneEquipeImport[] = []
  const ecartees: LigneEcartee[] = []
  tableau.lignes.forEach((brute, rang) => {
    const numero = rang + 2
    const nom =
      valeur(brute, 'NOM_COMPLET') ||
      [valeur(brute, 'PRENOM'), valeur(brute, 'NOM')].filter(Boolean).join(' ')
    const adresse = valeur(brute, 'ADRESSE')
    if (nom === '' || adresse === '') {
      ecartees.push({
        ligne: numero,
        motif: nom === '' ? t`Le nom est vide.` : t`L’adresse est vide.`,
        valeurs: brute,
      })
      return
    }
    lignes.push({
      ligne: numero,
      nom,
      adresse,
      perimetres: valeur(brute, 'PERIMETRES')
        .split(/[,;\n]/)
        .map(p => p.trim())
        .filter(Boolean),
      contactPrincipal: OUI.test(valeur(brute, 'CONTACT')),
    })
  })
  return { lignes, ecartees }
}
