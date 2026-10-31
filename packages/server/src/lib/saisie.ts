import { erreurSaisie } from './erreurs.ts'
import { i18n } from './langue.ts'

const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COULEUR = /^#[0-9a-fA-F]{6}$/

export function adresseValide(brute: string): string {
  const adresse = brute.trim().toLowerCase()
  if (!ADRESSE.test(adresse) || adresse.length > 191) {
    throw erreurSaisie(i18n._('L’adresse mail n’est pas valide.'))
  }
  return adresse
}

/** Longueur maximale d'un titre de tâche ou de fiche : celle de sa colonne. */
export const TITRE_MAX = 191
/** Longueur maximale du résumé d'une version de fiche : celle de sa colonne. */
export const RESUME_MAX = 191
/** Longueur maximale de la description d'une tâche. */
export const DESCRIPTION_TACHE_MAX = 5000
/** Nombre maximal de personnes réalisatrices d'une tâche (ADR 0055). */
export const REALISATEURS_MAX = 20

export function texteRequis(brut: string, libelle: string, max = 120): string {
  const texte = brut.trim()
  if (texte.length === 0)
    throw erreurSaisie(i18n._('{libelle} est obligatoire.', { libelle }))
  if (texte.length > max) {
    throw erreurSaisie(
      i18n._('{libelle} dépasse {max} caractères.', { libelle, max })
    )
  }
  return texte
}

/** Longueur maximale d'une description de périmètre : une ou deux phrases. */
export const DESCRIPTION_MAX = 400

/** Une description facultative : vide, elle vaut null. */
export function descriptionValide(
  brute: string | null | undefined
): string | null {
  const texte = (brute ?? '').trim()
  if (texte.length === 0) return null
  if (texte.length > DESCRIPTION_MAX) {
    throw erreurSaisie(
      i18n._('La description dépasse {max} caractères.', {
        max: DESCRIPTION_MAX,
      })
    )
  }
  return texte
}

/** Un texte facultatif borné : vide, il vaut null. */
export function texteFacultatif(
  brut: string | null | undefined,
  libelle: string,
  max: number
): string | null {
  const texte = (brut ?? '').trim()
  if (texte.length === 0) return null
  if (texte.length > max) {
    throw erreurSaisie(
      i18n._('{libelle} dépasse {max} caractères.', { libelle, max })
    )
  }
  return texte
}

export function slugValide(brut: string): string {
  const slug = brut.trim()
  if (!SLUG.test(slug) || slug.length > 60) {
    throw erreurSaisie(
      i18n._(
        'L’identifiant ne contient que des minuscules, des chiffres et des tirets.'
      )
    )
  }
  return slug
}

export function couleurValide(brute: string | null | undefined): string | null {
  if (brute === null || brute === undefined || brute.trim() === '') return null
  if (!COULEUR.test(brute.trim())) {
    throw erreurSaisie(i18n._('La couleur attendue a la forme #RRGGBB.'))
  }
  return brute.trim().toUpperCase()
}

/** Transforme une violation d'unicité Prisma (P2002) en erreur de saisie. */
export async function sansDoublon<T>(
  operation: Promise<T>,
  message: string
): Promise<T> {
  try {
    return await operation
  } catch (erreur) {
    if ((erreur as { code?: string }).code === 'P2002') {
      throw erreurSaisie(message)
    }
    throw erreur
  }
}

/**
 * Rejoue une fois une opération qu'une violation d'unicité (P2002) a fait échouer.
 * Deux écritures simultanées lisent toutes deux une ligne absente, puis la créent :
 * la seconde échoue. Au second passage, elle lit la ligne écrite par la première.
 */
export async function rejouerSurDoublon<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (erreur) {
    if ((erreur as { code?: string }).code !== 'P2002') throw erreur
    return operation()
  }
}
