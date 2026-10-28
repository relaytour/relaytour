import { Prisma, type PrismaClient } from '@relaytour/database'

import { lireGroupes } from '../lib/activites.ts'
import { lireLimites } from '../lib/limites.ts'
import {
  invaliderConfigurationOrganisation,
  type DeclarationOrganisation,
  type IdentiteActivite,
  type Logo,
} from '../lib/organisation.ts'

import { type ActiviteModele, type Modeles } from './modeles.ts'
import { importerFiches } from './import-fiches.ts'
import {
  creerTachesDeLaPeriode,
  type RapportTachesDeLaPeriode,
} from './taches-de-la-periode.ts'

export interface RapportActivite extends RapportTachesDeLaPeriode {
  slug: string
  etat: 'creee' | 'mise-a-jour'
  perimetres: { crees: string[]; modifies: string[]; absentsDuDepot: string[] }
  fiches: {
    creees: string[]
    nouvellesVersions: string[]
    inchangees: string[]
    conflits: string[]
  }
  /** Période de l'année demandée : importée, absente, ou null sans année. */
  periode: 'importee' | 'absente' | null
}

export interface RapportImport {
  /** La ligne Organisation créée ou mise à jour depuis organisation.yaml. */
  organisation: { slug: string; etat: 'creee' | 'mise-a-jour' }
  /** Images enregistrées : nouvelles, ou déjà présentes en base. */
  medias: { enregistrees: string[]; dejaPresentes: string[] }
  /**
   * Date de la dernière modification faite dans l'application depuis le dernier
   * import ou export, ou null. Sans `forcer`, un import réel refuse de l'écraser.
   */
  modifieDansApplication: Date | null
  activites: RapportActivite[]
  /** Activités en base que le dépôt ne décrit pas : signalées, jamais archivées. */
  activitesAbsentesDuDepot: string[]
  /**
   * Activité d'amorçage (« defaut », ou au slug de l'organisation), vide, retirée
   * au premier import d'un dépôt en disposition activites/ qui ne la décrit pas.
   */
  amorcageRetire: boolean
}

export interface OptionsImport {
  /** Année de la période dont les tâches types et les effectifs s'importent. */
  annee?: number
  simulation?: boolean
  /**
   * Slug de l'organisation visée, obligatoire quand l'installation en porte
   * plusieurs. Il doit être celui d'organisation.yaml.
   */
  organisation?: string
  /** Restreint l'import à une activité du dépôt. */
  activite?: string
  /**
   * Écrase les modifications faites dans l'application depuis la dernière
   * synchronisation (ADR 0009). Sans cette option, l'import les protège.
   */
  forcer?: boolean
  /**
   * Laisse l'organisation telle qu'elle est en base : ni son identité ni sa
   * configuration ne suivent organisation.yaml, et la date de synchronisation ne
   * bouge pas. Une fiche d'une autre activité qui porte le même slug n'est ni
   * déplacée ni remplacée : elle se signale en conflit. Sert au dépôt d'une archive
   * par un admin d'activité (ADR 0049), avec `activite`.
   */
  ignorerOrganisation?: boolean
}

function rapportActiviteVide(
  slug: string,
  etat: RapportActivite['etat']
): RapportActivite {
  return {
    slug,
    etat,
    perimetres: { crees: [], modifies: [], absentsDuDepot: [] },
    fiches: { creees: [], nouvellesVersions: [], inchangees: [], conflits: [] },
    periode: null,
    effectifs: { crees: [], dejaPresents: [] },
    taches: { creees: [], dejaPresentes: [], rattachees: [], conflits: [] },
  }
}

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/**
 * L'organisation de la déclaration, créée ou mise à jour. Une installation sans
 * organisation la crée ; une installation dont l'unique organisation porte le slug
 * d'amorçage « defaut » la renomme. Dans les autres cas, l'organisation doit
 * exister : organisation:creer la crée.
 */
