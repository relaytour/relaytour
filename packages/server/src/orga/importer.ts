import type { PrismaClient } from '@relaytour/database'

import { empreinte } from '../lib/fiches.ts'
import { lireLimites } from '../lib/limites.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { dateEcheance, type ActiviteModele, type Modeles } from './modeles.ts'

export interface RapportActivite {
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
  effectifs: { crees: string[]; dejaPresents: string[] }
  taches: { creees: string[]; dejaPresentes: string[] }
}

export interface RapportImport {
  /** La ligne Organisation créée ou mise à jour depuis organisation.yaml. */
  organisation: { slug: string; etat: 'creee' | 'mise-a-jour' }
  activites: RapportActivite[]
  /** Activités en base que le dépôt ne décrit pas : signalées, jamais archivées. */
  activitesAbsentesDuDepot: string[]
  /**
   * Activité d'amorçage « defaut », vide, retirée au premier import d'un dépôt en
   * disposition activites/ qui ne la décrit pas.
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
    taches: { creees: [], dejaPresentes: [] },
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
        ecrire
      )
      const rapport: RapportImport = {
        organisation: {
          slug: modeles.organisation.slug,
          etat: organisation.etat,
        },
        activites: [],
        activitesAbsentesDuDepot: [],
        amorcageRetire: false,
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
      // La migration a créé une activité « defaut » pour chaque organisation. Un
      // dépôt en disposition activites/ qui ne la décrit pas la retire, si elle est
      // vide : elle deviendrait sinon l'activité affichée par défaut.
      const amorcage = enBase.find(
        a => a.slug === 'defaut' && !retrouvees.has(a.id)
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
          ecrire
        )
        if (resultat.periode === 'importee') periodesTrouvees += 1
        rapport.activites.push(resultat)
      }
      if (options.annee !== undefined && periodesTrouvees === 0) {
        throw new Error(
          `Aucune activité n'a de période ${options.annee}. Créez-la d'abord dans l'espace organisateur ou avec edition:creer (dist/creer-edition.js dans l'image).`
        )
      }
      return rapport
    },
    { timeout: 60_000 }
  )

  invaliderConfigurationOrganisation()
  return rapport
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

async function importerActivite(
  tx: Transaction,
  organisationId: string,
  modeles: Modeles,
  modele: ActiviteModele,
  ligneId: string | null,
  annee: number | undefined,
  ecrire: boolean
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
        ordre: modele.declaration.ordre,
      }
  const rapport = rapportActiviteVide(
    declaration.slug,
    ligneId === null ? 'creee' : 'mise-a-jour'
  )

  // Activité. L'activité implicite garde sa nature et ses groupes.
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
    const donnees = {
      nom: perimetre.nom,
      type: perimetre.type,
      groupe: perimetre.groupe,
      couleur: perimetre.couleur?.toUpperCase() ?? null,
      ordre: perimetre.ordre,
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
      existant.type !== donnees.type ||
      existant.groupe !== donnees.groupe ||
      existant.couleur !== donnees.couleur ||
      existant.ordre !== donnees.ordre
    if (change) {
      rapport.perimetres.modifies.push(perimetre.slug)
      if (ecrire)
        await tx.perimetre.update({ where: { id: existant.id }, data: donnees })
    }
  }
  const slugsModeles = new Set(modele.perimetres.map(p => p.slug))
  rapport.perimetres.absentsDuDepot = [...existants.keys()]
    .filter(slug => !slugsModeles.has(slug))
    .sort()

  // Fiches. Le slug est unique dans l'organisation : une fiche passée d'une activité
  // à une autre dans le dépôt suit ce changement.
  const idsFiches = new Map<string, string>()
  for (const fiche of modele.fiches) {
    const perimetreId =
      fiche.perimetre === null
        ? null
        : (idsPerimetres.get(fiche.perimetre) ?? null)
    const nouvelleEmpreinte = empreinte(fiche.titre, fiche.contenu)
    const existante =
      organisationId === ''
        ? null
        : await tx.fiche.findUnique({
            where: {
              organisationId_slug: { organisationId, slug: fiche.slug },
            },
            include: {
              versionCourante: { select: { empreinte: true, source: true } },
            },
          })
    if (existante === null) {
      rapport.fiches.creees.push(fiche.slug)
      if (!ecrire) continue
      const creee = await tx.fiche.create({
        data: { slug: fiche.slug, perimetreId, organisationId, activiteId },
      })
      const version = await tx.ficheVersion.create({
        data: {
          ficheId: creee.id,
          titre: fiche.titre,
          contenu: fiche.contenu,
          empreinte: nouvelleEmpreinte,
          source: 'GIT',
          resume: 'Import depuis le dépôt',
        },
      })
      await tx.fiche.update({
        where: { id: creee.id },
        data: { versionCouranteId: version.id },
      })
      idsFiches.set(fiche.slug, creee.id)
      continue
    }
    idsFiches.set(fiche.slug, existante.id)
    if (
      ecrire &&
      (existante.activiteId !== activiteId ||
        existante.perimetreId !== perimetreId)
    ) {
      await tx.fiche.update({
        where: { id: existante.id },
        data: { activiteId, perimetreId },
      })
    }
    if (existante.versionCourante?.empreinte === nouvelleEmpreinte) {
      rapport.fiches.inchangees.push(fiche.slug)
      continue
    }
    if (existante.versionCourante?.source === 'APP') {
      rapport.fiches.conflits.push(fiche.slug)
      continue
    }
    rapport.fiches.nouvellesVersions.push(fiche.slug)
    if (!ecrire) continue
    const version = await tx.ficheVersion.create({
      data: {
        ficheId: existante.id,
        titre: fiche.titre,
        contenu: fiche.contenu,
        empreinte: nouvelleEmpreinte,
        source: 'GIT',
        resume: 'Import depuis le dépôt',
      },
    })
    await tx.fiche.update({
      where: { id: existante.id },
      data: { versionCouranteId: version.id },
    })
  }

  if (periode === null) return rapport

  // Effectifs de la période
  const effectifsExistants = new Set(
    (
      await tx.effectifPerimetre.findMany({
        where: { editionId: periode.id },
        select: { perimetreId: true },
      })
    ).map(e => e.perimetreId)
  )
  for (const perimetre of modele.perimetres) {
    if (perimetre.effectif === undefined) continue
    const perimetreId = idsPerimetres.get(perimetre.slug)
    if (perimetreId !== undefined && effectifsExistants.has(perimetreId)) {
      rapport.effectifs.dejaPresents.push(perimetre.slug)
      continue
    }
    rapport.effectifs.crees.push(`${perimetre.slug} (${perimetre.effectif})`)
    if (!ecrire || perimetreId === undefined) continue
    await tx.effectifPerimetre.create({
      data: {
        perimetreId,
        editionId: periode.id,
        effectif: perimetre.effectif,
      },
    })
  }

  // Tâches types
  for (const [slugPerimetre, taches] of modele.taches) {
    const perimetreId = idsPerimetres.get(slugPerimetre)
    for (const tache of taches) {
      const cle = `${slugPerimetre}/${tache.modele}`
      const existante =
        perimetreId === undefined
          ? null
          : await tx.tache.findFirst({
              where: {
                editionId: periode.id,
                perimetreId,
                modeleSlug: tache.modele,
              },
              select: { id: true },
            })
      if (existante !== null) {
        rapport.taches.dejaPresentes.push(cle)
        continue
      }
      rapport.taches.creees.push(cle)
      if (!ecrire || perimetreId === undefined) continue
      await tx.tache.create({
        data: {
          editionId: periode.id,
          perimetreId,
          modeleSlug: tache.modele,
          titre: tache.titre,
          description: tache.description?.trim() || null,
          echeance: dateEcheance(tache.echeance, periode.debut),
          ficheId:
            tache.fiche === undefined
              ? null
              : (idsFiches.get(tache.fiche) ?? null),
        },
      })
    }
  }
  return rapport
}
