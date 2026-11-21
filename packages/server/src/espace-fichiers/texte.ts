import { Worker } from 'node:worker_threads'

import { normaliserContenu } from '../lib/contenu.ts'

import { formatApercu } from './chemin.ts'
import type {
  DemandeExtraction,
  ReponseExtraction,
} from './extraction-texte.ts'

// Texte d'un document d'un dossier lié (ADR 0072). Le format se déduit du nom,
// comme dans la liseuse. Le serveur lit 10 Mo au plus, extrait le texte dans un
// fil séparé à la mémoire bornée, puis le normalise et le borne à 200 000
// caractères. Rien ici ne vérifie de droit : la requête `texteDocument` le fait
// avant tout appel.

/** Un document se lit en texte jusqu'à 10 Mo. */
export const TEXTE_TAILLE_MAX = 10 * 1024 * 1024

/** Le texte rendu compte au plus 200 000 caractères. */
export const TEXTE_CARACTERES_MAX = 200_000

/** Un PDF rend au plus ses 200 premières pages. */
export const TEXTE_PAGES_MAX = 200

/** Au-delà de 20 secondes, le serveur arrête le fil d'extraction. */
export const DELAI_EXTRACTION_MS = 20_000

/** Fils d'extraction simultanés dans un processus. Les lectures suivantes attendent. */
const FILS_MAX = 4

/** La mémoire d'un fil d'extraction. Au-delà, Node l'arrête. */
const LIMITES_FIL = {
  maxOldGenerationSizeMb: 256,
  maxYoungGenerationSizeMb: 48,
  codeRangeSizeMb: 32,
  stackSizeMb: 4,
}

export type FormatTexte = DemandeExtraction['format']

/** Un fichier plus lourd que la borne, d'après le fournisseur ou pendant la lecture. */
export class FichierTropLourd extends Error {}

/** Une extraction qui échoue, dépasse sa mémoire ou sa durée. */
export class ExtractionImpossible extends Error {}

/**
 * Le format de lecture d'un fichier, d'après son nom, ou null pour un format non
 * lu. Un document natif du fournisseur n'est jamais lu, même si son nom se termine
 * par une extension connue.
 */
export function formatTexte(nom: string, natif: boolean): FormatTexte | null {
  if (natif) return null
  // Les règles de la liseuse pour le texte, le Markdown et le PDF.
  const apercu = formatApercu(nom, () => false)
  if (apercu === 'PDF' || apercu === 'TEXTE' || apercu === 'MARKDOWN') {
    return apercu
  }
  const point = nom.lastIndexOf('.')
  if (point > 0 && nom.slice(point + 1).toLowerCase() === 'docx') return 'WORD'
  return null
}

/**
 * Les octets d'un flux, jusqu'à `max`. Au-delà, le serveur coupe le téléchargement
 * et lève `FichierTropLourd` : une taille absente ou fausse chez le fournisseur ne
 * fait pas lire plus.
 */
export async function lireOctetsBornes(
  flux: ReadableStream<Uint8Array>,
  max = TEXTE_TAILLE_MAX
): Promise<Buffer> {
  const lecteur = flux.getReader()
  const morceaux: Uint8Array[] = []
  let lus = 0
  try {
    for (;;) {
      const { done, value } = await lecteur.read()
      if (done) break
      lus += value.byteLength
      if (lus > max) {
        await lecteur.cancel().catch(() => undefined)
        throw new FichierTropLourd()
      }
      morceaux.push(value)
    }
  } finally {
    lecteur.releaseLock()
  }
  return Buffer.concat(morceaux, lus)
}

/**
 * Le texte normalisé comme le contenu d'une fiche, sans caractère de contrôle
 * autre que le retour à la ligne et la tabulation. Un texte sans aucun caractère
 * visible devient vide, comme celui d'un PDF scanné.
 */
export function nettoyerTexte(brut: string): string {
  const texte = normaliserContenu(brut).replace(/[^\P{Cc}\n\t]/gu, '')
  return texte.trim() === '' ? '' : texte
}

/**
 * Le texte borné à `max` caractères, sa longueur d'origine et `tronque`. La coupe
 * ne sépare pas les deux moitiés d'un caractère hors du plan de base.
 */
