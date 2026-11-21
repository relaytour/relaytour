import { createHash, randomBytes } from 'node:crypto'

import { prisma, type Prisma } from '@relaytour/database'

// Jetons remis aux applications tierces (ADR 0067).
//
// Une autorisation d'application est une ligne `JetonAcces` liée à un client : elle
// porte la personne, l'organisation, la portée, les activités et la date de fin, et
// tous les contrôles de l'ADR 0064 s'y appliquent. Sa propre empreinte ne correspond
// à aucune valeur connue : l'application reçoit à la place un jeton d'application
// (une heure) et un jeton de renouvellement (90 jours, qui tourne à chaque usage).

/** Le préfixe d'un jeton d'application. */
export const PREFIXE_JETON_APPLICATION = 'rto_'

/** Le préfixe d'un jeton de renouvellement. */
export const PREFIXE_RENOUVELLEMENT = 'rtr_'

export const FORME_JETON_APPLICATION = /^rto_[A-Za-z0-9_-]{43}$/
export const FORME_RENOUVELLEMENT = /^rtr_[A-Za-z0-9_-]{43}$/

/** Durée d'un jeton d'application. */
export const DUREE_ACCES_S = 60 * 60

/** Durée d'un jeton de renouvellement, glissante. */
export const DUREE_RENOUVELLEMENT_S = 90 * 86_400

/** Durée d'un code d'autorisation. */
export const DUREE_CODE_S = 60

/** Durée d'une demande d'autorisation en attente de réponse. */
export const DUREE_DEMANDE_S = 15 * 60

/** Durée d'une autorisation : un an, comme un jeton d'accès. */
export const DUREE_AUTORISATION_JOURS = 365

/** Autorisations actives d'une personne dans une organisation. */
export const AUTORISATIONS_ACTIVES_MAX = 20

const aleatoire = () => randomBytes(32).toString('base64url')

export const nouveauJetonApplication = () =>
  `${PREFIXE_JETON_APPLICATION}${aleatoire()}`
export const nouveauRenouvellement = () =>
  `${PREFIXE_RENOUVELLEMENT}${aleatoire()}`
/** Un code d'autorisation : 32 octets aléatoires, sans préfixe. */
export const nouveauCode = aleatoire
/** L'identifiant d'une demande, qui figure dans l'adresse du consentement. */
export const nouvelIdDemande = aleatoire

export function empreinte(valeur: string): string {
  return createHash('sha256').update(valeur).digest('hex')
}

/** Le défi PKCE S256 d'un vérificateur (RFC 7636). */
export function defiS256(verificateur: string): string {
  return createHash('sha256').update(verificateur).digest('base64url')
}

/** Un vérificateur PKCE valide : 43 à 128 caractères non réservés (RFC 7636). */
export function verificateurValide(v: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(v)
}

/** Un défi S256 : 32 octets en base64url, sans remplissage. */
export function defiValide(v: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(v)
}

export interface JetonsEmis {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

/**
 * La portée OAuth d'une autorisation : `lecture` ou `lecture ecriture`, suivie de
 * `documents` quand la personne a accordé la lecture du texte des documents
 * (ADR 0072).
 */
export function porteeOAuth(
  portee: 'LECTURE' | 'LECTURE_ECRITURE',
  lectureDocuments = false
): string {
  return [
    'lecture',
    ...(portee === 'LECTURE' ? [] : ['ecriture']),
    ...(lectureDocuments ? ['documents'] : []),
  ].join(' ')
}

/**
 * Émet un jeton d'application et un jeton de renouvellement pour une autorisation.
 * Aucun des deux ne dépasse la fin de l'autorisation.
 */
export async function emettreJetons(
  tx: Prisma.TransactionClient,
  autorisation: {
    id: string
    portee: 'LECTURE' | 'LECTURE_ECRITURE'
    lectureDocuments: boolean
    expireLe: Date
  },
  maintenant = new Date()
): Promise<JetonsEmis> {
  const borne = (s: number) =>
    new Date(
      Math.min(maintenant.getTime() + s * 1000, autorisation.expireLe.getTime())
    )
  // Les jetons expirés de l'autorisation s'effacent à chaque émission. Un jeton de
  // renouvellement déjà échangé reste jusqu'à sa fin : son retour signale un rejeu.
  await tx.jetonApplication.deleteMany({
    where: { jetonAccesId: autorisation.id, expireLe: { lte: maintenant } },
  })
  const acces = nouveauJetonApplication()
  const renouvellement = nouveauRenouvellement()
  const finAcces = borne(DUREE_ACCES_S)
  await tx.jetonApplication.createMany({
    data: [
      {
        jetonAccesId: autorisation.id,
        sorte: 'ACCES',
        empreinte: empreinte(acces),
        expireLe: finAcces,
      },
      {
        jetonAccesId: autorisation.id,
        sorte: 'RENOUVELLEMENT',
        empreinte: empreinte(renouvellement),
        expireLe: borne(DUREE_RENOUVELLEMENT_S),
      },
    ],
  })
  return {
    access_token: acces,
    token_type: 'Bearer',
    expires_in: Math.max(
      0,
      Math.floor((finAcces.getTime() - maintenant.getTime()) / 1000)
    ),
    refresh_token: renouvellement,
    scope: porteeOAuth(autorisation.portee, autorisation.lectureDocuments),
  }
}

/**
 * L'autorisation qu'un jeton d'application désigne, s'il est encore valable. Les
 * contrôles de l'autorisation elle-même (révocation, fin, personne archivée,
 * module fermé) restent ceux d'un jeton d'accès.
 */
export async function autorisationDuJetonApplication(
  jeton: string,
  maintenant = new Date()
): Promise<string | null> {
  if (!FORME_JETON_APPLICATION.test(jeton)) return null
  const ligne = await prisma.jetonApplication.findUnique({
    where: { empreinte: empreinte(jeton) },
    select: { jetonAccesId: true, sorte: true, expireLe: true },
  })
  if (
    ligne === null ||
    ligne.sorte !== 'ACCES' ||
    ligne.expireLe.getTime() <= maintenant.getTime()
  ) {
    return null
  }
  return ligne.jetonAccesId
}

/**
 * Révoque une autorisation et efface ses jetons d'application. Rend vrai si
 * l'autorisation était encore active.
 */
export async function revoquerAutorisation(
  db: Prisma.TransactionClient | typeof prisma,
  jetonAccesId: string,
  maintenant = new Date()
): Promise<boolean> {
  const { count } = await db.jetonAcces.updateMany({
    where: {
      id: jetonAccesId,
      revoqueLe: null,
      clientApplicationId: { not: null },
    },
    data: { revoqueLe: maintenant },
  })
  await db.jetonApplication.deleteMany({ where: { jetonAccesId } })
  return count > 0
}
