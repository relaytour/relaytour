// Activités d'une organisation (ADR 0008). Les requêtes GraphQL passent par
// `ctx.exigerActivite()` ; les scripts, par `organisationEtActivite()`.

import type { TypePerimetre } from '@relaytour/database'
import { erreurSaisie } from './erreurs.ts'
import { slugValide, texteRequis } from './saisie.ts'

// Un type plutôt qu'une interface : Prisma exige une valeur JSON indexable.
export type GroupePerimetres = {
  cle: string
  libelle: string
  libellePluriel: string
}

// Groupes de la disposition plate du contenu, repris par la migration de remplissage.
export const GROUPES_PAR_DEFAUT: GroupePerimetres[] = [
  { cle: 'sport', libelle: 'Sport', libellePluriel: 'Sports' },
  { cle: 'pole', libelle: 'Pôle', libellePluriel: 'Pôles' },
]

// Tant que le contenu déclare un type, le groupe s'en déduit : SPORT donne sport,
// POLE donne pole, comme dans la migration de remplissage.
export function groupeDepuisType(type: TypePerimetre): string {
  return type.toLowerCase()
}

/** Le type d'historique d'un groupe : SPORT pour le groupe sport, POLE sinon. */
export function typeDepuisGroupe(groupe: string): TypePerimetre {
  return groupe === 'sport' ? 'SPORT' : 'POLE'
}

/**
 * Premiers segments d'adresse de l'espace organisateur : une activité ne peut pas
 * les prendre comme slug, ses pages vivent sous /<slug>/ (ADR 0008).
 */
export const SLUGS_RESERVES = new Set([
  'admin',
  'api',
  'assets',
  'connexion',
  'fiches',
  'graphql',
  'medias',
  'perimetres',
  'preferences',
  'retroplanning',
])

/** Le slug d'une activité : un identifiant, hors des segments réservés. */
export function slugActiviteValide(brut: string): string {
  const slug = slugValide(brut)
  if (SLUGS_RESERVES.has(slug)) {
    throw erreurSaisie(
      `« ${slug} » est réservé par l’espace organisateur : choisissez un autre identifiant.`
    )
  }
  return slug
}

export const GROUPES_MAX = 10

/**
 * Valide les groupes d'une activité : entre un et dix groupes, une clé de la forme
 * d'un identifiant, unique dans l'activité, et deux libellés non vides.
 */
export function groupesValides(
  groupes: readonly GroupePerimetres[]
): GroupePerimetres[] {
  if (groupes.length === 0 || groupes.length > GROUPES_MAX) {
    throw erreurSaisie(
      `Une activité déclare entre 1 et ${GROUPES_MAX} groupes de périmètres.`
    )
  }
  const cles = new Set<string>()
  return groupes.map(groupe => {
    const cle = slugValide(groupe.cle)
    if (cles.has(cle)) {
      throw erreurSaisie(`Le groupe « ${cle} » est déclaré deux fois.`)
    }
    cles.add(cle)
    return {
      cle,
      libelle: texteRequis(groupe.libelle, 'Le libellé du groupe', 60),
      libellePluriel: texteRequis(
        groupe.libellePluriel,
        'Le libellé pluriel du groupe',
        60
      ),
    }
  })
}

/** Les groupes portés par la colonne JSON, ou les groupes par défaut s'ils sont illisibles. */
export function lireGroupes(brut: unknown): GroupePerimetres[] {
  if (!Array.isArray(brut)) return GROUPES_PAR_DEFAUT
  const groupes = brut.filter(
    (g): g is GroupePerimetres =>
      typeof g === 'object' &&
      g !== null &&
      typeof (g as GroupePerimetres).cle === 'string' &&
      typeof (g as GroupePerimetres).libelle === 'string' &&
      typeof (g as GroupePerimetres).libellePluriel === 'string'
  )
  return groupes.length === 0 ? GROUPES_PAR_DEFAUT : groupes
}