async function resoudreOrganisation(
  tx: Transaction,
  modeles: Modeles,
  options: OptionsImport,
  ecrire: boolean
): Promise<{ id: string; etat: 'creee' | 'mise-a-jour' }> {
  const declaration = modeles.organisation
  if (
    options.organisation !== undefined &&
    options.organisation !== declaration.slug
  ) {
    throw new Error(
      `Le dépôt déclare l'organisation « ${declaration.slug} », pas « ${options.organisation} ». Import refusé.`
    )
  }
  const lignes = await tx.organisation.findMany({
    select: { id: true, slug: true },
    orderBy: { createdAt: 'asc' },
  })
  if (lignes.length > 1 && options.organisation === undefined) {
    throw new Error(
      'Plusieurs organisations existent en base : précisez --organisation <slug>.'
    )
  }
  const donnees = {
    slug: declaration.slug,
    nom: declaration.nom,
    sigle: declaration.sigle ?? null,
    fuseauHoraire: declaration.fuseauHoraire,
    configuration: declaration,
  }
  const cible =
    lignes.find(l => l.slug === declaration.slug) ??
    (lignes.length === 1 && lignes[0]?.slug === 'defaut' ? lignes[0] : null)
  if (cible === null) {
    if (lignes.length > 0) {
      throw new Error(
        lignes.length === 1 && options.organisation === undefined
          ? `L'installation appartient à l'organisation « ${lignes[0]?.slug} » ; le dépôt déclare « ${declaration.slug} ». Import refusé.`
          : `L'organisation « ${declaration.slug} » n'existe pas : créez-la d'abord avec organisation:creer. Import refusé.`
      )
    }
    const id = ecrire
      ? (await tx.organisation.create({ data: donnees, select: { id: true } }))
          .id
      : ''
    return { id, etat: 'creee' }
  }
  if (ecrire) {
    await tx.organisation.update({ where: { id: cible.id }, data: donnees })
  }
  return { id: cible.id, etat: 'mise-a-jour' }
}

/**
 * Importe les modèles Git en base.
 *
 * - Chaque activité du dépôt est créée ou mise à jour par slug. L'activité implicite
 *   de la disposition plate suit le slug, le nom et le sigle de l'organisation. Une
 *   activité en base absente du dépôt est signalée, jamais archivée. Une activité
 *   nouvelle respecte la limite d'activités de l'organisation.
 * - Les périmètres sont créés ou mis à jour par slug dans leur activité. Un périmètre
 *   absent du dépôt est signalé, jamais archivé.
 * - Une fiche reçoit une version `GIT` seulement si son contenu diffère. Si la version
 *   courante vient de l'application, l'import signale un conflit et ne remplace rien.
 * - L'effectif souhaité d'un périmètre est créé pour la période demandée s'il manque,
 *   jamais remplacé : les admins le modifient ensuite dans l'app.
 * - Les tâches types sont créées pour la période demandée, une seule fois par modèle :
 *   une tâche déjà importée n'est jamais modifiée, car elle a pu évoluer dans l'app.
 *   Une activité sans période pour cette année est signalée ; si aucune activité n'en
 *   a, l'import échoue.
 *
 * Avec `simulation`, le rapport est calculé sans rien écrire.
 */
