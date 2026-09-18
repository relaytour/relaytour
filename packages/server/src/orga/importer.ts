import type { PrismaClient } from '@relaytour/database'

import { empreinte } from '../lib/fiches.ts'

import { dateEcheance, type Modeles } from './modeles.ts'

export interface RapportImport {
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
      `L'édition ${options.annee} n'existe pas. Créez-la d'abord dans l'espace organisateur.`
    )
  }

  await prisma.$transaction(
    async tx => {
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
              data: { slug: modele.slug, ...donnees },
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
            data: { slug: modele.slug, perimetreId },
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

  return rapport
}
