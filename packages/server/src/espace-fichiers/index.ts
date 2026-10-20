import { createHash, randomBytes } from 'node:crypto'

import { Prisma, prisma } from '@relaytour/database'
import { GraphQLError } from 'graphql'

import { chiffrer, dechiffrer, lireCle } from '../lib/chiffrement.ts'
import { avecDelai } from '../lib/delai.ts'
import { journal } from '../lib/journal.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'

import { convertibleParMicrosoft } from './chemin.ts'
import {
  convertibleParDropbox,
  espaceDropbox,
  rafraichirDropbox,
  type ConfigurationDropbox,
} from './dropbox.ts'
import {
  convertibleParGoogle,
  espaceGoogleDrive,
  jetonCompteService,
  natifGoogle,
  rafraichirGoogle,
  type CleCompteService,
  type ConfigurationGoogle,
} from './google.ts'
import {
  compteNextcloud,
  espaceNextcloud,
  type ConfigurationNextcloud,
  type SecretNextcloud,
} from './nextcloud.ts'
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

export async function configurationGoogle(): Promise<ConfigurationGoogle | null> {
  const { env } = await import('../env.ts')
  if (
    env.GOOGLE_CLIENT_ID === undefined ||
    env.GOOGLE_CLIENT_SECRET === undefined ||
    lireCle(env.CLE_CHIFFREMENT_ESPACE_FICHIERS) === null
  ) {
    return null
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    retour: `${env.ORIGINE_ORGA}${PREFIXE_ROUTES}/retour/google`,
  }
}

export async function configurationDropbox(): Promise<ConfigurationDropbox | null> {
  const { env } = await import('../env.ts')
  if (
    env.DROPBOX_CLIENT_ID === undefined ||
    env.DROPBOX_CLIENT_SECRET === undefined ||
    lireCle(env.CLE_CHIFFREMENT_ESPACE_FICHIERS) === null
  ) {
    return null
  }
  return {
    clientId: env.DROPBOX_CLIENT_ID,
    clientSecret: env.DROPBOX_CLIENT_SECRET,
    retour: `${env.ORIGINE_ORGA}${PREFIXE_ROUTES}/retour/dropbox`,
  }
}

/**
 * Nextcloud n'a pas d'application à inscrire : l'exploitant fixe seulement les
 * hôtes qu'une organisation peut désigner.
 */
export async function configurationNextcloud(): Promise<ConfigurationNextcloud | null> {
  const { env } = await import('../env.ts')
  const hotes = env.NEXTCLOUD_HOTES ?? []
  if (
    hotes.length === 0 ||
    lireCle(env.CLE_CHIFFREMENT_ESPACE_FICHIERS) === null
  )
    return null
  return { tous: hotes.includes('*'), hotes: hotes.filter(h => h !== '*') }
}

export type Methode = 'COMPTE' | 'COMPTE_SERVICE'

/**
 * Les connexions que l'exploitant a ouvertes. Un compte de service Google ne
 * demande que la clé de chiffrement : l'organisation apporte sa propre clé.
 */
export async function connexionsPossibles(): Promise<
  { fournisseur: Fournisseur; methode: Methode }[]
> {
  if (fabriqueDeTest !== null) {
    return [
      { fournisseur: 'SHAREPOINT', methode: 'COMPTE' },
      { fournisseur: 'GOOGLE_DRIVE', methode: 'COMPTE_SERVICE' },
    ]
  }
  const [microsoft, google, dropbox, nextcloud, cle] = await Promise.all([
    configurationMicrosoft(),
    configurationGoogle(),
    configurationDropbox(),
    configurationNextcloud(),
    cleDeChiffrement(),
  ])
  return [
    ...(microsoft === null
      ? []
      : [{ fournisseur: 'SHAREPOINT' as const, methode: 'COMPTE' as const }]),
    ...(google === null
      ? []
      : [{ fournisseur: 'GOOGLE_DRIVE' as const, methode: 'COMPTE' as const }]),
    ...(cle === null
      ? []
      : [
          {
            fournisseur: 'GOOGLE_DRIVE' as const,
            methode: 'COMPTE_SERVICE' as const,
          },
        ]),
    ...(dropbox === null
      ? []
      : [{ fournisseur: 'DROPBOX' as const, methode: 'COMPTE' as const }]),
    ...(nextcloud === null
      ? []
      : [{ fournisseur: 'NEXTCLOUD' as const, methode: 'COMPTE' as const }]),
  ]
}

/**
 * Enregistre la connexion d'une organisation, secret chiffré. Un changement de
 * fournisseur efface le dossier d'export et son suivi : ils appartiennent à
 * l'ancien espace. Renvoie la génération de la connexion (le secret chiffré).
 */
