import { t } from '@lingui/core/macro'

import type { LigneTacheImport } from '../gql/graphql'
import {
  lireDate,
  part,
  type LigneEcartee,
  type ReglesDetection,
  type Tableau,
} from './import-tableur'

// Import des tâches d'une période depuis un tableur (ADR 0049), côté navigateur :
// les champs, la détection des colonnes et la construction des lignes envoyées au
// serveur. Le serveur retrouve ensuite le périmètre, la fiche et la personne.

export type ChampTache =
  | 'IGNORER'
  | 'PERIMETRE'
  | 'TITRE'
  | 'DESCRIPTION'
  | 'ECHEANCE'
  | 'FICHE'
  | 'RESPONSABLE'

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// J-30 en français, D-30 en anglais : le serveur attend J-30.
const RELATIVE = /^[JD]\s*[-+]\s*\d{1,3}$/i
const EN_JOURS =
  /^(\d{1,3})\s*(?:j|jours?|days?)\s*(avant|apres|après|before|after)$/i

/** Les règles de détection, en français et en anglais (ADR 0047). */
export const REGLES_TACHES: ReglesDetection<ChampTache> = {
  ignorer: 'IGNORER',
  synonymes: [
    [
      'RESPONSABLE',
      /\b(responsable|assigne|porteur|referent|owner|assignee)\b/,
    ],
    ['PERIMETRE', /\b(perimetre|pole|sport|commission|equipe|area|team)\b/],
    ['ECHEANCE', /\b(echeance|date limite|pour le|deadline|due|date)\b/],
    ['FICHE', /\b(fiche|procedure|guide|sheet)\b/],
    ['DESCRIPTION', /\b(description|details?|consignes?|notes?)\b/],
    ['TITRE', /\b(tache|titre|action|intitule|task|title)\b/],
  ],
  parContenu: valeurs => [
    ['RESPONSABLE', part(valeurs, v => COURRIEL.test(v))],
    ['ECHEANCE', part(valeurs, v => RELATIVE.test(v) || lireDate(v) !== null)],
  ],
  uniques: [
    'PERIMETRE',
    'TITRE',
    'DESCRIPTION',
    'ECHEANCE',
    'FICHE',
    'RESPONSABLE',
  ],
}

/** L'échéance telle que le serveur l'attend : une date AAAA-MM-JJ, ou J-30. */
export function echeanceDe(brute: string): string {
  const texte = brute.trim()
  if (texte === '') return ''
  if (RELATIVE.test(texte)) {
    return texte.replace(/\s+/g, '').toUpperCase().replace(/^D/, 'J')
  }
  const enJours = EN_JOURS.exec(texte)
  if (enJours) {
    const avant = /^(avant|before)$/i.test(enJours[2]!)
    return `J${avant ? '-' : '+'}${Number(enJours[1])}`
  }
  // Une date illisible part telle quelle : le serveur l'écarte en le disant.
  return lireDate(texte) ?? texte
}

/** Les lignes à envoyer, et celles qu'un périmètre ou un titre vide écarte déjà. */
export function lignesDeTaches(
  tableau: Tableau,
  associations: readonly ChampTache[]
): { lignes: LigneTacheImport[]; ecartees: LigneEcartee[] } {
  const valeur = (ligne: string[], champ: ChampTache) => {
    const i = associations.indexOf(champ)
    return i < 0 ? '' : (ligne[i] ?? '').trim()
  }
  const lignes: LigneTacheImport[] = []
  const ecartees: LigneEcartee[] = []
  tableau.lignes.forEach((brute, rang) => {
    const numero = rang + 2
    const perimetre = valeur(brute, 'PERIMETRE')
    const titre = valeur(brute, 'TITRE')
    if (perimetre === '' || titre === '') {
      ecartees.push({
        ligne: numero,
        motif:
          perimetre === '' ? t`Le périmètre est vide.` : t`Le titre est vide.`,
        valeurs: brute,
      })
      return
    }
    lignes.push({
      ligne: numero,
      perimetre,
      titre,
      description: valeur(brute, 'DESCRIPTION') || null,
      echeance: echeanceDe(valeur(brute, 'ECHEANCE')) || null,
      fiche: valeur(brute, 'FICHE') || null,
      responsable: valeur(brute, 'RESPONSABLE') || null,
    })
  })
  return { lignes, ecartees }
}
