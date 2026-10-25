import { t } from '@lingui/core/macro'

// Lecture des tableurs importés depuis l'espace organisateur (ADR 0042, ADR 0049).
// Le fichier se lit dans le navigateur et ne quitte jamais le poste : seules les
// colonnes associées partent vers le serveur. Ce module ne dépend ni de React ni
// des bibliothèques de lecture, que `lireFichier` charge à la demande. Chaque
// import (bénévoles, tâches, équipe) y ajoute ses propres champs.

/** Bornes d'un fichier (ADR 0042). */
export const TAILLE_MAX = 2 * 1024 * 1024
export const LIGNES_MAX = 5000
export const COLONNES_MAX = 200
/** Le serveur reçoit les personnes par lots (corps de requête sous 1 Mo). */
export const LOT = 500

export interface Tableau {
  entetes: string[]
  lignes: string[][]
  /** Le séparateur d'un CSV, repris pour le fichier des lignes écartées. */
  separateur?: string
}

export interface Feuille {
  nom: string
  tableau: Tableau
}

/** Le texte d'un CSV : UTF-8 (avec ou sans BOM), sinon Windows-1252. */
export function decoderTexte(octets: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true })
      .decode(octets)
      .replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(octets)
  }
}

/** Une valeur de cellule en texte : une date devient AAAA-MM-JJ. */
export function texteDeCellule(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10)
  if (typeof valeur === 'string') return valeur.trim()
  if (typeof valeur === 'number' || typeof valeur === 'boolean') {
    return String(valeur)
  }
  return ''
}

/** Un tableau depuis des lignes brutes : la première ligne non vide donne les en-têtes. */
export function tableauDepuis(lignes: readonly unknown[][]): Tableau {
  const textes = lignes
    .map(l => l.map(texteDeCellule))
    .filter(l => l.some(c => c !== ''))
  const [entetes = [], ...reste] = textes
  const largeur = Math.max(entetes.length, ...reste.map(l => l.length))
  if (largeur > COLONNES_MAX) {
    throw new Error(t`Un fichier compte ${COLONNES_MAX} colonnes au plus.`)
  }
  if (reste.length > LIGNES_MAX) {
    throw new Error(t`Un fichier compte ${LIGNES_MAX} lignes au plus.`)
  }
  const nommer = (e: string | undefined, i: number) => {
    const numero = i + 1
    return e && e !== '' ? e : t`Colonne ${numero}`
  }
  return {
    entetes: Array.from({ length: largeur }, (_, i) => nommer(entetes[i], i)),
    lignes: reste.map(l =>
      Array.from({ length: largeur }, (_, i) => l[i] ?? '')
    ),
  }
}

/** Lit un CSV : le séparateur (point-virgule, virgule, tabulation) est détecté. */
export async function lireCsv(texte: string): Promise<Tableau> {
  const { default: Papa } = await import('papaparse')
  const resultat = Papa.parse<string[]>(texte, {
    delimitersToGuess: [';', ',', '\t'],
    skipEmptyLines: 'greedy',
  })
  return {
    ...tableauDepuis(resultat.data),
    separateur: resultat.meta.delimiter,
  }
}

/** Lit un fichier CSV ou XLSX : une feuille par feuille du classeur. */
export async function lireFichier(fichier: File): Promise<Feuille[]> {
  if (fichier.size > TAILLE_MAX) {
    throw new Error(t`Un fichier pèse 2 Mo au plus.`)
  }
  const octets = await fichier.arrayBuffer()
  if (/\.xlsx$/i.test(fichier.name)) {
    const { default: lireClasseur } = await import('read-excel-file/universal')
    const feuilles = await lireClasseur(octets)
    return feuilles.map(f => ({
      nom: f.sheet,
      tableau: tableauDepuis(f.data as unknown[][]),
    }))
  }
  if (/\.(csv|txt)$/i.test(fichier.name)) {
    return [{ nom: fichier.name, tableau: await lireCsv(decoderTexte(octets)) }]
  }
  throw new Error(t`Choisissez un fichier CSV ou Excel (.xlsx).`)
}

// ── Colonnes ─────────────────────────────────────────────────────────────────

export type Confiance = 'HAUTE' | 'MOYENNE' | 'BASSE'

/** Une colonne du fichier et le champ proposé pour elle. */
export interface ColonneDetectee<C extends string> {
  index: number
  entete: string
  exemples: string[]
  champ: C
  confiance: Confiance
  /** Une colonne sensible ne peut qu'être ignorée. */
  sensible: boolean
  remplissage: number
}

/** Les règles de détection des colonnes d'un import. */
export interface ReglesDetection<C extends string> {
  /** Le champ d'une colonne à ne pas importer. */
  ignorer: C
  /** Les synonymes d'en-tête, comparés sans accent ni casse, dans l'ordre. */
  synonymes: readonly (readonly [C, RegExp])[]
  /** Les en-têtes de colonnes qui ne doivent jamais partir. */
  sensibles?: RegExp
  /** Un champ certain d'après l'en-tête brut, avant les synonymes. */
  parEntete?: (entete: string) => C | null
  /** La part des cellules qui ressemblent à chaque champ, pour confirmer ou proposer. */
  parContenu?: (valeurs: readonly string[]) => readonly (readonly [C, number])[]
  /** Les champs qu'une seule colonne reçoit : la plus remplie l'emporte. */
  uniques: readonly C[]
}