export async function enregistrerConnexion(donnees: {
  organisationId: string
  fournisseur: Fournisseur
  methode: Methode
  compte: string
  secret: string
  connecteParId: string
}): Promise<{ id: string; jeton: string }> {
  const cle = await cleDeChiffrement()
  if (cle === null) throw new EspaceIndisponible()
  const { organisationId } = donnees
  return sousVerrouOrganisation(organisationId, async tx => {
    const ancienne = await tx.connexionFichiers.findUnique({
      where: { organisationId },
      select: { fournisseur: true, jeton: true },
    })
    const autreFournisseur =
      ancienne !== null &&
      (ancienne.fournisseur !== donnees.fournisseur ||
        identiteEspace(ancienne.fournisseur, () =>
          dechiffrer(ancienne.jeton, cle)
        ) !== identiteEspace(donnees.fournisseur, () => donnees.secret))
    if (autreFournisseur) {
      await tx.ficheExportee.deleteMany({ where: { organisationId } })
    }
    const champs = {
      fournisseur: donnees.fournisseur,
      methode: donnees.methode,
      compte: donnees.compte.slice(0, 255),
      jeton: chiffrer(donnees.secret, cle),
      etat: 'ACTIVE' as const,
      connecteParId: donnees.connecteParId,
      ...(autreFournisseur
        ? {
            exportEmplacement: null,
            exportElement: null,
            exportNom: null,
            exportAncetres: Prisma.DbNull,
            exportRapport: Prisma.DbNull,
            exportLe: null,
          }
        : {}),
    }
    return tx.connexionFichiers.upsert({
      where: { organisationId },
      create: { organisationId, ...champs },
      update: champs,
      select: { id: true, jeton: true },
    })
  })
}

/**
 * Ce qui distingue deux espaces d'un même fournisseur : le serveur, pour
 * Nextcloud. Null pour un fournisseur qui n'a qu'un espace.
 */
function identiteEspace(
  fournisseur: Fournisseur,
  secret: () => string
): string | null {
  if (fournisseur !== 'NEXTCLOUD') return null
  try {
    return (JSON.parse(secret()) as SecretNextcloud).base.toLowerCase()
  } catch {
    return ''
  }
}

/** Vrai quand l'espace de test remplace les fournisseurs. */
export function espaceDeTest(): boolean {
  return fabriqueDeTest !== null
}

/**
 * Vrai quand ce fournisseur sait rendre ce document en PDF. Un document Google
 * natif se reconnaît à son type, lu chez le fournisseur.
 */
export function convertitEnPdf(
  fournisseur: Fournisseur,
  nom: string,
  typeMime?: string | null
): boolean {
  switch (fournisseur) {
    case 'SHAREPOINT':
      return convertibleParMicrosoft(nom)
    case 'GOOGLE_DRIVE':
      return convertibleParGoogle(nom, typeMime)
    case 'DROPBOX':
      return convertibleParDropbox(nom)
    case 'NEXTCLOUD':
      return false
  }
}

