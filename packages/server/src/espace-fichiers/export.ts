import { createHash } from 'node:crypto'

import { prisma, type Prisma } from '@relaytour/database'

import { donneesPersonnelles } from '../lib/contenu.ts'
import { avecDelai } from '../lib/delai.ts'
import { publierChangement } from '../lib/flux.ts'
import { lireGroupes } from '../lib/activites.ts'
import { journal } from '../lib/journal.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'
import { configurationOrganisation } from '../lib/organisation.ts'
import { texteFiche } from '../orga/exporter.ts'

import { ouvrirEspace } from './index.ts'
import { exportDansUnDossierLie } from './isolement.ts'
import type { EspaceFichiers, Position } from './types.ts'

// Export des fiches vers l'espace de fichiers (ADR 0038). Relaytour écrit les
// fiches non archivées en Markdown, au format de `orga:exporter`, dans un dossier
// qu'il a créé. L'export va toujours dans ce sens : Relaytour ne relit jamais ce
// dossier, sauf l'étiquette d'un fichier pour repérer une modification à la main.

export const NOM_DOSSIER_EXPORT = 'Fiches Relaytour'

export const README_EXPORT = `# Fiches Relaytour

Ce dossier contient une copie des fiches de l'organisation, écrite par Relaytour.

Les fiches se modifient dans Relaytour. Relaytour gère les modifications faites en même temps par plusieurs personnes, et garde chaque version.

Relaytour réécrit ce dossier après chaque modification d'une fiche, puis chaque nuit. Une modification faite ici est remplacée à l'export suivant.

Gardez ce dossier en lecture seule pour les membres de l'association.

Chaque fichier commence par un en-tête qui donne l'identifiant de la fiche (\`slug\`) et son titre. L'en-tête d'une fiche qui concerne aussi d'autres périmètres les liste (\`concerne\`, \`concerneGroupes\`). Le dossier contient un sous-dossier par activité. Chaque activité range ses fiches communes dans \`communes/\`, puis les fiches de chaque périmètre dans un dossier à son nom.
`

export interface RapportExport {
  exporteLe: string
  ecrites: number
  inchangees: number
  supprimees: number
  refusees: { fiche: string; raison: string }[]
  /** Fiches modifiées à la main dans l'espace de fichiers, puis réécrites. */
  modifieesALaMain: string[]
  erreur: string | null
}

/**
 * L'admin a changé de dossier d'export, arrêté l'export ou déconnecté l'espace
 * pendant cet export : il s'arrête sans rien enregistrer.
 */
class ExportObsolete extends Error {}

const empreinte = (texte: string) =>
  createHash('sha256').update(texte).digest('hex')

function lireChemin(valeur: Prisma.JsonValue): string[] {
  return Array.isArray(valeur) && valeur.every(s => typeof s === 'string')
    ? valeur
    : []
}

/** Les fiches à exporter, avec leur chemin et leur texte, ou la raison d'un refus. */
async function fichesAExporter(organisationId: string) {
  const configuration = await configurationOrganisation(organisationId)
  const role = {
    domaines: configuration.domainesCourrielAutorises,
    adresses: configuration.adressesRoleAutorisees,
  }
  const fiches = await prisma.fiche.findMany({
    where: {
      organisationId,
      archivedAt: null,
      versionCouranteId: { not: null },
      activite: { archivedAt: null },
    },
    select: {
      id: true,
      slug: true,
      perimetreId: true,
      activite: { select: { slug: true, groupes: true } },
      perimetre: { select: { slug: true, archivedAt: true } },
      versionCourante: { select: { titre: true, contenu: true } },
      connexes: {
        select: {
          perimetreId: true,
          perimetre: { select: { slug: true, archivedAt: true } },
        },
      },
      groupesConnexes: { select: { groupe: true } },
    },
    orderBy: { slug: 'asc' },
  })
  return fiches.map(f => {
    const version = f.versionCourante!
    const chemin = [
      f.activite.slug,
      f.perimetre?.slug ?? 'communes',
      `${f.slug}.md`,
    ]
    if (f.perimetre?.archivedAt) {
      return { id: f.id, slug: f.slug, chemin, refus: 'périmètre archivé' }
    }
    const personnelles = donneesPersonnelles(
      `${version.titre}\n${version.contenu}`,
      role
    )
    if (personnelles.length > 0) {
      return {
        id: f.id,
        slug: f.slug,
        chemin,
        refus: `coordonnées personnelles (${personnelles.join(', ')})`,
      }
    }
    // La liste « Concerne aussi » s'écrit comme dans `orga:exporter` : sans
    // périmètre archivé, ni groupe que l'activité ne déclare plus.
    const declares = new Set(lireGroupes(f.activite.groupes).map(g => g.cle))
    const texte = texteFiche(
      f.slug,
      version.titre,
      version.contenu,
      f.perimetreId === null
        ? []
        : f.connexes.flatMap(c =>
            c.perimetreId === f.perimetreId || c.perimetre.archivedAt !== null
              ? []
              : [c.perimetre.slug]
          ),
      f.perimetreId === null
        ? []
        : f.groupesConnexes.map(g => g.groupe).filter(g => declares.has(g))
    ).toString('utf8')
    return { id: f.id, slug: f.slug, chemin, texte }
  })
}