export async function importerModeles(
  prisma: PrismaClient,
  modeles: Modeles,
  options: OptionsImport = {}
): Promise<RapportImport> {
  const ecrire = options.simulation !== true
  const ecrireOrganisation = ecrire && options.ignorerOrganisation !== true
  const aImporter =
    options.activite === undefined
      ? modeles.activites
      : modeles.activites.filter(a => a.declaration.slug === options.activite)
  if (aImporter.length === 0) {
    throw new Error(
      `Le dépôt ne décrit aucune activité « ${options.activite} ». Import refusé.`
    )
  }

  const rapport = await prisma.$transaction(
    async tx => {
      const organisation = await resoudreOrganisation(
        tx,
        modeles,
        options,
        ecrireOrganisation
      )
      if (options.ignorerOrganisation === true && organisation.id === '') {
        throw new Error(
          `L'organisation « ${modeles.organisation.slug} » n'existe pas. Import refusé.`
        )
      }
      const rapport: RapportImport = {
        organisation: {
          slug: modeles.organisation.slug,
          etat: organisation.etat,
        },
        medias: { enregistrees: [], dejaPresentes: [] },
        modifieDansApplication: null,
        activites: [],
        activitesAbsentesDuDepot: [],
        amorcageRetire: false,
      }

      if (organisation.id !== '') {
        rapport.modifieDansApplication = await modificationNonSynchronisee(
          tx,
          organisation.id
        )
        if (
          ecrire &&
          rapport.modifieDansApplication !== null &&
          options.forcer !== true
        ) {
          throw new Error(
            `Des admins ont modifié le contenu dans l'application le ${rapport.modifieDansApplication.toISOString()}, après la dernière synchronisation. Exportez d'abord le contenu (orga:exporter), ou relancez l'import avec --forcer pour écraser ces modifications. Import refusé.`
          )
        }
      }
      const empreintes = await enregistrerMedias(
        tx,
        organisation.id,
        modeles,
        ecrire,
        rapport
      )
      if (ecrireOrganisation && organisation.id !== '') {
        await tx.organisation.update({
          where: { id: organisation.id },
          data: {
            configuration: declarationEnBase(modeles.organisation, empreintes),
          },
        })
      }

      const enBase =
        organisation.id === ''
          ? []
          : await tx.activite.findMany({
              where: { organisationId: organisation.id },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: { id: true, slug: true, archivedAt: true },
            })

      // Chaque activité du dépôt retrouve sa ligne. L'activité implicite retrouve la
      // première activité de l'organisation, dont le slug a pu rester « defaut ».
      const correspondance = new Map<ActiviteModele, (typeof enBase)[number]>()
      for (const activite of aImporter) {
        const ligne =
          enBase.find(a => a.slug === activite.declaration.slug) ??
          (activite.implicite ? enBase[0] : undefined)
        if (ligne !== undefined) correspondance.set(activite, ligne)
      }
      const nouvelles = aImporter.filter(a => !correspondance.has(a))
      if (nouvelles.length > 0 && organisation.id !== '') {
        const { activites: limite } = lireLimites(
          (
            await tx.organisation.findUniqueOrThrow({
              where: { id: organisation.id },
              select: { limites: true },
            })
          ).limites
        )
        const ouvertes = enBase.filter(a => a.archivedAt === null).length
        if (limite !== undefined && ouvertes + nouvelles.length > limite) {
          throw new Error(
            `Le dépôt ajoute ${nouvelles.length} activité(s) : l'organisation dépasserait sa limite de ${limite} activité(s). Import refusé.`
          )
        }
      }
      const retrouvees = new Set([...correspondance.values()].map(l => l.id))
      // La migration a créé une activité « defaut » pour chaque organisation, et
      // organisation:creer une activité au slug de l'organisation. Un dépôt en
      // disposition activites/ qui ne la décrit pas la retire, si elle est vide :
      // elle deviendrait sinon l'activité affichée par défaut.
      const amorcage = enBase.find(
        a =>
          (a.slug === 'defaut' || a.slug === modeles.organisation.slug) &&
          !retrouvees.has(a.id)
      )
      if (
        amorcage !== undefined &&
        modeles.disposition === 'activites' &&
        options.activite === undefined &&
        (await activiteVide(tx, amorcage.id))
      ) {
        rapport.amorcageRetire = true
        if (ecrire) await tx.activite.delete({ where: { id: amorcage.id } })
      }
      rapport.activitesAbsentesDuDepot =
        options.activite === undefined
          ? enBase
              .filter(
                a =>
                  !retrouvees.has(a.id) &&
                  a.archivedAt === null &&
                  !(rapport.amorcageRetire && a.id === amorcage?.id)
              )
              .map(a => a.slug)
              .sort()
          : []

      let periodesTrouvees = 0
      for (const activite of aImporter) {
        const ligne = correspondance.get(activite)
        const resultat = await importerActivite(
          tx,
          organisation.id,
          modeles,
          activite,
          ligne?.id ?? null,
          options.annee,
          ecrire,
          empreintes,
          // Un import limité à une activité ne touche pas aux fiches des autres :
          // un slug déjà pris ailleurs se signale en conflit (ADR 0049).
          options.ignorerOrganisation === true ? 'conflit' : 'suivre'
        )
        if (resultat.periode === 'importee') periodesTrouvees += 1
        rapport.activites.push(resultat)
      }
      if (options.annee !== undefined && periodesTrouvees === 0) {
        throw new Error(
          `Aucune activité n'a de période ${options.annee}. Créez-la d'abord dans l'espace organisateur ou avec edition:creer (dist/creer-edition.js dans l'image).`
        )
      }
      // Un import limité à une activité sans organisation.yaml ne vaut pas
      // synchronisation : les autres activités ont pu changer dans l'application.
      if (ecrireOrganisation && organisation.id !== '') {
        await tx.organisation.update({
          where: { id: organisation.id },
          data: { contenuSynchroniseLe: new Date() },
        })
      }
      return rapport
    },
    { timeout: 60_000 }
  )

  invaliderConfigurationOrganisation()
  return rapport
}

