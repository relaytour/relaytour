import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { PrismaClient } from '@relaytour/database'
import { parse, stringify } from 'yaml'
import type { z } from 'zod'

import { lireGroupes } from '../lib/activites.ts'
import { donneesPersonnelles, normaliserContenu } from '../lib/contenu.ts'
import { EXTENSIONS, type TypeMedia } from '../lib/medias.ts'
import {
  DeclarationOrganisationSchema,
  lireIdentiteActivite,
  type Logo,
} from '../lib/organisation.ts'

import {
  ActiviteDeclaree,
  FichierPerimetres,
  FichierTaches,
  GROUPES_PAR_DEFAUT,
  lireModeles,
  separerEntete,
  type Modeles,
  type TacheModele,
} from './modeles.ts'

// Export complet du contenu d'une organisation (ADR 0009). L'application est la
// source de vérité ; le dossier de contenu en est l'archive, le moyen de transfert
// et le point de départ. L'export produit le même dossier que celui qu'un import
// lirait : importer un export ne change rien, et exporter un import redonne les
// mêmes données.
//
// Le dossier exporté ne contient aucune donnée personnelle : ni personne, ni
// affectation, ni souhait, ni tâche datée. Une fiche qui cite une adresse ou un
// numéro personnel est refusée (CONTRIBUTING.md, invariant 2).

export type Disposition = 'plate' | 'activites'

export interface ContenuExporte {
  disposition: Disposition
  /** Fichiers par chemin relatif à la racine, séparateur « / ». */
  fichiers: Map<string, Buffer>
  /** Fichiers non écrits, avec leur raison. */
  refusees: { fichier: string; raison: string }[]
}

export interface OptionsContenu {
  /** Disposition imposée ; sans elle, la plus simple qui décrit tout le contenu. */
  disposition?: Disposition
  /** Dossier existant : ses images gardent leur chemin quand leur empreinte est la même. */
  existant?: Modeles
}

const ENTETE_YAML =
  ' Écrit par Relaytour (export du contenu). Le dépôt organisation-modele\n décrit chaque champ.'

