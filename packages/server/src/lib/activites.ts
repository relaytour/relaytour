// Activités d'une organisation (ADR 0008). Les requêtes GraphQL passent par
// `ctx.exigerActivite()` ; les scripts, par `organisationEtActivite()`.

import type { TypePerimetre } from '@relaytour/database'
import { erreurSaisie } from './erreurs.ts'
import { i18n } from './langue.ts'
import { slugValide, texteRequis } from './saisie.ts'

// Un type plutôt qu'une interface : Prisma exige une valeur JSON indexable.
export type GroupePerimetres = {
  cle: string
  libelle: string
  libellePluriel: string
}

// Groupes de la disposition plate du contenu, repris par la migration de remplissage.
// Les libellés se traduisent à la lecture : l'activité qui les reçoit à sa création
// les écrit dans la langue de la requête, puis ils sont des données (ADR 0047).
export const GROUPES_PAR_DEFAUT: GroupePerimetres[] = [
  {
    cle: 'sport',
    get libelle() {
      return i18n._(
        'Sport',
        {},
        { comment: 'Groupe de périmètres par défaut, au singulier' }
      )
    },
    get libellePluriel() {
      return i18n._(
        'Sports',
        {},
        { comment: 'Groupe de périmètres par défaut, au pluriel' }
      )
    },
  },
  {
    cle: 'pole',
    get libelle() {
      return i18n._(
        'Pôle',
        {},
        { comment: 'Groupe de périmètres par défaut, au singulier' }
      )
    },
    get libellePluriel() {
      return i18n._(
        'Pôles',
        {},
        { comment: 'Groupe de périmètres par défaut, au pluriel' }
      )
    },
  },
]

/** Les groupes par défaut, libellés écrits dans la langue courante : des données prêtes à stocker. */
export function groupesParDefaut(): GroupePerimetres[] {
  return GROUPES_PAR_DEFAUT.map(groupe => ({ ...groupe }))
}

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
  // Pages publiques des appels à bénévoles et de l'espace bénévole (ADR 0041).
  'benevole',
  'benevoles',
  'connexion',
  'fiches',
  'graphql',
  'medias',
  'perimetres',
  'preferences',
  'rejoindre',
  'retroplanning',
])

/** Le slug d'une activité : un identifiant, hors des segments réservés. */
export function slugActiviteValide(brut: string): string {
  const slug = slugValide(brut)
  if (SLUGS_RESERVES.has(slug)) {
    throw erreurSaisie(
      i18n._(
        '« {slug} » est réservé par l’espace organisateur : choisissez un autre identifiant.',
        { slug }
      )
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
      i18n._('Une activité déclare entre 1 et {max} groupes de périmètres.', {
        max: GROUPES_MAX,
      })
    )
  }
  const cles = new Set<string>()
  return groupes.map(groupe => {
    const cle = slugValide(groupe.cle)
    if (cles.has(cle)) {
      throw erreurSaisie(
        i18n._('Le groupe « {cle} » est déclaré deux fois.', { cle })
      )
    }
    cles.add(cle)
    return {
      cle,
      libelle: texteRequis(groupe.libelle, i18n._('Le libellé du groupe'), 60),
      libellePluriel: texteRequis(
        groupe.libellePluriel,
        i18n._('Le libellé pluriel du groupe'),
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
