// La liste « Concerne aussi » d'une fiche dans l'éditeur (ADR 0039) : des
// périmètres et des groupes de l'activité, la proposition des mentions du texte,
// et le seuil d'une large diffusion. Le serveur vérifie chaque liste.

import { mentionnes, type Mentions } from './mentions'

/** Une liste « Concerne aussi » : des identifiants de périmètres et des clés de groupes. */
export interface Concerne {
  perimetres: string[]
  groupes: string[]
}

export const AUCUNE: Concerne = { perimetres: [], groupes: [] }

/** Une valeur du champ de choix : `p:<id>` pour un périmètre, `g:<clé>` pour un groupe. */
export function versValeurs(c: Concerne): string[] {
  return [...c.groupes.map(g => `g:${g}`), ...c.perimetres.map(p => `p:${p}`)]
}

export function depuisValeurs(valeurs: string[]): Concerne {
  return {
    perimetres: valeurs.filter(v => v.startsWith('p:')).map(v => v.slice(2)),
    groupes: valeurs.filter(v => v.startsWith('g:')).map(v => v.slice(2)),
  }
}

export function memeListe(a: Concerne, b: Concerne): boolean {
  const egal = (x: string[], y: string[]) =>
    x.length === y.length && [...x].sort().join() === [...y].sort().join()
  return egal(a.perimetres, b.perimetres) && egal(a.groupes, b.groupes)
}

/**
 * Les périmètres non archivés que la liste concerne : ceux de la liste, puis ceux
 * de ses groupes. Le périmètre de la fiche n'en fait jamais partie.
 */
export function perimetresConcernes(
  c: Concerne,
  mentions: Mentions,
  perimetreDeLaFiche: string | null
): Set<string> {
  const ids = new Set(c.perimetres)
  for (const cle of c.groupes) {
    for (const p of mentions.groupes.get(cle)?.perimetres ?? []) ids.add(p.id)
  }
  if (perimetreDeLaFiche !== null) ids.delete(perimetreDeLaFiche)
  return ids
}

/**
 * Le seuil d'une large diffusion (ADR 0039) : au moins quatre périmètres, et plus
 * de la moitié des périmètres non archivés de l'activité.
 */
export const SEUIL_MINIMUM = 4

export function largeDiffusion(concernes: number, total: number): boolean {
  return concernes >= SEUIL_MINIMUM && concernes * 2 > total
}

/**
 * Les périmètres et les groupes mentionnés dans le texte et absents de la liste.
 * Le périmètre de la fiche ne se propose jamais.
 */
export function aProposer(
  contenu: string,
  mentions: Mentions,
  c: Concerne,
  perimetreDeLaFiche: string | null
): Concerne {
  const cites = mentionnes(contenu, mentions)
  const deja = new Set(c.perimetres)
  return {
    perimetres: cites.perimetres
      .map(slug => mentions.perimetres.get(slug)?.id)
      .filter(
        (id): id is string =>
          id !== undefined && id !== perimetreDeLaFiche && !deja.has(id)
      ),
    groupes: cites.groupes.filter(g => !c.groupes.includes(g)),
  }
}

/** Réunit deux listes, sans doublon. */
export function reunir(a: Concerne, b: Concerne): Concerne {
  return {
    perimetres: [...new Set([...a.perimetres, ...b.perimetres])],
    groupes: [...new Set([...a.groupes, ...b.groupes])],
  }
}

/** La requête d'une mention en cours de saisie : `@`, puis le début d'un nom. */
const EN_COURS = /(^|[\s([{«"'’])@((?:groupe:)?[a-z0-9-]*)$/

/**
 * La mention que la personne saisit juste avant le curseur, avec la position de
 * son `@` dans le texte qui précède. Null hors d'une mention.
 */
export function mentionEnCours(
  avant: string
): { debut: number; requete: string } | null {
  const trouvee = EN_COURS.exec(avant)
  if (trouvee === null) return null
  const requete = trouvee[2] ?? ''
  return { debut: avant.length - requete.length - 1, requete }
}

export interface Suggestion {
  texte: string
  libelle: string
  groupe: boolean
}

/** Les périmètres et les groupes qui répondent à une mention en cours, huit au plus. */
export function suggestions(requete: string, mentions: Mentions): Suggestion[] {
  const r = requete.toLowerCase()
  const cle = r.startsWith('groupe:') ? r.slice('groupe:'.length) : r
  const normaliser = (t: string) =>
    t
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const groupes = [...mentions.groupes]
    .filter(
      ([g, { libelle }]) =>
        g.startsWith(cle) || normaliser(libelle).startsWith(normaliser(cle))
    )
    .map(([g, { libelle }]) => ({
      texte: `@groupe:${g}`,
      libelle,
      groupe: true,
    }))
  const perimetres = r.startsWith('groupe:')
    ? []
    : [...mentions.perimetres.values()]
        .filter(
          p =>
            p.slug.startsWith(cle) ||
            normaliser(p.nom).includes(normaliser(cle))
        )
        .map(p => ({ texte: `@${p.slug}`, libelle: p.nom, groupe: false }))
  return [...perimetres, ...groupes].slice(0, 8)
}