function yaml(valeur: unknown): Buffer {
  const texte = stringify(sansIndefinis(valeur), { lineWidth: 0 })
  return Buffer.from(
    `${ENTETE_YAML.split('\n')
      .map(l => `#${l}`)
      .join('\n')}\n${texte}`,
    'utf8'
  )
}

/** Retire les clés indéfinies et les listes vides facultatives, pour un YAML lisible. */
function sansIndefinis(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(sansIndefinis)
  if (valeur !== null && typeof valeur === 'object') {
    return Object.fromEntries(
      Object.entries(valeur)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, sansIndefinis(v)])
    )
  }
  return valeur
}

function vide(valeur: unknown[] | undefined): boolean {
  return valeur === undefined || valeur.length === 0
}

/** Le texte d'une fiche : en-tête YAML entre deux lignes « --- », puis le Markdown. */
function texteFiche(slug: string, titre: string, contenu: string): Buffer {
  const entete = stringify({ slug, titre }, { lineWidth: 0 }).trimEnd()
  return Buffer.from(`---\n${entete}\n---\n\n${normaliserContenu(contenu)}`)
}

function egauxProfond(a: unknown, b: unknown): boolean {
  return JSON.stringify(trier(a)) === JSON.stringify(trier(b))
}

function trier(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(trier)
  if (valeur !== null && typeof valeur === 'object') {
    return Object.fromEntries(
      Object.entries(valeur)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, trier(v)])
    )
  }
  return valeur
}

/** Le schéma qui lit un fichier YAML du dossier, selon son emplacement. */
function schemaDuFichier(chemin: string): z.ZodType | null {
  const nom = path.posix.basename(chemin)
  if (chemin === 'organisation.yaml') return DeclarationOrganisationSchema
  if (nom === 'activite.yaml') return ActiviteDeclaree
  if (nom === 'perimetres.yaml') return FichierPerimetres
  if (path.posix.basename(path.posix.dirname(chemin)) === 'taches')
    return FichierTaches
  return null
}

/**
 * Vrai quand deux versions d'un fichier du dossier disent la même chose : mêmes
 * valeurs une fois lues, même fiche, ou mêmes octets. Un fichier écrit à la main
 * garde ainsi ses commentaires et sa mise en forme tant que son sens ne change pas.
 */
export function memeSens(
  chemin: string,
  avant: Buffer,
  apres: Buffer
): boolean {
  if (avant.equals(apres)) return true
  try {
    if (chemin.endsWith('.yaml')) {
      const schema = schemaDuFichier(chemin)
      const lire = (b: Buffer) => {
        const brut: unknown = parse(b.toString('utf8'))
        return schema === null ? brut : schema.parse(brut)
      }
      return egauxProfond(lire(avant), lire(apres))
    }
    if (chemin.endsWith('.md')) {
      const a = separerEntete(avant.toString('utf8'))
      const b = separerEntete(apres.toString('utf8'))
      return (
        a !== null &&
        b !== null &&
        egauxProfond(a.entete, b.entete) &&
        normaliserContenu(a.corps) === normaliserContenu(b.corps)
      )
    }
  } catch {
    return false
  }
  return false
}

/** La disposition d'un dossier existant, ou null s'il est vide. */
export function dispositionDuDossier(racine: string): Disposition | null {
  if (existsSync(path.join(racine, 'activites'))) return 'activites'
  if (
    ['perimetres.yaml', 'fiches', 'taches'].some(f =>
      existsSync(path.join(racine, f))
    )
  ) {
    return 'plate'
  }
  return null
}

/**
 * Construit le dossier de contenu d'une organisation, sans rien écrire. Les
 * activités et les périmètres archivés n'y figurent pas.
 */
export async function construireContenu(
  prisma: PrismaClient,
  organisationId: string,
  options: OptionsContenu = {}
): Promise<ContenuExporte> {
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { slug: true, configuration: true },
  })
  const lue = DeclarationOrganisationSchema.safeParse(
    organisation.configuration
  )
  if (!lue.success) {
    throw new Error(
      `La configuration de l'organisation « ${organisation.slug} » est invalide : importez d'abord son organisation.yaml.`
    )
  }
  const declaration = lue.data
  const role = {
    domaines: declaration.domainesCourrielAutorises,
    adresses: declaration.adressesRoleAutorisees,
  }

  const activites = await prisma.activite.findMany({
    where: { organisationId, archivedAt: null },
    orderBy: [{ ordre: 'asc' }, { slug: 'asc' }],
  })
  const representablePlat =
    activites.length === 1 &&
    activites[0]!.slug === organisation.slug &&
    activites[0]!.nature === 'EVENEMENT' &&
    activites[0]!.identite === null &&
    egauxProfond(lireGroupes(activites[0]!.groupes), GROUPES_PAR_DEFAUT)
  const disposition =
    options.disposition ?? (representablePlat ? 'plate' : 'activites')
  if (disposition === 'plate' && !representablePlat) {
    throw new Error(
      activites.length > 1
        ? `L'organisation porte ${activites.length} activités (${activites.map(a => a.slug).join(', ')}) : le dossier doit passer en disposition activites/ (ADR 0008).`
        : "L'activité a une nature, des groupes, une identité ou un slug que la disposition plate ne décrit pas : passez le dossier en disposition activites/ (ADR 0008)."
    )
  }

  const fichiers = new Map<string, Buffer>()
  const refusees: ContenuExporte['refusees'] = []

  // Images : un chemin par empreinte, celui du dossier existant s'il la connaît.
  const medias = await prisma.media.findMany({
    where: { organisationId },
    select: { empreinte: true, type: true, donnees: true },
  })
  const mediaParEmpreinte = new Map(medias.map(m => [m.empreinte, m]))
  const cheminExistant = new Map<string, string>()
  for (const [chemin, media] of options.existant?.medias ?? []) {
    if (!cheminExistant.has(media.empreinte))
      cheminExistant.set(media.empreinte, chemin)
  }
  /** Écrit une image et renvoie son chemin, relatif au dossier du fichier déclarant. */
  const image = (
    empreinte: string | undefined,
    dossierDeclarant: string,
    nomParDefaut: string
  ): string | undefined => {
    if (empreinte === undefined) return undefined
    const media = mediaParEmpreinte.get(empreinte)
    if (media === undefined) {
      refusees.push({
        fichier: path.posix.join(dossierDeclarant, 'medias', nomParDefaut),
        raison: `image ${empreinte.slice(0, 12)}… absente de la base`,
      })
      return undefined
    }
    const extension = EXTENSIONS[media.type as TypeMedia] ?? 'png'
    const chemin =
      cheminExistant.get(empreinte) ??
      path.posix.join(
        dossierDeclarant,
        'medias',
        `${nomParDefaut}.${extension}`
      )
    fichiers.set(chemin, Buffer.from(media.donnees))
    return path.posix.relative(dossierDeclarant, chemin)
  }
  const logo = (
    valeur: Logo | undefined,
    dossierDeclarant: string
  ): Logo | undefined => {
    if (valeur === undefined) return undefined
    const png = image(valeur.png, dossierDeclarant, 'logo')
    if (png === undefined) return undefined
    const svg = image(valeur.svg, dossierDeclarant, 'logo')
    return svg === undefined ? { png } : { png, svg }
  }

  // organisation.yaml
  fichiers.set(
    'organisation.yaml',
    yaml({
      slug: declaration.slug,
      nom: declaration.nom,
      sigle: declaration.sigle,
      fuseauHoraire: declaration.fuseauHoraire,
      domainesCourrielAutorises: declaration.domainesCourrielAutorises,
      adressesRoleAutorisees: vide(declaration.adressesRoleAutorisees)
        ? undefined
        : declaration.adressesRoleAutorisees,
      contactRecrutement: declaration.contactRecrutement,
      pageEquipe: declaration.pageEquipe,
      logo: logo(declaration.logo, ''),
      favicon: image(declaration.favicon, '', 'favicon'),
      logoUrl: declaration.logoUrl,
      faviconUrl: declaration.faviconUrl,
      theme: declaration.theme,
    })
  )

  for (const activite of activites) {
    const dossier = disposition === 'plate' ? '' : `activites/${activite.slug}/`
    const dossierSansBarre = dossier.replace(/\/$/, '')
    if (disposition === 'activites') {
      const identite = lireIdentiteActivite(activite.identite)
      fichiers.set(
        `${dossier}activite.yaml`,
        yaml({
          slug: activite.slug,
          nom: activite.nom,
          sigle: activite.sigle ?? undefined,
          nature: activite.nature,
          ordre: activite.ordre,
          groupes: lireGroupes(activite.groupes),
          contactRecrutement: identite.contactRecrutement,
          pageEquipe: identite.pageEquipe,
          logo: logo(identite.logo, dossierSansBarre),
          theme: identite.theme,
        })
      )
    }

    const perimetres = await prisma.perimetre.findMany({
      where: { activiteId: activite.id, archivedAt: null },
      orderBy: [{ ordre: 'asc' }, { slug: 'asc' }],
    })
    const slugsPerimetres = new Map(perimetres.map(p => [p.id, p.slug]))
    fichiers.set(
      `${dossier}perimetres.yaml`,
      yaml({
        perimetres: perimetres.map(p => ({
          slug: p.slug,
          nom: p.nom,
          groupe: p.groupe,
          couleur: p.couleur ?? undefined,
          ordre: p.ordre,
          effectif: p.effectifParDefaut ?? undefined,
        })),
      })
    )
    for (const perimetre of perimetres) {
      const taches = perimetre.tachesTypes as TacheModele[] | null
      if (taches === null || taches.length === 0) continue
      fichiers.set(`${dossier}taches/${perimetre.slug}.yaml`, yaml({ taches }))
    }

    const fiches = await prisma.fiche.findMany({
      where: { activiteId: activite.id, archivedAt: null },
      include: { versionCourante: { select: { titre: true, contenu: true } } },
      orderBy: { slug: 'asc' },
    })
    for (const fiche of fiches) {
      const version = fiche.versionCourante
      if (version === null) continue
      const perimetre =
        fiche.perimetreId === null
          ? 'communes'
          : slugsPerimetres.get(fiche.perimetreId)
      const chemin = `${dossier}fiches/${perimetre ?? '(archivé)'}/${fiche.slug}.md`
      if (perimetre === undefined) {
        refusees.push({ fichier: chemin, raison: 'périmètre archivé' })
        continue
      }
      const personnelles = donneesPersonnelles(
        `${version.titre}\n${version.contenu}`,
        role
      )
      if (personnelles.length > 0) {
        refusees.push({
          fichier: chemin,
          raison: `données personnelles (${personnelles.join(', ')})`,
        })
        continue
      }
      fichiers.set(
        chemin,
        texteFiche(fiche.slug, version.titre, version.contenu)
      )
    }
  }
  return { disposition, fichiers, refusees }
}

