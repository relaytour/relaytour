import { createHash } from 'node:crypto'

// Fonctions pures sur le contenu d'une fiche : empreinte, normalisation, données
// personnelles. Ce module n'importe ni Prisma ni l'environnement validé : la
// validation d'un dossier de contenu (`orga:valider`) tourne sans base et sans `.env`.

/** Empreinte d'une version : SHA-256 du titre et du contenu normalisés. */
export function empreinte(titre: string, contenu: string): string {
  return createHash('sha256')
    .update(`${titre.trim()}\n\n${normaliserContenu(contenu)}`)
    .digest('hex')
}

/** Fins de ligne Unix, espaces de fin de ligne retirés, un seul saut final. */
export function normaliserContenu(contenu: string): string {
  return `${contenu
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(ligne => ligne.trimEnd())
    .join('\n')
    .trim()}\n`
}

// ── Données personnelles ─────────────────────────────────────────────────────

/**
 * Domaines des boîtes partagées de l'organisation, seules adresses admises dans une fiche.
 * Liste séparée par des virgules dans DOMAINES_COURRIEL_AUTORISES ; vide par défaut.
 * La variable se lit à l'appel, jamais au chargement du module : un script qui charge
 * son `.env` après l'import garde le bon résultat.
 */
export function domainesAutorises(
  source: NodeJS.ProcessEnv = process.env
): string[] {
  return (source.DOMAINES_COURRIEL_AUTORISES ?? '')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean)
}

const ADRESSE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
// Numéros français : 06 12 34 56 78, 06.12.34.56.78, +33 6 12 34 56 78.
const TELEPHONE = /(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}/g

/**
 * Relève les adresses mail et les numéros de téléphone d'un texte.
 * Une fiche versionnée dans Git ne doit contenir aucune donnée personnelle
 * (CONTRIBUTING.md, invariant 2) : les contacts s'écrivent sous forme de rôles.
 */
export function donneesPersonnelles(
  texte: string,
  domaines: string[]
): string[] {
  const trouvees: string[] = []
  for (const m of texte.matchAll(ADRESSE)) {
    const domaine = (m[1] ?? '').toLowerCase()
    if (!domaines.includes(domaine)) trouvees.push(masquer(m[0]))
  }
  for (const m of texte.matchAll(TELEPHONE)) trouvees.push(masquer(m[0]))
  return trouvees
}

function masquer(valeur: string): string {
  return `${valeur.slice(0, 3)}…`
}