/** Vrai pour un document natif du fournisseur, sans contenu propre (Google). */
export function documentNatif(
  fournisseur: Fournisseur,
  typeMime: string | null | undefined
): boolean {
  return fournisseur === 'GOOGLE_DRIVE' && natifGoogle(typeMime)
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

// Le jeton d'accès vit une heure : chaque processus le garde en mémoire. Une
// connexion se désigne ici par sa génération : le jeton chiffré en base, qui
// change à chaque connexion et à chaque rotation. Un jeton obtenu pour une
// génération ne sert jamais à une autre : un renouvellement commencé avant une
// reconnexion ne réinstalle pas l'ancien compte. Un seul renouvellement à la
// fois par génération.
const jetons = new Map<string, JetonEnCache>()
const renouvellements = new Map<string, Promise<string>>()
const MARGE_MS = 60_000

async function renouveler(
  connexionId: string,
  generation: string
): Promise<string> {
  const connexion = await prisma.connexionFichiers.findUnique({
    where: { id: connexionId },
    select: {
      jeton: true,
      etat: true,
      organisationId: true,
      fournisseur: true,
      methode: true,
    },
  })
  if (
    connexion === null ||
    connexion.etat !== 'ACTIVE' ||
    connexion.jeton !== generation
  ) {
    throw new EspaceIndisponible()
  }
  const cle = await cleDeChiffrement()
  if (cle === null) throw new EspaceIndisponible()
  const ancien = dechiffrer(generation, cle)
  try {
    const nouveaux = await obtenirJetons(connexion, ancien)
    let courante = generation
    if (nouveaux.rafraichissement !== ancien) {
      courante = chiffrer(nouveaux.rafraichissement, cle)
      // L'écriture ne vaut que pour la génération lue au départ.
      const { count } = await prisma.connexionFichiers.updateMany({
        where: { id: connexionId, jeton: generation },
        data: { jeton: courante },
      })
      if (count === 0) throw new EspaceIndisponible()
    }
    jetons.set(courante, {
      acces: nouveaux.acces,
      expireLe: nouveaux.expireLe,
    })
    return nouveaux.acces
  } catch (erreur) {
    if (erreur instanceof AccesRetire) {
      jetons.delete(generation)
      const { count } = await prisma.connexionFichiers.updateMany({
        where: { id: connexionId, jeton: generation },
        data: { etat: 'A_RECONNECTER' },
      })
      if (count > 0) {
        journal.warn(
          {
            evenement: 'espace-fichiers-a-reconnecter',
            organisationId: connexion.organisationId,
          },
          'Le fournisseur a retiré l’accès à l’espace de fichiers.'
        )
      }
    }
    throw erreur
  }
}

/**
 * De nouveaux jetons d'accès à partir du secret gardé : le jeton de
 * rafraîchissement d'un compte, ou la clé d'un compte de service. Le secret rendu
 * remplace l'ancien quand le fournisseur le fait tourner.
 */
async function obtenirJetons(
  connexion: { fournisseur: Fournisseur; methode: Methode },
  secret: string
): Promise<{ acces: string; rafraichissement: string; expireLe: number }> {
  if (connexion.fournisseur === 'SHAREPOINT') {
    const configuration = await configurationMicrosoft()
    if (configuration === null) throw new EspaceIndisponible()
    return rafraichir(configuration, secret)
  }
  if (connexion.fournisseur === 'DROPBOX') {
    const configuration = await configurationDropbox()
    if (configuration === null) throw new EspaceIndisponible()
    return rafraichirDropbox(configuration, secret)
  }
  if (connexion.fournisseur === 'NEXTCLOUD') {
    // Le mot de passe d'application ne s'échange pas : il sert tel quel. Le
    // renouvellement vérifie qu'il est toujours accepté.
    const configuration = await configurationNextcloud()
    if (configuration === null) throw new EspaceIndisponible()
    const s = JSON.parse(secret) as SecretNextcloud
    await compteNextcloud(configuration, s.base, s.identifiant, s.motDePasse)
    return {
      acces: secret,
      rafraichissement: secret,
      expireLe: Date.now() + 60 * 60_000,
    }
  }
  if (connexion.methode === 'COMPTE_SERVICE') {
    const jetons = await jetonCompteService(
      JSON.parse(secret) as CleCompteService
    )
    return { ...jetons, rafraichissement: secret }
  }
  const configuration = await configurationGoogle()
  if (configuration === null) throw new EspaceIndisponible()
  return rafraichirGoogle(configuration, secret)
}

function jetonDe(connexionId: string, generation: string) {
  return async (forcer = false): Promise<string> => {
    const enCache = jetons.get(generation)
    if (
      !forcer &&
      enCache !== undefined &&
      enCache.expireLe - MARGE_MS > Date.now()
    ) {
      return enCache.acces
    }
    let enCours = renouvellements.get(generation)
    if (enCours === undefined) {
      enCours = renouveler(connexionId, generation).finally(() =>
        renouvellements.delete(generation)
      )
      renouvellements.set(generation, enCours)
    }
    return enCours
  }
}

/**
 * Garde le jeton d'accès reçu à la connexion, pour sa génération : le premier
 * appel n'a pas à le renouveler.
 */
export function memoriserJetonAcces(
  generation: string,
  acces: string,
  expireLe: number
): void {
  jetons.set(generation, { acces, expireLe })
}

export function oublierJetonAcces(generation: string): void {
  jetons.delete(generation)
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
    select: {
      id: true,
      fournisseur: true,
      methode: true,
      etat: true,
      jeton: true,
    },
  })
  if (connexion === null || connexion.etat !== 'ACTIVE') {
    throw new EspaceIndisponible()
  }
  if (fabriqueDeTest !== null) {
    return { espace: fabriqueDeTest(organisationId), connexionId: connexion.id }
  }
  const jeton = jetonDe(connexion.id, connexion.jeton)
  switch (connexion.fournisseur) {
    case 'SHAREPOINT':
      return { espace: espaceSharePoint(jeton), connexionId: connexion.id }
    case 'GOOGLE_DRIVE':
      return {
        espace: espaceGoogleDrive(jeton, {
          compteService: connexion.methode === 'COMPTE_SERVICE',
        }),
        connexionId: connexion.id,
      }
    case 'DROPBOX':
      return { espace: espaceDropbox(jeton), connexionId: connexion.id }
    case 'NEXTCLOUD': {
      const configuration = await configurationNextcloud()
      if (configuration === null) throw new EspaceIndisponible()
      return {
        espace: espaceNextcloud(jeton, configuration),
        connexionId: connexion.id,
      }
    }
  }
}