export interface RapportExport {
  ecrites: string[]
  inchangees: string[]
  refusees: { fichier: string; raison: string }[]
}

/** L'organisation visée : celle du slug, ou l'unique organisation de l'installation. */
async function organisationVisee(
  prisma: PrismaClient,
  slugOrganisation: string | undefined
): Promise<string> {
  const organisations = await prisma.organisation.findMany({
    where: slugOrganisation === undefined ? {} : { slug: slugOrganisation },
    select: { id: true },
    take: 2,
  })
  const organisation = organisations[0]
  if (organisation === undefined) {
    throw new Error(
      slugOrganisation === undefined
        ? 'Aucune organisation en base.'
        : `Aucune organisation ne porte le slug « ${slugOrganisation} ».`
    )
  }
  if (organisations.length > 1) {
    throw new Error(
      'Plusieurs organisations existent en base : précisez --organisation <slug>.'
    )
  }
  return organisation.id
}

/**
 * Écrit dans le dossier de contenu tout ce que l'organisation porte en base, dans
 * la disposition du dossier. Un fichier dont le sens ne change pas reste intact.
 * Un fichier du dossier que la base ne décrit plus n'est jamais supprimé.
 *
 * Sans slug, l'organisation est la seule de l'installation ; plusieurs organisations
 * exigent le slug. L'export marque le contenu comme synchronisé : un import suivant
 * n'a plus de modification de l'application à protéger.
 */
export async function exporterContenu(
  prisma: PrismaClient,
  racine: string,
  slugOrganisation?: string
): Promise<RapportExport> {
  const organisationId = await organisationVisee(prisma, slugOrganisation)
  let existant: Modeles | undefined
  try {
    existant = lireModeles(racine)
  } catch {
    existant = undefined
  }
  const contenu = await construireContenu(prisma, organisationId, {
    disposition: dispositionDuDossier(racine) ?? undefined,
    existant,
  })
  const rapport: RapportExport = {
    ecrites: [],
    inchangees: [],
    refusees: contenu.refusees,
  }
  for (const [chemin, donnees] of contenu.fichiers) {
    const cible = path.join(racine, ...chemin.split('/'))
    if (existsSync(cible) && memeSens(chemin, readFileSync(cible), donnees)) {
      rapport.inchangees.push(chemin)
      continue
    }
    mkdirSync(path.dirname(cible), { recursive: true })
    writeFileSync(cible, donnees)
    rapport.ecrites.push(chemin)
  }
  await prisma.organisation.update({
    where: { id: organisationId },
    data: { contenuSynchroniseLe: new Date() },
  })
  return rapport
}
