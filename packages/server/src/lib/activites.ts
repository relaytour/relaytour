// Activités d'une organisation (ADR 0008).
// Les requêtes GraphQL passent par `ctx.exigerActivite()`. `activiteParDefaut()`
// reste pour les scripts et le worker, jusqu'à leur passage par organisation ;
// `grep activiteParDefaut` liste le travail restant.

import { prisma, type TypePerimetre } from '@relaytour/database'
import { erreurSaisie } from './erreurs.ts'
import { organisationParDefaut } from './organisation.ts'
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

let idParDefaut: string | null = null

/** Oublie l'activité mise en cache (tests, import d'une autre organisation). */
export function invaliderActiviteParDefaut(): void {
  idParDefaut = null
}

/**
 * La première activité de l'organisation par défaut, créée si elle manque.
 * La migration `activites_remplissage` en crée une pour chaque organisation
 * existante ; la création ici couvre une organisation posée après les migrations.
 */
export async function activiteParDefaut(): Promise<string> {
  if (idParDefaut !== null) return idParDefaut
  const organisationId = await organisationParDefaut()
  const existante = await prisma.activite.findFirst({
    where: { organisationId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })
  if (existante !== null) {
    idParDefaut = existante.id
    return existante.id
  }
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { slug: true, nom: true, sigle: true },
  })
  const creee = await prisma.activite.upsert({
    where: { organisationId_slug: { organisationId, slug: organisation.slug } },
    create: {
      organisationId,
      slug: organisation.slug,
      nom: organisation.nom,
      sigle: organisation.sigle,
      nature: 'EVENEMENT',
      groupes: GROUPES_PAR_DEFAUT,
    },
    update: {},
    select: { id: true },
  })
  idParDefaut = creee.id
  return creee.id
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