export function bornerTexte(
  texte: string,
  max = TEXTE_CARACTERES_MAX
): { texte: string; caracteres: number; tronque: boolean } {
  if (texte.length <= max) {
    return { texte, caracteres: texte.length, tronque: false }
  }
  const code = texte.charCodeAt(max - 1)
  const coupe = code >= 0xd800 && code <= 0xdbff ? max - 1 : max
  return {
    texte: texte.slice(0, coupe),
    caracteres: texte.length,
    tronque: true,
  }
}

// ── Fil d'extraction ─────────────────────────────────────────────────────────

/**
 * Le fichier du fil. Le serveur compilé le trouve à côté de lui
 * (`dist/extraction-texte.js`) ; les sources le chargent en TypeScript, que Node
 * lit sans compilation.
 */
const FIL = new URL(
  import.meta.url.endsWith('.ts')
    ? './extraction-texte.ts'
    : './extraction-texte.js',
  import.meta.url
)

let filsEnCours = 0
const enAttente: (() => void)[] = []

async function prendrePlace(): Promise<void> {
  if (filsEnCours < FILS_MAX) {
    filsEnCours++
    return
  }
  await new Promise<void>(suite => enAttente.push(suite))
}

function rendrePlace(): void {
  const suivante = enAttente.shift()
  if (suivante === undefined) filsEnCours--
  else suivante()
}

let reglageDeTest: { delaiMs?: number; fichier?: URL } | null = null

/** Remplace le délai ou le fichier du fil, pour les tests seulement. */
export function reglerExtractionPourLesTests(
  reglage: { delaiMs?: number; fichier?: URL } | null
): void {
  reglageDeTest = reglage
}

/**
 * Lance un fil sur ces données et rend son unique message. Le fil s'arrête après
 * sa réponse, à son délai, ou dès une erreur, y compris un dépassement de mémoire.
 */
export function executerFil(
  fichier: URL,
  donnees: unknown,
  delaiMs: number
): Promise<unknown> {
  return new Promise((resoudre, rejeter) => {
    let fini = false
    const fil = new Worker(fichier, {
      workerData: donnees,
      resourceLimits: LIMITES_FIL,
      stdout: true,
      stderr: true,
    })
    // Le fil n'écrit rien d'utile : sa sortie ne rejoint pas le journal du serveur.
    fil.stdout.resume()
    fil.stderr.resume()
    const terminer = (issue: () => void) => {
      if (fini) return
      fini = true
      clearTimeout(minuterie)
      void fil.terminate()
      issue()
    }
    const minuterie = setTimeout(() => {
      terminer(() => rejeter(new ExtractionImpossible('Délai dépassé.')))
    }, delaiMs)
    fil.once('message', (message: unknown) => {
      terminer(() => resoudre(message))
    })
    fil.once('error', () => {
      terminer(() => rejeter(new ExtractionImpossible('Le fil a échoué.')))
    })
    fil.once('exit', () => {
      terminer(() =>
        rejeter(new ExtractionImpossible('Le fil s’est arrêté sans réponse.'))
      )
    })
  })
}

/**
 * Le texte brut d'un fichier, extrait dans un fil séparé. Lève
 * `ExtractionImpossible` pour un fichier illisible, une mémoire dépassée ou une
 * durée de plus de 20 secondes : aucun texte partiel ne sort.
 */
export async function extraireTexte(
  format: FormatTexte,
  octets: Uint8Array
): Promise<{ texte: string; pagesTronquees: boolean }> {
  await prendrePlace()
  try {
    const demande: DemandeExtraction = {
      format,
      octets,
      pagesMax: TEXTE_PAGES_MAX,
    }
    const reponse = (await executerFil(
      reglageDeTest?.fichier ?? FIL,
      demande,
      reglageDeTest?.delaiMs ?? DELAI_EXTRACTION_MS
    )) as ReponseExtraction
    if (reponse.issue !== 'ok' || typeof reponse.texte !== 'string') {
      throw new ExtractionImpossible('Extraction impossible.')
    }
    return { texte: reponse.texte, pagesTronquees: reponse.pagesTronquees }
  } finally {
    rendrePlace()
  }
}