/**
 * Écrit les fiches de l'organisation dans son dossier d'export. Une fiche
 * inchangée ne se réécrit pas ; une fiche archivée ou déplacée quitte son ancien
 * emplacement. Avec `verifier`, chaque fichier est relu chez le fournisseur : un
 * fichier modifié ou supprimé à la main se réécrit, et le rapport le nomme.
 * Le rapport est gardé sur la connexion. Lève si le fournisseur ne répond pas.
 */
export async function exporterFiches(
  organisationId: string,
  options: { verifier: boolean }
): Promise<RapportExport | null> {
  const connexion = await prisma.connexionFichiers.findUnique({
    where: { organisationId },
    select: {
      etat: true,
      exportEmplacement: true,
      exportElement: true,
      exportAncetres: true,
    },
  })
  if (
    connexion?.etat !== 'ACTIVE' ||
    connexion.exportEmplacement === null ||
    connexion.exportElement === null
  ) {
    return null
  }
  const rapport: RapportExport = {
    exporteLe: new Date().toISOString(),
    ecrites: 0,
    inchangees: 0,
    supprimees: 0,
    refusees: [],
    modifieesALaMain: [],
    erreur: null,
  }
  // Chaque écriture en base vaut pour le dossier d'export lu au départ, sous le
  // verrou que prennent aussi le choix du dossier, l'arrêt et la déconnexion : un
  // export devenu obsolète ne rétablit jamais un suivi effacé.
  const depart = connexion.exportElement
  const sousGeneration = <T>(
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ) =>
    sousVerrouOrganisation(organisationId, async tx => {
      const actuelle = await tx.connexionFichiers.findUnique({
        where: { organisationId },
        select: { exportElement: true },
      })
      if (actuelle?.exportElement !== depart) throw new ExportObsolete()
      return action(tx)
    })
  const enregistrer = async () => {
    await sousGeneration(tx =>
      tx.connexionFichiers.update({
        where: { organisationId },
        data: {
          exportRapport: rapport as unknown as Prisma.InputJsonValue,
          exportLe: new Date(rapport.exporteLe),
        },
      })
    )
    void publierChangement({ entite: 'FICHIERS', organisationId })
  }

  try {
    const { espace } = await ouvrirEspace(organisationId)
    const position = (chemin: string[]): Position => ({
      emplacement: connexion.exportEmplacement!,
      base: connexion.exportElement!,
      chemin,
    })
    if ((await espace.element(position([]))) === null) {
      rapport.erreur =
        'Le dossier d’export n’existe plus chez le fournisseur cloud. Choisissez un autre dossier.'
      await enregistrer()
      return rapport
    }
    // Un admin a pu déplacer le dossier d'export dans un dossier lié : ses
    // lecteurs y liraient les fiches de tous les périmètres. Relaytour n'y
    // écrit plus, et l'écran le signale.
    if (await exportDansUnDossierLie(espace, organisationId, connexion)) {
      rapport.erreur =
        'Le dossier d’export se trouve maintenant dans un dossier lié : ses lecteurs y liraient les fiches de tous les périmètres. Relaytour n’y écrit plus. Déplacez-le, ou choisissez un autre dossier.'
      await enregistrer()
      return rapport
    }
    if ((await espace.element(position(['README.md']))) === null) {
      await espace.ecrire(position(['README.md']), README_EXPORT)
    }

    const exportees = new Map(
      (await prisma.ficheExportee.findMany({ where: { organisationId } })).map(
        e => [e.ficheId, e]
      )
    )
    const dossiersPrets = new Set<string>()
    const assurerDossiers = async (
      espace_: EspaceFichiers,
      chemin: string[]
    ) => {
      for (let i = 1; i < chemin.length; i++) {
        const cle = JSON.stringify(chemin.slice(0, i))
        if (dossiersPrets.has(cle)) continue
        await espace_.creerDossier(
          position(chemin.slice(0, i - 1)),
          chemin[i - 1]!,
          {
            renommer: false,
          }
        )
        dossiersPrets.add(cle)
      }
    }

    const vues = new Set<string>()
    for (const fiche of await fichesAExporter(organisationId)) {
      vues.add(fiche.id)
      if (!('texte' in fiche) || fiche.texte === undefined) {
        // Une fiche refusée garde son dernier export : il ne contient pas la
        // coordonnée personnelle ajoutée depuis.
        rapport.refusees.push({ fiche: fiche.slug, raison: fiche.refus })
        continue
      }
      const precedente = exportees.get(fiche.id)
      const nouvelle = empreinte(fiche.texte)
      const memeChemin =
        precedente !== undefined &&
        JSON.stringify(lireChemin(precedente.chemin)) ===
          JSON.stringify(fiche.chemin)
      if (memeChemin && precedente.empreinte === nouvelle) {
        if (!options.verifier) {
          rapport.inchangees += 1
          continue
        }
        const actuel = await espace.element(position(fiche.chemin))
        if (actuel !== null && actuel.etag === precedente.etag) {
          rapport.inchangees += 1
          continue
        }
        rapport.modifieesALaMain.push(fiche.slug)
      }
      if (precedente !== undefined && !memeChemin) {
        await espace.supprimer(position(lireChemin(precedente.chemin)))
      }
      await assurerDossiers(espace, fiche.chemin)
      const { etag } = await espace.ecrire(position(fiche.chemin), fiche.texte)
      await sousGeneration(tx =>
        tx.ficheExportee.upsert({
          where: { ficheId: fiche.id },
          create: {
            organisationId,
            ficheId: fiche.id,
            chemin: fiche.chemin,
            empreinte: nouvelle,
            etag,
          },
          update: {
            chemin: fiche.chemin,
            empreinte: nouvelle,
            etag,
            exporteeLe: new Date(),
          },
        })
      )
      rapport.ecrites += 1
    }

    // Une fiche archivée, ou d'une activité archivée, quitte le dossier d'export.
    for (const [ficheId, precedente] of exportees) {
      if (vues.has(ficheId)) continue
      await espace.supprimer(position(lireChemin(precedente.chemin)))
      await sousGeneration(tx =>
        tx.ficheExportee.delete({ where: { id: precedente.id } })
      )
      rapport.supprimees += 1
    }
  } catch (erreur) {
    if (erreur instanceof ExportObsolete) return null
    rapport.erreur =
      'Le fournisseur cloud n’a pas répondu pendant l’export. Relaytour recommencera.'
    await enregistrer().catch(() => undefined)
    throw erreur
  }
  try {
    await enregistrer()
  } catch (erreur) {
    if (erreur instanceof ExportObsolete) return null
    throw erreur
  }
  journal.info(
    {
      evenement: 'fiches-exportees',
      organisationId,
      ecrites: rapport.ecrites,
      supprimees: rapport.supprimees,
      refusees: rapport.refusees.length,
      modifieesALaMain: rapport.modifieesALaMain.length,
    },
    'Les fiches ont été exportées vers l’espace de fichiers.'
  )
  return rapport
}

