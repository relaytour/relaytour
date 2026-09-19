import type { PrismaClient } from '@relaytour/database'

import { empreinte } from '../lib/fiches.ts'
import { invaliderConfigurationOrganisation } from '../lib/organisation.ts'

import { dateEcheance, type Modeles } from './modeles.ts'

export interface RapportImport {
  /** La ligne Organisation créée ou mise à jour depuis organisation.yaml. */
  organisation: { slug: string; etat: 'creee' | 'mise-a-jour' }
  perimetres: { crees: string[]; modifies: string[]; absentsDuDepot: string[] }
  fiches: {
    creees: string[]
    nouvellesVersions: string[]
    inchangees: string[]
    conflits: string[]
  }
  effectifs: { crees: string[]; dejaPresents: string[] }
  taches: { creees: string[]; dejaPresentes: string[] }
}

/**
 * Importe les modèles Git en base.
 *
 * - Les périmètres sont créés ou mis à jour par slug. Un périmètre absent du dépôt
 *   est signalé, jamais archivé.
 * - Une fiche reçoit une version `GIT` seulement si son contenu diffère. Si la version
 *   courante vient de l'application, l'import signale un conflit et ne remplace rien.
 * - L'effectif souhaité d'un périmètre est créé pour l'édition demandée s'il manque,
 *   jamais remplacé : les admins le modifient ensuite dans l'app.
 * - Les tâches types sont créées pour l'édition demandée, une seule fois par modèle :
 *   une tâche déjà importée n'est jamais modifiée, car elle a pu évoluer dans l'app.
 *
 * Avec `simulation`, le rapport est calculé sans rien écrire.
 */
