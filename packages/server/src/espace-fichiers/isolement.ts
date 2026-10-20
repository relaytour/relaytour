import { prisma } from '@relaytour/database'

import type { EspaceFichiers } from './types.ts'

// Isolement du dossier d'export (ADR 0038). Le dossier d'export contient les
// fiches de tous les périmètres : il ne doit se trouver dans aucun dossier lié.
// Un admin peut toutefois le déplacer chez le fournisseur après sa création. Sa
// place se relit donc à chaque contrôle, et non d'après sa place à la création.
// Un même dossier se voit parfois depuis deux emplacements (un Drive partagé et
// « Partagés avec moi », l'espace d'une équipe Dropbox et le dossier d'un
// membre), sous le même identifiant. Les contrôles comparent donc les
// identifiants, quel que soit l'emplacement.

export interface ExportConnu {
  exportEmplacement: string | null
  exportElement: string | null
  exportAncetres: unknown
}

/**
 * Le dossier d'export, puis ses dossiers parents jusqu'à la racine, tels qu'ils
 * sont chez le fournisseur. Sans réponse, la place connue à sa création.
 */
export async function ancetresDeLExport(
  espace: EspaceFichiers,
  connexion: ExportConnu
): Promise<{ id: string; nom: string }[]> {
  if (connexion.exportEmplacement === null || connexion.exportElement === null)
    return []
  const actuels = await espace.ancetres(
    connexion.exportEmplacement,
    connexion.exportElement
  )
  if (actuels !== null) return actuels
  const connus = Array.isArray(connexion.exportAncetres)
    ? (connexion.exportAncetres as string[])
    : [connexion.exportElement]
  return [...connus].reverse().map(id => ({ id, nom: '' }))
}

/**
 * Identifiants des dossiers du chemin, depuis la racine de l'emplacement, puis
 * des dossiers parents du dernier tels que le fournisseur les connaît. Une vue
 * comme « Partagés avec moi » commence en effet sous la racine réelle.
 */
export async function lignee(
  espace: EspaceFichiers,
  emplacement: string,
  chemin: readonly string[]
): Promise<string[]> {
  const ids: string[] = []
  let dernier: string | null = null
  for (let i = 0; i <= chemin.length; i++) {
    const element = await espace.element({
      emplacement,
      base: null,
      chemin: chemin.slice(0, i),
    })
    if (element !== null) ids.push(element.id)
    dernier = element?.id ?? null
  }
  if (dernier !== null && chemin.length > 0) {
    const parents = await espace.ancetres(emplacement, dernier)
    if (parents !== null) ids.push(...parents.map(a => a.id))
  }
  return [...new Set(ids)]
}

/** Vrai quand le dossier d'export se trouve aujourd'hui dans un dossier lié. */
export async function exportDansUnDossierLie(
  espace: EspaceFichiers,
  organisationId: string,
  connexion: ExportConnu
): Promise<boolean> {
  if (connexion.exportEmplacement === null) return false
  const ids = (await ancetresDeLExport(espace, connexion)).map(a => a.id)
  return (
    (await prisma.dossierLie.count({
      where: { organisationId, element: { in: ids } },
    })) > 0
  )
}

/**
 * Sous un dossier lié, le chemin de noms qui mène au dossier d'export, ou null
 * quand le dossier d'export n'y est pas. Le dossier lié ne sert alors jamais ce
 * chemin : ni dans le parcours, ni dans l'aperçu, ni comme ressource.
 */
export async function cheminDeLExportSous(
  espace: EspaceFichiers,
  organisationId: string,
  dossier: { emplacement: string; element: string }
): Promise<{ chemin: string[]; id: string } | null> {
  const connexion = await prisma.connexionFichiers.findUnique({
    where: { organisationId },
    select: {
      exportEmplacement: true,
      exportElement: true,
      exportAncetres: true,
    },
  })
  if (connexion?.exportElement == null) return null
  const ancetres = await ancetresDeLExport(espace, connexion)
  const rang = ancetres.findIndex(a => a.id === dossier.element)
  if (rang < 0) return null
  return {
    chemin: ancetres
      .slice(0, rang)
      .reverse()
      .map(a => a.nom),
    id: connexion.exportElement,
  }
}

/** Vrai quand ce chemin mène dans le dossier d'export, ou au dossier lui-même. */
export function dansLExport(
  chemin: readonly string[],
  cible: { chemin: string[] } | null
): boolean {
  return (
    cible !== null &&
    chemin.length >= cible.chemin.length &&
    cible.chemin.every((nom, i) => chemin[i] === nom)
  )
}
