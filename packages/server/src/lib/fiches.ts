import { createHash } from 'node:crypto'

import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { peutLirePerimetre } from './droits.ts'

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

// Domaines des boîtes partagées de l'organisation, seules adresses admises dans une fiche.
// Liste séparée par des virgules dans DOMAINES_COURRIEL_AUTORISES ; vide par défaut.
const DOMAINES_AUTORISES = (process.env.DOMAINES_COURRIEL_AUTORISES ?? '')
  .split(',')
  .map(d => d.trim().toLowerCase())
  .filter(Boolean)

const ADRESSE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
// Numéros français : 06 12 34 56 78, 06.12.34.56.78, +33 6 12 34 56 78.
const TELEPHONE = /(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}/g

/**
 * Relève les adresses mail et les numéros de téléphone d'un texte.
 * Une fiche versionnée dans Git ne doit contenir aucune donnée personnelle
 * (CLAUDE.md, invariant 2) : les contacts s'écrivent sous forme de rôles.
 */
export function donneesPersonnelles(
  texte: string,
  domainesAutorises: string[] = DOMAINES_AUTORISES
): string[] {
  const trouvees: string[] = []
  for (const m of texte.matchAll(ADRESSE)) {
    const domaine = (m[1] ?? '').toLowerCase()
    if (!domainesAutorises.includes(domaine)) trouvees.push(masquer(m[0]))
  }
  for (const m of texte.matchAll(TELEPHONE)) trouvees.push(masquer(m[0]))
  return trouvees
}

function masquer(valeur: string): string {
  return `${valeur.slice(0, 3)}…`
}

// ── Droits ───────────────────────────────────────────────────────────────────

/**
 * Lecture : une fiche commune est lisible par toute personne connectée ; une fiche de
 * périmètre suit les droits de lecture du périmètre.
 */
export async function peutLireFiche(
  ctx: AppContext,
  fiche: { perimetreId: string | null }
): Promise<boolean> {
  if (ctx.personne === null) return false
  return fiche.perimetreId === null
    ? true
    : peutLirePerimetre(ctx, fiche.perimetreId)
}

/**
 * Écriture : les admins, et les personnes qui ont reçu un droit de rédaction pour ce
 * périmètre ou pour toutes les fiches. Une fiche commune exige le droit global.
 */
export async function peutRedigerFiche(
  ctx: AppContext,
  perimetreId: string | null
): Promise<boolean> {
  if (ctx.personne === null) return false
  if (ctx.personne.estAdmin) return true
  const droit = await prisma.droitRedaction.findFirst({
    where: {
      userId: ctx.personne.id,
      OR: [
        { perimetreId: null },
        ...(perimetreId === null ? [] : [{ perimetreId }]),
      ],
    },
    select: { id: true },
  })
  return droit !== null
}