export async function importerModeles(
  prisma: PrismaClient,
  modeles: Modeles,
  options: { annee?: number; simulation?: boolean } = {}
): Promise<RapportImport> {
  const rapport: RapportImport = {
    organisation: { slug: modeles.organisation.slug, etat: 'creee' },
    perimetres: { crees: [], modifies: [], absentsDuDepot: [] },
    fiches: { creees: [], nouvellesVersions: [], inchangees: [], conflits: [] },
    effectifs: { crees: [], dejaPresents: [] },
    taches: { creees: [], dejaPresentes: [] },
  }
  const ecrire = options.simulation !== true

  const edition =
    options.annee === undefined
      ? null
      : await prisma.edition.findUnique({ where: { annee: options.annee } })
  if (options.annee !== undefined && edition === null) {
    throw new Error(
      `L'édition ${options.annee} n'existe pas. Créez-la d'abord dans l'espace organisateur ou avec edition:creer (dist/creer-edition.js dans l'image).`
    )
  }

  await prisma.$transaction(
    async tx => {
      // Organisation : une seule ligne par installation (lot commun). Elle est créée
      // au premier import, puis mise à jour à chaque import, slug compris.
      const lignes = await tx.organisation.findMany({
        select: { id: true, slug: true },
        orderBy: { createdAt: 'asc' },
      })
      if (lignes.length > 1) {
        throw new Error(
          'Plusieurs organisations existent en base : précisez laquelle importer (lot multi à venir).'
        )
      }
      const declaration = modeles.organisation
      const donneesOrganisation = {
        slug: declaration.slug,
        nom: declaration.nom,
        sigle: declaration.sigle ?? null,
        fuseauHoraire: declaration.fuseauHoraire,
        configuration: declaration,
      }
      let organisationId: string
      if (lignes[0] === undefined) {
        rapport.organisation.etat = 'creee'
        organisationId = ecrire
          ? (await tx.organisation.create({ data: donneesOrganisation })).id
          : ''
      } else {
        if (lignes[0].slug !== 'defaut' && lignes[0].slug !== declaration.slug) {
          throw new Error(
            `L'installation appartient à l'organisation « ${lignes[0].slug} » ; le dépôt déclare « ${declaration.slug} ». Import refusé.`
          )
        }
        rapport.organisation.etat = 'mise-a-jour'
        organisationId = lignes[0].id
        if (ecrire) {
          await tx.organisation.update({
            where: { id: organisationId },
            data: donneesOrganisation,
          })
        }
      }

      // Périmètres
      const existants = new Map(
        (await tx.perimetre.findMany()).map(p => [p.slug, p])
      )
      const idsPerimetres = new Map<string, string>()
      for (const modele of modeles.perimetres) {
        const existant = existants.get(modele.slug)
        const donnees = {
          nom: modele.nom,
          type: modele.type,
          couleur: modele.couleur?.toUpperCase() ?? null,
          ordre: modele.ordre,
        }
        if (existant === undefined) {
          rapport.perimetres.crees.push(modele.slug)
          if (ecrire) {
            const cree = await tx.perimetre.create({
              data: { slug: modele.slug, organisationId, ...donnees },
            })
            idsPerimetres.set(modele.slug, cree.id)
          }
        } else {
          idsPerimetres.set(modele.slug, existant.id)
          const change =
            existant.nom !== donnees.nom ||
            existant.type !== donnees.type ||
            existant.couleur !== donnees.couleur ||
            existant.ordre !== donnees.ordre
          if (change) {
            rapport.perimetres.modifies.push(modele.slug)
            if (ecrire)
              await tx.perimetre.update({
                where: { id: existant.id },
                data: donnees,
              })
          }
        }
      }
      const slugsModeles = new Set(modeles.perimetres.map(p => p.slug))
      rapport.perimetres.absentsDuDepot = [...existants.keys()]
        .filter(slug => !slugsModeles.has(slug))
        .sort()

      // Fiches
      const idsFiches = new Map<string, string>()
      for (const modele of modeles.fiches) {
        const perimetreId =
          modele.perimetre === null
            ? null
            : (idsPerimetres.get(modele.perimetre) ?? null)
        const nouvelleEmpreinte = empreinte(modele.titre, modele.contenu)
        const existante = await tx.fiche.findUnique({
          where: { slug: modele.slug },
          include: {
            versionCourante: { select: { empreinte: true, source: true } },
          },
        })
        if (existante === null) {
          rapport.fiches.creees.push(modele.slug)
          if (!ecrire) continue
          const fiche = await tx.fiche.create({
            data: { slug: modele.slug, perimetreId, organisationId },
          })
          const version = await tx.ficheVersion.create({
            data: {
              ficheId: fiche.id,
              titre: modele.titre,
              contenu: modele.contenu,
              empreinte: nouvelleEmpreinte,
              source: 'GIT',
              resume: 'Import depuis le dépôt',
            },
          })
          await tx.fiche.update({
            where: { id: fiche.id },
            data: { versionCouranteId: version.id },
          })
          idsFiches.set(modele.slug, fiche.id)
          continue
        }
        idsFiches.set(modele.slug, existante.id)
        if (existante.versionCourante?.empreinte === nouvelleEmpreinte) {
          rapport.fiches.inchangees.push(modele.slug)
          continue
        }
        if (existante.versionCourante?.source === 'APP') {
          rapport.fiches.conflits.push(modele.slug)
          continue
        }
        rapport.fiches.nouvellesVersions.push(modele.slug)
        if (!ecrire) continue
        const version = await tx.ficheVersion.create({
          data: {
            ficheId: existante.id,
            titre: modele.titre,
            contenu: modele.contenu,
            empreinte: nouvelleEmpreinte,
            source: 'GIT',
            resume: 'Import depuis le dépôt',
          },
        })
        await tx.fiche.update({
          where: { id: existante.id },
          data: { versionCouranteId: version.id, perimetreId },
        })
      }

      if (edition === null) return

      // Effectifs de l'édition
      const effectifsExistants = new Set(
        (
          await tx.effectifPerimetre.findMany({
            where: { editionId: edition.id },
            select: { perimetreId: true },
          })
        ).map(e => e.perimetreId)
      )
      for (const modele of modeles.perimetres) {
        if (modele.effectif === undefined) continue
        const perimetreId = idsPerimetres.get(modele.slug)
        if (perimetreId !== undefined && effectifsExistants.has(perimetreId)) {
          rapport.effectifs.dejaPresents.push(modele.slug)
          continue
        }
        rapport.effectifs.crees.push(`${modele.slug} (${modele.effectif})`)
        if (!ecrire || perimetreId === undefined) continue
        await tx.effectifPerimetre.create({
          data: {
            perimetreId,
            editionId: edition.id,
            effectif: modele.effectif,
          },
        })
      }

      // Tâches types
      for (const [slugPerimetre, taches] of modeles.taches) {
        const perimetreId = idsPerimetres.get(slugPerimetre)
        for (const modele of taches) {
          const cle = `${slugPerimetre}/${modele.modele}`
          const existante =
            perimetreId === undefined
              ? null
              : await tx.tache.findFirst({
                  where: {
                    editionId: edition.id,
                    perimetreId,
                    modeleSlug: modele.modele,
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
              editionId: edition.id,
              perimetreId,
              modeleSlug: modele.modele,
              titre: modele.titre,
              description: modele.description?.trim() || null,
              echeance: dateEcheance(modele.echeance, edition.debut),
              ficheId:
                modele.fiche === undefined
                  ? null
                  : (idsFiches.get(modele.fiche) ?? null),
            },
          })
        }
      }
    },
    { timeout: 60_000 }
  )

  invaliderConfigurationOrganisation()
  return rapport
}