/**
 * Renouvelle l'accès à l'espace de fichiers d'une organisation. Un jeton de
 * rafraîchissement inutilisé expire : le worker l'utilise chaque nuit. Un accès
 * retiré passe la connexion à l'état « à reconnecter ».
 */
export async function renouvelerAcces(organisationId: string): Promise<void> {
  const connexion = await prisma.connexionFichiers.findUnique({
    where: { organisationId },
    select: { id: true, etat: true, jeton: true },
  })
  if (connexion?.etat !== 'ACTIVE' || fabriqueDeTest !== null) return
  await jetonDe(connexion.id, connexion.jeton)(true)
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
// Valkey, sur le chemin d'une requête, répond en une seconde ou échoue (invariant 17).
const DELAI_VALKEY_MS = 1_000
const cleEtat = (etat: string) => `espace-fichiers:etat:${etat}`

/** Prépare une connexion : un état à usage unique et le défi PKCE qui l'accompagne. */
export async function commencerConnexion(
  donnees: Omit<EtatConnexion, 'verificateur'>
): Promise<{ etat: string; defi: string }> {
  const etat = randomBytes(32).toString('base64url')
  const verificateur = randomBytes(32).toString('base64url')
  const { connection } = await import('../jobs/queues.ts')
  await avecDelai(
    connection.set(
      cleEtat(etat),
      JSON.stringify({ ...donnees, verificateur } satisfies EtatConnexion),
      'EX',
      DUREE_ETAT_S
    ),
    DELAI_VALKEY_MS,
    'État de connexion'
  )
  return {
    etat,
    defi: createHash('sha256').update(verificateur).digest('base64url'),
  }
}

/**
 * Connexion Nextcloud en cours : la base saisie et le sondage du Login Flow v2.
 * Nextcloud garde la demande vingt minutes ; l'état aussi.
 */
export interface EtatConnexionNextcloud {
  organisationId: string
  userId: string
  base: string
  sondage: string
  jeton: string
}

const DUREE_NEXTCLOUD_S = 20 * 60
const cleNextcloud = (etat: string) => `espace-fichiers:nextcloud:${etat}`

export async function garderConnexionNextcloud(
  donnees: EtatConnexionNextcloud
): Promise<string> {
  const etat = randomBytes(32).toString('base64url')
  const { connection } = await import('../jobs/queues.ts')
  await avecDelai(
    connection.set(
      cleNextcloud(etat),
      JSON.stringify(donnees),
      'EX',
      DUREE_NEXTCLOUD_S
    ),
    DELAI_VALKEY_MS,
    'État de connexion'
  )
  return etat
}

/** L'état d'une connexion Nextcloud, relu à chaque sondage. Null s'il est inconnu ou expiré. */
export async function lireConnexionNextcloud(
  etat: string
): Promise<EtatConnexionNextcloud | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(etat)) return null
  const { connection } = await import('../jobs/queues.ts')
  const brut = await avecDelai(
    connection.get(cleNextcloud(etat)),
    DELAI_VALKEY_MS,
    'État de connexion'
  )
  return brut === null ? null : (JSON.parse(brut) as EtatConnexionNextcloud)
}

/** Retire l'état d'une connexion Nextcloud. Vrai pour l'appel qui l'a retiré. */
export async function oublierConnexionNextcloud(
  etat: string
): Promise<boolean> {
  const { connection } = await import('../jobs/queues.ts')
  return (
    (await avecDelai(
      connection.del(cleNextcloud(etat)),
      DELAI_VALKEY_MS,
      'État de connexion'
    )) > 0
  )
}

/** Reprend l'état d'une connexion, une seule fois. Null s'il est inconnu ou expiré. */
export async function reprendreConnexion(
  etat: string
): Promise<EtatConnexion | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(etat)) return null
  const { connection } = await import('../jobs/queues.ts')
  const brut = await avecDelai(
    connection.getdel(cleEtat(etat)),
    DELAI_VALKEY_MS,
    'État de connexion'
  )
  return brut === null ? null : (JSON.parse(brut) as EtatConnexion)
}
