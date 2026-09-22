import { randomUUID } from 'node:crypto'

import { prisma, type StatutOrganisation } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { GROUPES_PAR_DEFAUT } from './activites.ts'
import { erreurSaisie } from './erreurs.ts'
import { LimitesSchema, lireLimites, type Limites } from './limites.ts'
import {
  DeclarationOrganisationSchema,
  invaliderConfigurationOrganisation,
} from './organisation.ts'

// Administration de l'installation (ADR 0008).
//
// Les actions d'un hébergeur sur les organisations : créer, inviter le premier admin,
// changer le statut ou les limites, exporter. Les scripts et l'API à jeton passent
// par ces fonctions. Aucune ne renvoie de donnée d'une organisation : ni personne,
// ni tâche, ni fiche. L'export s'écrit sur le disque du serveur, jamais dans une
// réponse.

export interface NouvelleOrganisation {
  slug: string
  nom: string
  sigle?: string
  fuseauHoraire?: string
  domainesCourrielAutorises?: string[]
  limites?: Limites
}

function messageValidation(issues: { path: PropertyKey[]; message: string }[]) {
  return issues
    .map(i => `${i.path.map(String).join('.') || 'déclaration'} : ${i.message}`)
    .join(' ; ')
}

/**
 * Crée une organisation et sa première activité (un événement au slug et au nom de
 * l'organisation, groupes sport et pôle). L'import de son contenu remplacera ensuite
 * ces valeurs.
 */
export async function creerOrganisation(
  donnees: NouvelleOrganisation
): Promise<string> {
  const declaration = DeclarationOrganisationSchema.safeParse({
    slug: donnees.slug,
    nom: donnees.nom,
    sigle: donnees.sigle,
    fuseauHoraire: donnees.fuseauHoraire,
    domainesCourrielAutorises: donnees.domainesCourrielAutorises ?? [],
  })
  if (!declaration.success) {
    throw erreurSaisie(messageValidation(declaration.error.issues))
  }
  const limites = LimitesSchema.safeParse(donnees.limites ?? {})
  if (!limites.success) {
    throw erreurSaisie(messageValidation(limites.error.issues))
  }
  const d = declaration.data
  const existante = await prisma.organisation.findUnique({
    where: { slug: d.slug },
    select: { id: true },
  })
  if (existante !== null) {
    throw erreurSaisie('Une organisation utilise déjà cet identifiant.')
  }
  const organisation = await prisma.organisation.create({
    data: {
      slug: d.slug,
      nom: d.nom,
      sigle: d.sigle ?? null,
      fuseauHoraire: d.fuseauHoraire,
      configuration: d,
      limites: limites.data,
      activites: {
        create: {
          slug: d.slug,
          nom: d.nom,
          sigle: d.sigle ?? null,
          nature: 'EVENEMENT',
          groupes: GROUPES_PAR_DEFAUT,
        },
      },
    },
    select: { id: true },
  })
  return organisation.id
}

export async function organisationParSlug(slug: string) {
  const organisation = await prisma.organisation.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  })
  if (organisation === null) {
    throw erreurSaisie(`Aucune organisation ne porte le slug « ${slug} ».`)
  }
  return organisation
}

/**
 * Donne le rôle d'admin d'une organisation à une adresse, en créant le compte s'il
 * n'existe pas, puis met en file le mail d'invitation. Un compte archivé est refusé :
 * le rétablir lui rendrait l'accès à ses autres organisations.
 */
export async function inviterAdmin(
  slugOrganisation: string,
  adresse: string,
  nom: string
): Promise<string> {
  const { id: organisationId } = await organisationParSlug(slugOrganisation)
  const email = adresse.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 191) {
    throw erreurSaisie('L’adresse mail n’est pas valide.')
  }
  if (nom.trim().length === 0) throw erreurSaisie('Le nom est obligatoire.')
  const existant = await prisma.user.findUnique({
    where: { email },
    select: { archivedAt: true },
  })
  if (existant !== null && existant.archivedAt !== null) {
    throw erreurSaisie('Cette adresse ne peut pas être invitée.')
  }
  const personne = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { id: randomUUID(), email, name: nom.trim() },
    select: { id: true },
  })
  await prisma.appartenance.upsert({
    where: {
      userId_organisationId: { userId: personne.id, organisationId },
    },
    update: { role: 'ADMIN' },
    create: { userId: personne.id, organisationId, role: 'ADMIN' },
  })
  await mettreEnFile('invitation', { userId: personne.id }, { organisationId })
  return personne.id
}

