import { createHash, randomBytes } from 'node:crypto'

import { prisma } from '@relaytour/database'
import { GraphQLError } from 'graphql'

import { chiffrer, dechiffrer, lireCle } from '../lib/chiffrement.ts'
import { journal } from '../lib/journal.ts'

import {
  espaceSharePoint,
  rafraichir,
  type ConfigurationMicrosoft,
} from './sharepoint.ts'
import {
  AccesRetire,
  FournisseurIndisponible,
  type EspaceFichiers,
  type Fournisseur,
} from './types.ts'

// Espace de fichiers d'une organisation (ADR 0038) : configuration des
// fournisseurs, ouverture de l'espace connecté et jetons d'accès. L'environnement
// se lit à la demande : le schéma s'imprime sans .env (invariant 12).

/** Chemin des routes de l'espace, sous /medias/ que le proxy relaie déjà vers l'API. */
export const PREFIXE_ROUTES = '/medias/espace-fichiers'

export async function cleDeChiffrement(): Promise<Buffer | null> {
  const { env } = await import('../env.ts')
  return lireCle(env.CLE_CHIFFREMENT_ESPACE_FICHIERS)
}

export async function configurationMicrosoft(): Promise<ConfigurationMicrosoft | null> {
  const { env } = await import('../env.ts')
  if (
    env.MICROSOFT_CLIENT_ID === undefined ||
    env.MICROSOFT_CLIENT_SECRET === undefined ||
    lireCle(env.CLE_CHIFFREMENT_ESPACE_FICHIERS) === null
  ) {
    return null
  }
  return {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    locataire: env.MICROSOFT_LOCATAIRE,
    retour: `${env.ORIGINE_ORGA}${PREFIXE_ROUTES}/retour/sharepoint`,
  }
}

export async function fournisseursDisponibles(): Promise<Fournisseur[]> {
  if (fabriqueDeTest !== null) return ['SHAREPOINT']
  return (await configurationMicrosoft()) === null ? [] : ['SHAREPOINT']
}

// ── Erreurs ──────────────────────────────────────────────────────────────────

/** Aucun espace connecté, ou un espace à reconnecter. */
export class EspaceIndisponible extends Error {}

/** Traduit une erreur de l'espace de fichiers pour l'interface. */
export function erreurEspace(erreur: unknown): Error {
  if (erreur instanceof EspaceIndisponible || erreur instanceof AccesRetire) {
    return new GraphQLError(
      'L’espace de fichiers n’est pas connecté. Un admin de l’organisation doit le connecter de nouveau.',
      { extensions: { code: 'ESPACE_FICHIERS_INDISPONIBLE' } }
    )
  }
  if (erreur instanceof FournisseurIndisponible) {
    journal.warn(
      { evenement: 'espace-fichiers-indisponible', message: erreur.message },
      'Le fournisseur de l’espace de fichiers ne répond pas.'
    )
    return new GraphQLError(
      'L’espace de fichiers ne répond pas. Réessayez dans quelques instants.',
      { extensions: { code: 'FOURNISSEUR_INDISPONIBLE' } }
    )
  }
  return erreur instanceof Error ? erreur : new Error(String(erreur))
}

// ── Jetons d'accès ───────────────────────────────────────────────────────────

interface JetonEnCache {
  acces: string
  expireLe: number
}

// Le jeton d'accès vit une heure : chaque processus le garde en mémoire. Un seul
// renouvellement à la fois par connexion.
const jetons = new Map<string, JetonEnCache>()
const renouvellements = new Map<string, Promise<string>>()
const MARGE_MS = 60_000

async function renouveler(connexionId: string): Promise<string> {
  const connexion = await prisma.connexionFichiers.findUnique({
    where: { id: connexionId },
    select: { jeton: true, etat: true, organisationId: true },
  })
  if (connexion === null || connexion.etat !== 'ACTIVE') {
    throw new EspaceIndisponible()
  }
  const [cle, configuration] = await Promise.all([
    cleDeChiffrement(),
    configurationMicrosoft(),
  ])
  if (cle === null || configuration === null) throw new EspaceIndisponible()
  const ancien = dechiffrer(connexion.jeton, cle)
  try {
    const nouveaux = await rafraichir(configuration, ancien)
    if (nouveaux.rafraichissement !== ancien) {
      await prisma.connexionFichiers.update({
        where: { id: connexionId },
        data: { jeton: chiffrer(nouveaux.rafraichissement, cle) },
      })
    }
    jetons.set(connexionId, {
      acces: nouveaux.acces,
      expireLe: nouveaux.expireLe,
    })
    return nouveaux.acces
  } catch (erreur) {
    if (erreur instanceof AccesRetire) {
      jetons.delete(connexionId)
      await prisma.connexionFichiers.update({
        where: { id: connexionId },
        data: { etat: 'A_RECONNECTER' },
      })
      journal.warn(
        {
          evenement: 'espace-fichiers-a-reconnecter',
          organisationId: connexion.organisationId,
        },
        'Le fournisseur a retiré l’accès à l’espace de fichiers.'
      )
    }
    throw erreur
  }
}