/**
 * Lance tout de suite l'export des fiches d'une organisation, par le worker.
 * Lève si Valkey ne répond pas dans la seconde.
 */
export async function lancerExportFiches(
  organisationId: string
): Promise<void> {
  const { planificationQueue } = await import('../jobs/queues.ts')
  await avecDelai(
    planificationQueue.add('export-fiches', { organisationId }),
    1_000,
    'Export des fiches'
  )
}

/**
 * Planifie l'export des fiches d'une organisation, regroupé sur une minute :
 * toutes les modifications d'une même minute partent dans un seul export. Ne
 * lève jamais et ne retient pas la requête au-delà d'une seconde.
 */
export function planifierExportFiches(organisationId: string): void {
  void (async () => {
    const connexion = await prisma.connexionFichiers.findUnique({
      where: { organisationId },
      select: { etat: true, exportElement: true },
    })
    if (connexion?.etat !== 'ACTIVE' || connexion.exportElement === null) return
    const { planificationQueue } = await import('../jobs/queues.ts')
    const maintenant = Date.now()
    const tranche = Math.floor(maintenant / 60_000)
    await avecDelai(
      planificationQueue.add(
        'export-fiches',
        { organisationId },
        {
          // BullMQ refuse « : » dans un identifiant de job.
          jobId: `export-fiches-${organisationId}-${tranche}`,
          delay: 60_000 - (maintenant % 60_000),
        }
      ),
      1_000,
      'Export des fiches'
    )
  })().catch((erreur: unknown) => {
    journal.warn(
      {
        evenement: 'export-fiches-non-planifie',
        organisationId,
        message: (erreur as Error).message,
      },
      'L’export des fiches n’a pas pu être planifié : l’export de la nuit le rattrapera.'
    )
  })
}