/** Change le statut ou les limites d'une organisation. Une limite nulle se retire. */
export async function modifierOrganisation(
  slug: string,
  changement: {
    statut?: StatutOrganisation
    limites?: { activites?: number | null; periodesOuvertes?: number | null }
  }
): Promise<void> {
  const organisation = await prisma.organisation.findUnique({
    where: { slug },
    select: { id: true, limites: true },
  })
  if (organisation === null) {
    throw erreurSaisie(`Aucune organisation ne porte le slug « ${slug} ».`)
  }
  let limites: Limites | undefined
  if (changement.limites !== undefined) {
    const fusion: Record<string, number> = {
      ...lireLimites(organisation.limites),
    }
    for (const [cle, valeur] of Object.entries(changement.limites)) {
      if (valeur === null || valeur === undefined) delete fusion[cle]
      else fusion[cle] = valeur
    }
    const r = LimitesSchema.safeParse(fusion)
    if (!r.success) throw erreurSaisie(messageValidation(r.error.issues))
    limites = r.data
  }
  await prisma.organisation.update({
    where: { id: organisation.id },
    data: {
      ...(changement.statut === undefined ? {} : { statut: changement.statut }),
      ...(limites === undefined ? {} : { limites }),
    },
  })
  invaliderConfigurationOrganisation()
}

export interface PeriodeInstallation {
  annee: number
  nom: string
  statut: string
  debut: Date
  fin: Date
}

export interface ActiviteInstallation {
  slug: string
  nom: string
  nature: string
  archive: boolean
  periodesOuvertes: PeriodeInstallation[]
}

export interface OrganisationInstallation {
  slug: string
  nom: string
  statut: StatutOrganisation
  limites: Limites
  creeLe: Date
  nombreMembres: number
  activites: ActiviteInstallation[]
}

/**
 * Les organisations de l'installation, avec les compteurs utiles à un hébergeur :
 * activités, périodes non archivées, nombre de membres. Aucun nom ni aucune adresse
 * de personne.
 */
export async function organisationsInstallation(): Promise<
  OrganisationInstallation[]
> {
  const lignes = await prisma.organisation.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      slug: true,
      nom: true,
      statut: true,
      limites: true,
      createdAt: true,
      _count: { select: { appartenances: true } },
      activites: {
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
        select: {
          slug: true,
          nom: true,
          nature: true,
          archivedAt: true,
          editions: {
            where: { statut: { not: 'ARCHIVEE' } },
            orderBy: { annee: 'asc' },
            select: {
              annee: true,
              nom: true,
              statut: true,
              debut: true,
              fin: true,
            },
          },
        },
      },
    },
  })
  return lignes.map(o => ({
    slug: o.slug,
    nom: o.nom,
    statut: o.statut,
    limites: lireLimites(o.limites),
    creeLe: o.createdAt,
    nombreMembres: o._count.appartenances,
    activites: o.activites.map(a => ({
      slug: a.slug,
      nom: a.nom,
      nature: a.nature,
      archive: a.archivedAt !== null,
      periodesOuvertes: a.editions,
    })),
  }))
}

/**
 * L'organisation et l'activité visées par un script. Sans slug d'organisation, la
 * seule organisation de l'installation ; plusieurs organisations exigent le slug.
 * Sans slug d'activité, la première activité non archivée de l'organisation.
 */
export async function organisationEtActivite(
  slugOrganisation: string | undefined,
  slugActivite: string | undefined
): Promise<{ organisationId: string; activiteId: string }> {
  let organisationId: string
  if (slugOrganisation === undefined) {
    const organisations = await prisma.organisation.findMany({
      select: { id: true },
      take: 2,
    })
    if (organisations.length !== 1 || organisations[0] === undefined) {
      throw erreurSaisie(
        'Plusieurs organisations existent : précisez --organisation <slug>.'
      )
    }
    organisationId = organisations[0].id
  } else {
    organisationId = (await organisationParSlug(slugOrganisation)).id
  }
  const activite = await prisma.activite.findFirst({
    where: {
      organisationId,
      ...(slugActivite === undefined
        ? { archivedAt: null }
        : { slug: slugActivite }),
    },
    orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })
  if (activite === null) {
    throw erreurSaisie(
      slugActivite === undefined
        ? 'Cette organisation n’a aucune activité ouverte.'
        : `Aucune activité ne porte le slug « ${slugActivite} » dans cette organisation.`
    )
  }
  return { organisationId, activiteId: activite.id }
}
