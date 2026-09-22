// Activités d'une organisation (ADR 0008).
// Premier chantier : le schéma porte les activités, l'application en utilise une
// seule par organisation. Le chantier « contexte » remplacera `activiteParDefaut()`
// par l'activité de la requête ; `grep activiteParDefaut` liste alors le travail restant.

import { prisma, type TypePerimetre } from '@relaytour/database'
import { organisationParDefaut } from './organisation.ts'

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
