import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { prisma } from '@relaytour/database'

import { lireGroupes } from './activites.ts'
import { erreurSaisie } from './erreurs.ts'

// Export complet d'une organisation (ADR 0008).
//
// Le fichier appartient à l'organisation : il porte de quoi reconstituer ses
// activités, ses périodes, ses périmètres, ses fiches avec leur historique, ses
// tâches, ses membres et leurs affectations. Il contient donc des noms et des
// adresses. Il s'écrit sur le disque du serveur (EXPORTS_DIR) et ne transite jamais
// par l'API. Le journal et les notifications n'y figurent pas : le premier se
// déduit des tâches et des fiches, les secondes sont transitoires.
//
// Les personnes sont désignées par leur adresse, les périodes par leur année et les
// autres objets par leur slug : aucun identifiant interne ne sort de la base.

export const FORMAT_EXPORT = 'relaytour-export'
export const VERSION_EXPORT = 1

const jour = (d: Date | null) =>
  d === null ? null : d.toISOString().slice(0, 10)

export async function construireExport(organisationId: string) {
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
  })
  const [membres, activites, affectations, souhaits, droits] =
    await Promise.all([
      prisma.appartenance.findMany({
        where: { organisationId },
        select: {
          role: true,
          user: { select: { email: true, name: true, archivedAt: true } },
        },
        orderBy: { user: { name: 'asc' } },
      }),
      prisma.activite.findMany({
        where: { organisationId },
        orderBy: [{ ordre: 'asc' }, { slug: 'asc' }],
        include: {
          editions: {
            orderBy: { annee: 'asc' },
            include: {
              effectifs: { include: { perimetre: { select: { slug: true } } } },
            },
          },
          perimetres: { orderBy: [{ ordre: 'asc' }, { slug: 'asc' }] },
          fiches: {
            orderBy: { slug: 'asc' },
            include: {
              perimetre: { select: { slug: true } },
              versions: {
                orderBy: { createdAt: 'asc' },
                include: { auteur: { select: { email: true } } },
              },
            },
          },
        },
      }),
      prisma.affectation.findMany({
        where: { perimetre: { organisationId } },
        include: {
          user: { select: { email: true } },
          perimetre: {
            select: { slug: true, activite: { select: { slug: true } } },
          },
          edition: { select: { annee: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.souhait.findMany({
        where: { perimetre: { organisationId } },
        include: {
          user: { select: { email: true } },
          perimetre: {
            select: { slug: true, activite: { select: { slug: true } } },
          },
          edition: { select: { annee: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.droitRedaction.findMany({
        where: { organisationId },
        include: {
          user: { select: { email: true } },
          perimetre: {
            select: { slug: true, activite: { select: { slug: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

  const taches = await prisma.tache.findMany({
    where: { perimetre: { organisationId } },
    orderBy: [{ editionId: 'asc' }, { createdAt: 'asc' }],
    include: {
      edition: { select: { annee: true } },
      perimetre: { select: { slug: true, activiteId: true } },
      fiche: { select: { slug: true } },
      creePar: { select: { email: true } },
      clotureePar: { select: { email: true } },
      realiseePar: { select: { email: true } },
      assignations: { include: { user: { select: { email: true } } } },
    },
  })

  return {
    format: FORMAT_EXPORT,
    version: VERSION_EXPORT,
    exporteLe: new Date().toISOString(),
    organisation: {
      slug: organisation.slug,
      nom: organisation.nom,
      sigle: organisation.sigle,
      fuseauHoraire: organisation.fuseauHoraire,
      statut: organisation.statut,
      declaration: organisation.configuration,
    },
    membres: membres.map(m => ({
      email: m.user.email,
      nom: m.user.name,
      role: m.role,
      archive: m.user.archivedAt !== null,
    })),
    activites: activites.map(a => ({
      slug: a.slug,
      nom: a.nom,
      sigle: a.sigle,
      nature: a.nature,
      groupes: lireGroupes(a.groupes),
      ordre: a.ordre,
      archive: a.archivedAt !== null,
      periodes: a.editions.map(e => ({
        annee: e.annee,
        nom: e.nom,
        debut: jour(e.debut),
        fin: jour(e.fin),
        statut: e.statut,
        effectifs: e.effectifs.map(x => ({
          perimetre: x.perimetre.slug,
          effectif: x.effectif,
        })),
      })),
      perimetres: a.perimetres.map(p => ({
        slug: p.slug,
        nom: p.nom,
        groupe: p.groupe,
        type: p.type,
        couleur: p.couleur,
        ordre: p.ordre,
        archive: p.archivedAt !== null,
      })),
      fiches: a.fiches.map(f => ({
        slug: f.slug,
        perimetre: f.perimetre?.slug ?? null,
        archive: f.archivedAt !== null,
        versions: f.versions.map(v => ({
          titre: v.titre,
          contenu: v.contenu,
          source: v.source,
          resume: v.resume,
          auteur: v.auteur?.email ?? null,
          creeLe: v.createdAt.toISOString(),
          courante: v.id === f.versionCouranteId,
        })),
      })),
      taches: taches
        .filter(t => t.perimetre.activiteId === a.id)
        .map(t => ({
          periode: t.edition.annee,
          perimetre: t.perimetre.slug,
          titre: t.titre,
          description: t.description,
          echeance: jour(t.echeance),
          statut: t.statut,
          modele: t.modeleSlug,
          fiche: t.fiche?.slug ?? null,
          creePar: t.creePar?.email ?? null,
          clotureePar: t.clotureePar?.email ?? null,
          realiseePar: t.realiseePar?.email ?? null,
          termineeLe: t.termineeLe?.toISOString() ?? null,
          assignes: t.assignations.map(x => x.user.email),
          creeLe: t.createdAt.toISOString(),
        })),
    })),
    affectations: affectations.map(x => ({
      email: x.user.email,
      activite: x.perimetre.activite.slug,
      perimetre: x.perimetre.slug,
      periode: x.edition.annee,
    })),
    souhaits: souhaits.map(x => ({
      email: x.user.email,
      activite: x.perimetre.activite.slug,
      perimetre: x.perimetre.slug,
      periode: x.edition.annee,
    })),
    droitsRedaction: droits.map(x => ({
      email: x.user.email,
      activite: x.perimetre?.activite.slug ?? null,
      perimetre: x.perimetre?.slug ?? null,
    })),
  }
}

export type ExportOrganisation = Awaited<ReturnType<typeof construireExport>>

/**
 * Écrit l'export d'une organisation dans un dossier du serveur et renvoie le chemin
 * du fichier. Le nom porte le slug et l'horodatage ; un fichier existant n'est
 * jamais remplacé.
 */
export async function ecrireExport(
  slug: string,
  dossier: string | undefined
): Promise<{ chemin: string; octets: number }> {
  if (dossier === undefined || dossier.trim() === '') {
    throw erreurSaisie(
      'Aucun dossier d’export n’est configuré sur cette installation (EXPORTS_DIR).'
    )
  }
  const organisation = await prisma.organisation.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (organisation === null) {
    throw erreurSaisie(`Aucune organisation ne porte le slug « ${slug} ».`)
  }
  const contenu = JSON.stringify(
    await construireExport(organisation.id),
    null,
    2
  )
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const suffixe = randomBytes(3).toString('hex')
  await mkdir(dossier, { recursive: true, mode: 0o750 })
  const chemin = path.join(dossier, `${slug}-${horodatage}-${suffixe}.json`)
  await writeFile(chemin, contenu + '\n', { flag: 'wx', mode: 0o640 })
  return { chemin, octets: Buffer.byteLength(contenu) + 1 }
}