/**
 * La date de la dernière modification faite dans l'application, si elle suit la
 * dernière synchronisation avec le dossier de contenu. Null sinon.
 */
export async function modificationNonSynchronisee(
  tx: Pick<Transaction, 'organisation'>,
  organisationId: string
): Promise<Date | null> {
  const ligne = await tx.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { contenuModifieLe: true, contenuSynchroniseLe: true },
  })
  if (ligne.contenuModifieLe === null) return null
  if (
    ligne.contenuSynchroniseLe !== null &&
    ligne.contenuModifieLe <= ligne.contenuSynchroniseLe
  ) {
    return null
  }
  return ligne.contenuModifieLe
}

type Empreintes = Map<string, string>

/** Enregistre les images du dossier et renvoie l'empreinte de chaque chemin. */
async function enregistrerMedias(
  tx: Transaction,
  organisationId: string,
  modeles: Modeles,
  ecrire: boolean,
  rapport: RapportImport
): Promise<Empreintes> {
  const empreintes: Empreintes = new Map()
  for (const [chemin, media] of modeles.medias) {
    empreintes.set(chemin, media.empreinte)
    const existant =
      organisationId === ''
        ? null
        : await tx.media.findUnique({
            where: {
              organisationId_empreinte: {
                organisationId,
                empreinte: media.empreinte,
              },
            },
            select: { id: true },
          })
    if (existant !== null) {
      rapport.medias.dejaPresentes.push(chemin)
      continue
    }
    rapport.medias.enregistrees.push(chemin)
    if (!ecrire || organisationId === '') continue
    await tx.media.create({
      data: {
        organisationId,
        empreinte: media.empreinte,
        type: media.type,
        octets: media.octets,
        donnees: new Uint8Array(media.donnees),
      },
    })
  }
  return empreintes
}

function logoEnBase(
  logo: Logo | undefined,
  empreintes: Empreintes
): Logo | undefined {
  if (logo === undefined) return undefined
  const png = empreintes.get(logo.png)
  if (png === undefined) return undefined
  const svg = logo.svg === undefined ? undefined : empreintes.get(logo.svg)
  return svg === undefined ? { png } : { png, svg }
}

/** La déclaration de l'organisation telle qu'elle se garde en base : images par empreinte. */
export function declarationEnBase(
  declaration: DeclarationOrganisation,
  empreintes: Empreintes
): DeclarationOrganisation {
  const resultat: DeclarationOrganisation = { ...declaration }
  const logo = logoEnBase(declaration.logo, empreintes)
  if (logo === undefined) delete resultat.logo
  else resultat.logo = logo
  const favicon =
    declaration.favicon === undefined
      ? undefined
      : empreintes.get(declaration.favicon)
  if (favicon === undefined) delete resultat.favicon
  else resultat.favicon = favicon
  const icone =
    declaration.iconeApplication === undefined
      ? undefined
      : empreintes.get(declaration.iconeApplication)
  if (icone === undefined) delete resultat.iconeApplication
  else resultat.iconeApplication = icone
  return resultat
}

/** L'identité d'une activité telle qu'elle se garde en base, ou null si elle est vide. */
function identiteEnBase(
  modele: ActiviteModele,
  empreintes: Empreintes
): IdentiteActivite | null {
  const d = modele.declaration
  const identite: IdentiteActivite = {}
  if (d.contactRecrutement !== undefined)
    identite.contactRecrutement = d.contactRecrutement
  if (d.pageEquipe !== undefined) identite.pageEquipe = d.pageEquipe
  const logo = logoEnBase(d.logo, empreintes)
  if (logo !== undefined) identite.logo = logo
  if (d.theme !== undefined) identite.theme = d.theme
  return Object.keys(identite).length === 0 ? null : identite
}

/** Une activité sans période, sans périmètre ni fiche. */
async function activiteVide(tx: Transaction, activiteId: string) {
  const [periodes, perimetres, fiches] = await Promise.all([
    tx.edition.count({ where: { activiteId } }),
    tx.perimetre.count({ where: { activiteId } }),
    tx.fiche.count({ where: { activiteId } }),
  ])
  return periodes + perimetres + fiches === 0
}