function jetonDe(connexionId: string) {
  return async (forcer = false): Promise<string> => {
    const enCache = jetons.get(connexionId)
    if (
      !forcer &&
      enCache !== undefined &&
      enCache.expireLe - MARGE_MS > Date.now()
    ) {
      return enCache.acces
    }
    let enCours = renouvellements.get(connexionId)
    if (enCours === undefined) {
      enCours = renouveler(connexionId).finally(() =>
        renouvellements.delete(connexionId)
      )
      renouvellements.set(connexionId, enCours)
    }
    return enCours
  }
}

/** Garde le jeton d'accès reçu à la connexion : le premier appel n'a pas à le renouveler. */
export function memoriserJetonAcces(
  connexionId: string,
  acces: string,
  expireLe: number
): void {
  jetons.set(connexionId, { acces, expireLe })
}

export function oublierJetonAcces(connexionId: string): void {
  jetons.delete(connexionId)
}

// ── Ouverture ────────────────────────────────────────────────────────────────

let fabriqueDeTest: ((organisationId: string) => EspaceFichiers) | null = null

/** Remplace le fournisseur par un espace de test, ou rétablit le vrai avec null. */
export function remplacerEspacePourLesTests(
  fabrique: ((organisationId: string) => EspaceFichiers) | null
): void {
  fabriqueDeTest = fabrique
}

/** L'espace connecté de l'organisation. Lève EspaceIndisponible sans connexion active. */
export async function ouvrirEspace(organisationId: string): Promise<{
  espace: EspaceFichiers
  connexionId: string
}> {
  const connexion = await prisma.connexionFichiers.findUnique({
    where: { organisationId },
    select: { id: true, fournisseur: true, etat: true },
  })
  if (connexion === null || connexion.etat !== 'ACTIVE') {
    throw new EspaceIndisponible()
  }
  if (fabriqueDeTest !== null) {
    return { espace: fabriqueDeTest(organisationId), connexionId: connexion.id }
  }
  switch (connexion.fournisseur) {
    case 'SHAREPOINT':
      return {
        espace: espaceSharePoint(jetonDe(connexion.id)),
        connexionId: connexion.id,
      }
  }
}

// ── État d'une connexion en cours ────────────────────────────────────────────

/** Ce que le retour du fournisseur doit retrouver : qui a commencé, où, et le vérificateur PKCE. */
export interface EtatConnexion {
  organisationId: string
  userId: string
  fournisseur: Fournisseur
  verificateur: string
}

const DUREE_ETAT_S = 10 * 60
const cleEtat = (etat: string) => `espace-fichiers:etat:${etat}`

/** Prépare une connexion : un état à usage unique et le défi PKCE qui l'accompagne. */
export async function commencerConnexion(
  donnees: Omit<EtatConnexion, 'verificateur'>
): Promise<{ etat: string; defi: string }> {
  const etat = randomBytes(32).toString('base64url')
  const verificateur = randomBytes(32).toString('base64url')
  const { connection } = await import('../jobs/queues.ts')
  await connection.set(
    cleEtat(etat),
    JSON.stringify({ ...donnees, verificateur } satisfies EtatConnexion),
    'EX',
    DUREE_ETAT_S
  )
  return {
    etat,
    defi: createHash('sha256').update(verificateur).digest('base64url'),
  }
}

/** Reprend l'état d'une connexion, une seule fois. Null s'il est inconnu ou expiré. */
export async function reprendreConnexion(
  etat: string
): Promise<EtatConnexion | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(etat)) return null
  const { connection } = await import('../jobs/queues.ts')
  const brut = await connection.getdel(cleEtat(etat))
  return brut === null ? null : (JSON.parse(brut) as EtatConnexion)
}
