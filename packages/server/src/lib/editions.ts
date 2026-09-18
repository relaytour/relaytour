import { erreurSaisie } from './erreurs.ts'
import { texteRequis } from './saisie.ts'

// Règles de saisie d'une édition, partagées par la mutation GraphQL et la
// commande `edition:creer`. Une édition est une année de l'événement ; ses dates
// servent de repère aux échéances relatives des tâches (J-120, J+14).

export const ANNEE_MIN = 2020
export const ANNEE_MAX = 2100

export interface SaisieEdition {
  annee: number
  nom: string
  debut: Date
  fin: Date
}

export function validerDates(debut: Date, fin: Date): void {
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
    throw erreurSaisie('Les dates attendues ont la forme AAAA-MM-JJ.')
  }
  if (debut > fin) {
    throw erreurSaisie('La date de fin doit suivre la date de début.')
  }
}

/** Vérifie et normalise une saisie d'édition. Lève une erreur de saisie lisible. */
export function validerEdition(saisie: SaisieEdition): SaisieEdition {
  if (
    !Number.isInteger(saisie.annee) ||
    saisie.annee < ANNEE_MIN ||
    saisie.annee > ANNEE_MAX
  ) {
    throw erreurSaisie(
      `L’année doit être comprise entre ${ANNEE_MIN} et ${ANNEE_MAX}.`
    )
  }
  validerDates(saisie.debut, saisie.fin)
  return {
    annee: saisie.annee,
    nom: texteRequis(saisie.nom, 'Le nom'),
    debut: saisie.debut,
    fin: saisie.fin,
  }
}
