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
 * Domaines de messageries grand public. Une adresse de ces domaines appartient le
 * plus souvent à une personne : aucun de ces domaines ne peut devenir un domaine
 * d'adresses de rôle (ADR 0009). Une boîte partagée hébergée chez l'un d'eux
 * s'autorise par son adresse complète.
 */
export const MESSAGERIES_GRAND_PUBLIC: ReadonlySet<string> = new Set([
  'aol.com',
  'bbox.fr',
  'free.fr',
  'gmail.com',
  'gmx.com',
  'gmx.fr',
  'googlemail.com',
  'hotmail.com',
  'hotmail.fr',
  'icloud.com',
  'laposte.net',
  'live.com',
  'live.fr',
  'mac.com',
  'mail.com',
  'me.com',
  'msn.com',
  'neuf.fr',
  'orange.fr',
  'outlook.com',
  'outlook.fr',
  'proton.me',
  'protonmail.com',
  'sfr.fr',
  'wanadoo.fr',
  'yahoo.com',
  'yahoo.fr',
  'yandex.com',
])

/** Vrai pour un domaine de messagerie grand public, sous-domaines compris. */
export function messagerieGrandPublic(domaine: string): boolean {
  const d = domaine.trim().toLowerCase()
  for (const m of MESSAGERIES_GRAND_PUBLIC) {
    if (d === m || d.endsWith(`.${m}`)) return true
  }
  return false
}

/**
 * Domaines des boîtes partagées de l'organisation, lus à l'amorçage dans
 * DOMAINES_COURRIEL_AUTORISES (liste séparée par des virgules, vide par défaut).
 * Un domaine de messagerie grand public est ignoré. La variable se lit à l'appel,
 * jamais au chargement du module : un script qui charge son `.env` après l'import
 * garde le bon résultat.
 */
export function domainesAutorises(
  source: NodeJS.ProcessEnv = process.env
): string[] {
  return (source.DOMAINES_COURRIEL_AUTORISES ?? '')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(d => d !== '' && !messagerieGrandPublic(d))
}

/**
 * Ce qui rend une adresse institutionnelle : son domaine figure parmi les domaines
 * d'adresses de rôle, ou l'adresse complète figure parmi les exceptions déclarées.
 */
export interface AdressesDeRole {
  domaines: readonly string[]
  adresses?: readonly string[]
}

/** Vrai pour une adresse de rôle de l'organisation. */
export function adresseDeRole(adresse: string, role: AdressesDeRole): boolean {
  const a = adresse.trim().toLowerCase()
  const domaine = a.slice(a.lastIndexOf('@') + 1)
  return role.domaines.includes(domaine) || (role.adresses ?? []).includes(a)
}

const ADRESSE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
// Numéros français : 06 12 34 56 78, 06.12.34.56.78, +33 6 12 34 56 78.
const TELEPHONE = /(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}/g

/**
 * Relève les adresses mail et les numéros de téléphone d'un texte.
 * Une fiche versionnée dans Git ne doit contenir aucune donnée personnelle
 * (CONTRIBUTING.md, invariant 2) : les contacts s'écrivent sous forme de rôles.
 * Seules les adresses de rôle de l'organisation échappent au relevé.
 */
export function donneesPersonnelles(
  texte: string,
  role: AdressesDeRole
): string[] {
  const trouvees: string[] = []
  for (const m of texte.matchAll(ADRESSE)) {
    if (!adresseDeRole(m[0], role)) trouvees.push(masquer(m[0]))
  }
  for (const m of texte.matchAll(TELEPHONE)) trouvees.push(masquer(m[0]))
  return trouvees
}

function masquer(valeur: string): string {
  return `${valeur.slice(0, 3)}…`
}