/** La part de cellules non vides d'une colonne qui vérifie un test. */
export function part(
  valeurs: readonly string[],
  test: (v: string) => boolean
): number {
  const remplies = valeurs.filter(v => v !== '')
  if (remplies.length === 0) return 0
  return remplies.filter(test).length / remplies.length
}

/** Propose un champ pour chaque colonne, par son en-tête puis par son contenu. */
export function detecterColonnesSelon<C extends string>(
  tableau: Tableau,
  regles: ReglesDetection<C>,
  sansAccent: (texte: string) => string
): ColonneDetectee<C>[] {
  const colonnes: ColonneDetectee<C>[] = tableau.entetes.map(
    (entete, index) => {
      const valeurs = tableau.lignes.map(l => l[index] ?? '')
      const remplies = valeurs.filter(v => v !== '')
      const cle = sansAccent(entete)
      const sensible = regles.sensibles?.test(cle) ?? false
      const base = {
        index,
        entete,
        exemples: [...new Set(remplies)].slice(0, 3),
        sensible,
        remplissage:
          tableau.lignes.length === 0
            ? 0
            : remplies.length / tableau.lignes.length,
      }
      if (sensible) {
        return { ...base, champ: regles.ignorer, confiance: 'HAUTE' as const }
      }
      const certain = regles.parEntete?.(entete) ?? null
      if (certain !== null) {
        return { ...base, champ: certain, confiance: 'HAUTE' as const }
      }
      const synonyme = regles.synonymes.find(([, motif]) =>
        motif.test(cle)
      )?.[0]
      const contenu = (regles.parContenu?.(valeurs) ?? []).find(
        ([, taux]) => taux >= 0.8
      )?.[0]
      // L'en-tête l'emporte ; le contenu le confirme, ou propose un champ quand
      // l'en-tête ne dit rien.
      if (synonyme) {
        return {
          ...base,
          champ: synonyme,
          confiance:
            contenu === synonyme ? ('HAUTE' as const) : ('MOYENNE' as const),
        }
      }
      if (contenu)
        return { ...base, champ: contenu, confiance: 'MOYENNE' as const }
      return { ...base, champ: regles.ignorer, confiance: 'BASSE' as const }
    }
  )
  // Un champ unique revient à la colonne la plus remplie (« Prénom participant »
  // et « Prénom » : la colonne remplie l'emporte).
  for (const champ of regles.uniques) {
    const candidates = colonnes.filter(c => c.champ === champ)
    if (candidates.length < 2) continue
    const gardee = [...candidates].sort(
      (a, b) => b.remplissage - a.remplissage
    )[0]!
    for (const c of candidates) {
      if (c !== gardee)
        Object.assign(c, { champ: regles.ignorer, confiance: 'BASSE' })
    }
  }
  return colonnes
}

// ── Dates ────────────────────────────────────────────────────────────────────

/**
 * Lit une date : AAAA-MM-JJ, JJ/MM/AAAA, ou un nombre de série Excel. Rend
 * AAAA-MM-JJ, ou null.
 */
export function lireDate(texte: string): string | null {
  const t = texte.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return dateValide(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t)
  if (m) {
    const [premier, second, annee] = [Number(m[1]), Number(m[2]), Number(m[3])]
    // JJ/MM/AAAA, sauf quand le second nombre ne peut être qu'un jour : un
    // export américain écrit MM/JJ/AAAA.
    return second > 12 && premier <= 12
      ? dateValide(annee, premier, second)
      : dateValide(annee, second, premier)
  }
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const jours = Math.floor(Number(t))
    // Le nombre de série compte les jours depuis le 30 décembre 1899.
    const date = new Date(Date.UTC(1899, 11, 30) + jours * 86_400_000)
    return date.toISOString().slice(0, 10)
  }
  return null
}

/** AAAA-MM-JJ si le jour existe, sinon null : une date invalide n'atteint pas le serveur. */
function dateValide(annee: number, mois: number, jour: number): string | null {
  const date = new Date(Date.UTC(annee, mois - 1, jour))
  return date.getUTCFullYear() === annee &&
    date.getUTCMonth() === mois - 1 &&
    date.getUTCDate() === jour
    ? date.toISOString().slice(0, 10)
    : null
}

// ── Écriture et lignes écartées ──────────────────────────────────────────────

export interface LigneEcartee {
  ligne: number
  motif: string
  valeurs: string[]
}

/** Les éléments par lots de LOT, dans l'ordre. */
export function enLots<T>(liste: readonly T[], taille = LOT): T[][] {
  const lots: T[][] = []
  for (let i = 0; i < liste.length; i += taille)
    lots.push(liste.slice(i, i + taille))
  return lots
}

/** Les lignes écartées en CSV, avec leur motif en première colonne. */
export async function csvDesEcartees(
  entetes: readonly string[],
  ecartees: readonly LigneEcartee[],
  separateur = ';'
): Promise<string> {
  const { default: Papa } = await import('papaparse')
  return Papa.unparse(
    {
      fields: [
        t({
          message: 'Ligne',
          comment: 'En-tête d’une colonne du fichier des lignes écartées',
        }),
        t({
          message: 'Motif',
          comment: 'En-tête d’une colonne du fichier des lignes écartées',
        }),
        ...entetes,
      ],
      data: ecartees.map(e => [String(e.ligne), e.motif, ...e.valeurs]),
    },
    // Le séparateur du fichier d'origine ; un point-virgule pour un classeur,
    // que les tableurs en français ouvrent colonne par colonne.
    { delimiter: separateur }
  )
}