/**
 * Applique la liste « Concerne aussi » d'une fiche (ADR 0039). Une fiche commune
 * n'en garde aucune. Le masquage vit en base seulement : l'import n'y touche pas.
 */
export async function appliquerConcerneAussi(
  tx: Transaction,
  ficheId: string,
  perimetreId: string | null,
  idsCibles: string[],
  groupes: string[]
): Promise<void> {
  const ids =
    perimetreId === null ? [] : idsCibles.filter(id => id !== perimetreId)
  const cles = perimetreId === null ? [] : groupes
  await tx.ficheConnexe.deleteMany({
    where: { ficheId, perimetreId: { notIn: ids } },
  })
  await tx.ficheGroupeConnexe.deleteMany({
    where: { ficheId, groupe: { notIn: cles } },
  })
  await tx.ficheConnexe.createMany({
    data: ids.map(cible => ({ ficheId, perimetreId: cible })),
    skipDuplicates: true,
  })
  await tx.ficheGroupeConnexe.createMany({
    data: cles.map(groupe => ({ ficheId, groupe })),
    skipDuplicates: true,
  })
}

async function importerActivite(
  tx: Transaction,
  organisationId: string,
  modeles: Modeles,
  modele: ActiviteModele,
  ligneId: string | null,
  annee: number | undefined,
  ecrire: boolean,
  empreintes: Empreintes,
  autreActivite: 'suivre' | 'conflit'
): Promise<RapportActivite> {
  const declaration = modele.implicite
    ? {
        slug: modeles.organisation.slug,
        nom: modeles.organisation.nom,
        sigle: modeles.organisation.sigle ?? null,
      }
    : {
        slug: modele.declaration.slug,
        nom: modele.declaration.nom,
        sigle: modele.declaration.sigle ?? null,
        nature: modele.declaration.nature,
        groupes: modele.declaration.groupes,
        phases: modele.declaration.phases ?? Prisma.DbNull,
        ordre: modele.declaration.ordre,
        souhaitsOuverts: modele.declaration.souhaitsOuverts ?? false,
        formulaire: modele.declaration.formulaire ?? Prisma.DbNull,
        identite: identiteEnBase(modele, empreintes) ?? Prisma.DbNull,
      }
  const rapport = rapportActiviteVide(
    declaration.slug,
    ligneId === null ? 'creee' : 'mise-a-jour'
  )

  // Activité. L'activité implicite garde sa nature, ses groupes et ses phases.
  let activiteId = ligneId ?? ''
  if (ecrire && organisationId !== '') {
    activiteId =
      ligneId === null
        ? (
            await tx.activite.create({
              data: {
                organisationId,
                nature: 'EVENEMENT',
                groupes: modele.declaration.groupes,
                // Une activité nouvelle démarre sans module (ADR 0052).
                modules: [],
                ...declaration,
              },
              select: { id: true },
            })
          ).id
        : (
            await tx.activite.update({
              where: { id: ligneId },
              data: declaration,
              select: { id: true },
            })
          ).id
  }

  const periode =
    annee === undefined || activiteId === ''
      ? null
      : await tx.edition.findUnique({
          where: { activiteId_annee: { activiteId, annee } },
        })
  rapport.periode =
    annee === undefined ? null : periode === null ? 'absente' : 'importee'

  // Périmètres
  const existants = new Map(
    (activiteId === ''
      ? []
      : await tx.perimetre.findMany({ where: { activiteId } })
    ).map(p => [p.slug, p])
  )
  const idsPerimetres = new Map<string, string>()
  for (const perimetre of modele.perimetres) {
    const existant = existants.get(perimetre.slug)
    const tachesTypes = modele.taches.get(perimetre.slug) ?? null
    const donnees = {
      nom: perimetre.nom,
      description: perimetre.description ?? null,
      type: perimetre.type,
      groupe: perimetre.groupe,
      couleur: perimetre.couleur?.toUpperCase() ?? null,
      ordre: perimetre.ordre,
      effectifParDefaut: perimetre.effectif ?? null,
      tachesTypes: tachesTypes ?? Prisma.DbNull,
    }
    if (existant === undefined) {
      rapport.perimetres.crees.push(perimetre.slug)
      if (ecrire) {
        const cree = await tx.perimetre.create({
          data: {
            slug: perimetre.slug,
            organisationId,
            activiteId,
            ...donnees,
          },
        })
        idsPerimetres.set(perimetre.slug, cree.id)
      }
      continue
    }
    idsPerimetres.set(perimetre.slug, existant.id)
    const change =
      existant.nom !== donnees.nom ||
      existant.description !== donnees.description ||
      existant.type !== donnees.type ||
      existant.groupe !== donnees.groupe ||
      existant.couleur !== donnees.couleur ||
      existant.ordre !== donnees.ordre ||
      existant.effectifParDefaut !== donnees.effectifParDefaut ||
      JSON.stringify(existant.tachesTypes) !== JSON.stringify(tachesTypes)
    if (change) {
      rapport.perimetres.modifies.push(perimetre.slug)
      if (ecrire)
        // L'import compte comme une modification : un réglage ouvert avant lui
        // ne l'écrase pas sans le dire.
        await tx.perimetre.update({
          where: { id: existant.id },
          data: { ...donnees, version: { increment: 1 } },
        })
    }
  }
  const slugsModeles = new Set(modele.perimetres.map(p => p.slug))
  rapport.perimetres.absentsDuDepot = [...existants.keys()]
    .filter(slug => !slugsModeles.has(slug))
    .sort()

  // Fiches. Le slug est unique dans l'organisation : une fiche passée d'une activité
  // à une autre dans le dépôt suit ce changement, sauf dans un import limité à une
  // activité. Une version écrite dans l'application, importée de l'espace de
  // fichiers ou déposée n'est pas remplacée.
  const { ids: idsFiches } = await importerFiches(
    tx,
    modele.fiches.map(fiche => ({
      slug: fiche.slug,
      titre: fiche.titre,
      contenu: fiche.contenu,
      perimetreId:
        fiche.perimetre === null
          ? null
          : (idsPerimetres.get(fiche.perimetre) ?? null),
    })),
    {
      organisationId,
      activiteId,
      source: 'GIT',
      resume: 'Import depuis le dépôt',
      protegees: ['APP', 'ESPACE_FICHIERS', 'DEPOT'],
      autreActivite,
      ecrire,
    },
    rapport.fiches
  )

  // Un groupe que l'activité ne déclare plus quitte la liste de toutes ses fiches,
  // y compris des fiches absentes du dossier ou en conflit, comme dans
  // `modifierActivite`. L'activité implicite garde les groupes qu'elle a en base.
  if (ecrire && activiteId !== '') {
    const declares = modele.implicite
      ? lireGroupes(
          (
            await tx.activite.findUniqueOrThrow({
              where: { id: activiteId },
              select: { groupes: true },
            })
          ).groupes
        )
      : modele.declaration.groupes
    await tx.ficheGroupeConnexe.deleteMany({
      where: {
        fiche: { activiteId },
        groupe: { notIn: declares.map(g => g.cle) },
      },
    })
  }

  // Liste « Concerne aussi » (ADR 0039), une fois tous les périmètres connus. Une
  // fiche en conflit garde la sienne, comme son contenu.
  if (ecrire) {
    const enConflit = new Set(rapport.fiches.conflits)
    for (const fiche of modele.fiches) {
      const ficheId = idsFiches.get(fiche.slug)
      if (ficheId === undefined || enConflit.has(fiche.slug)) continue
      await appliquerConcerneAussi(
        tx,
        ficheId,
        fiche.perimetre === null
          ? null
          : (idsPerimetres.get(fiche.perimetre) ?? null),
        fiche.concerne.flatMap(slug => idsPerimetres.get(slug) ?? []),
        fiche.concerneGroupes
      )
    }
  }

  if (periode === null) return rapport

  // Effectifs et tâches de la période, depuis les tâches types du dossier.
  await creerTachesDeLaPeriode(
    tx,
    {
      periode,
      activiteId,
      perimetres: modele.perimetres.map(p => ({
        slug: p.slug,
        groupe: p.groupe,
        id: idsPerimetres.get(p.slug),
        archive: existants.get(p.slug)?.archivedAt != null,
        effectif: p.effectif,
      })),
      taches: modele.taches,
      ficheDe: slug =>
        slug === undefined ? null : (idsFiches.get(slug) ?? null),
      ecrire,
    },
    rapport
  )
  return rapport
}
