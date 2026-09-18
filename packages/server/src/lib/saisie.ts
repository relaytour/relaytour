import { erreurSaisie } from './erreurs.ts'

const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COULEUR = /^#[0-9a-fA-F]{6}$/

export function adresseValide(brute: string): string {
  const adresse = brute.trim().toLowerCase()
  if (!ADRESSE.test(adresse) || adresse.length > 191) {
    throw erreurSaisie('L’adresse mail n’est pas valide.')
  }
  return adresse
}

export function texteRequis(brut: string, libelle: string, max = 120): string {
  const texte = brut.trim()
  if (texte.length === 0) throw erreurSaisie(`${libelle} est obligatoire.`)
  if (texte.length > max) {
    throw erreurSaisie(`${libelle} dépasse ${max} caractères.`)
  }
  return texte
}

export function slugValide(brut: string): string {
  const slug = brut.trim()
  if (!SLUG.test(slug) || slug.length > 60) {
    throw erreurSaisie(
      'L’identifiant ne contient que des minuscules, des chiffres et des tirets.'
    )
  }
  return slug
}

export function couleurValide(brute: string | null | undefined): string | null {
  if (brute === null || brute === undefined || brute.trim() === '') return null
  if (!COULEUR.test(brute.trim())) {
    throw erreurSaisie('La couleur attendue a la forme #RRGGBB.')
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
