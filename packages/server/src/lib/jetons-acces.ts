import { createHash, randomBytes } from 'node:crypto'

import {
  prisma,
  type PorteeJeton,
  type Prisma,
  type StatutOrganisation,
} from '@relaytour/database'

import { erreurSaisie } from './erreurs.ts'
import { i18n } from './langue.ts'
import { sousVerrouOrganisation } from './limites.ts'

// Jetons d'accès des programmes tiers (ADR 0064).
//
// Un jeton agit au nom d'une personne, dans une seule organisation, avec les
// droits de cette personne et jamais plus. Sa portée peut retirer l'écriture, et
// sa liste d'activités peut réduire ce que la personne voit. Le serveur garde
// l'empreinte SHA-256 du jeton, jamais le jeton : il ne s'affiche qu'à sa création.
//
// Le module « API » de l'organisation ouvre ou ferme tous ses jetons. Un admin de
// l'organisation l'active ; l'administration de l'installation peut l'interdire,
// l'imposer ou le suspendre. Désactiver le module ne révoque rien : les jetons
// cessent de répondre, puis répondent de nouveau à la réactivation. Une suspension
// par l'installation révoque tous les jetons de l'organisation.

/** Le préfixe d'un jeton d'accès : il le distingue du jeton d'administration. */
export const PREFIXE_JETON = 'rt_'

/** Un jeton d'accès : le préfixe, puis 32 octets aléatoires en base64url. */
export const FORME_JETON = /^rt_[A-Za-z0-9_-]{43}$/

/** Durée de vie d'un jeton : un an au plus, un an par défaut. */
export const DUREE_MAX_JOURS = 365

/** Jetons actifs (ni révoqués ni expirés) d'une personne dans une organisation. */
export const JETONS_ACTIFS_MAX = 10

/** Longueur maximale du nom d'un jeton. */
export const NOM_JETON_MAX = 80

/** Longueur maximale du motif d'une suspension. */
export const MOTIF_SUSPENSION_MAX = 500

/** Le dernier usage d'un jeton s'écrit au plus une fois par minute. */
const ECART_DERNIER_ACCES_MS = 60 * 1000

export function nouveauJetonAcces(): string {
  return `${PREFIXE_JETON}${randomBytes(32).toString('base64url')}`
}

/** Vrai pour une chaîne qui a la forme d'un jeton d'accès. */
export function estUnJetonAcces(valeur: string): boolean {
  return FORME_JETON.test(valeur)
}

/** L'empreinte gardée en base : SHA-256 du jeton complet, préfixe compris. */
export function empreinteJetonAcces(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex')
}

/** Les huit caractères qui suivent le préfixe : de quoi reconnaître un jeton. */
export function apercuJeton(jeton: string): string {
  return jeton.slice(PREFIXE_JETON.length, PREFIXE_JETON.length + 8)
}

// État du module « API »

export type EtatApi =
  'INACTIVE' | 'ACTIVE' | 'IMPOSEE' | 'INTERDITE' | 'SUSPENDUE'

export interface ReglageApi {
  apiActivee: boolean
  apiAutorisee: boolean
  apiImposee: boolean
  apiSuspendueLe: Date | null
}

/**
 * L'état effectif du module. La suspension l'emporte sur tout, puis l'interdiction,
 * puis l'activation imposée, puis le choix de l'organisation.
 */
export function etatApi(o: ReglageApi): EtatApi {
  if (o.apiSuspendueLe !== null) return 'SUSPENDUE'
  if (!o.apiAutorisee) return 'INTERDITE'
  if (o.apiImposee) return 'IMPOSEE'
  return o.apiActivee ? 'ACTIVE' : 'INACTIVE'
}

/** Vrai quand les jetons de l'organisation répondent. */
export function apiOuverte(o: ReglageApi): boolean {
  const etat = etatApi(o)
  return etat === 'ACTIVE' || etat === 'IMPOSEE'
}

/** La cause d'un module fermé, pour le message du refus. */
export function causeFermeture(
  etat: EtatApi
): 'organisation' | 'hebergeur' | 'suspendue' {
  if (etat === 'SUSPENDUE') return 'suspendue'
  if (etat === 'INTERDITE') return 'hebergeur'
  return 'organisation'
}

// Activités d'un jeton

/** La liste d'activités d'un jeton, telle que la base la garde. Nulle : aucune restriction. */
export function lireActivitesDuJeton(brut: unknown): Set<string> | null {
  if (brut === null || brut === undefined || !Array.isArray(brut)) return null
  return new Set(brut.map(String))
}

// Résolution d'un jeton présenté

export interface JetonDuContexte {
  id: string
  portee: PorteeJeton
  /** Activités ouvertes au jeton. Nul : toutes celles que la personne voit. */
  activites: Set<string> | null
  expireLe: Date
}

export type ResolutionJeton =
  | {
      issue: 'ok'
      userId: string
      organisationSlug: string
      jeton: JetonDuContexte
    }
  | { issue: 'invalide' }
  | {
      issue: 'api-fermee'
      cause: 'organisation' | 'hebergeur' | 'suspendue'
      motif: string | null
    }

const STATUTS_OUVERTS: readonly StatutOrganisation[] = [
  'ACTIVE',
  'LECTURE_SEULE',
]

/**
 * Le jeton présenté, s'il est utilisable. Un jeton inconnu, révoqué ou expiré, une
 * personne archivée dans l'organisation et une organisation suspendue reçoivent la
 * même réponse : rien ne dit si le jeton a existé. Un module fermé se dit, avec sa
 * cause : seule une personne qui détient un jeton valide l'apprend.
 */
export async function resoudreJetonAcces(
  jeton: string,
  maintenant = new Date()
): Promise<ResolutionJeton> {
  if (!estUnJetonAcces(jeton)) return { issue: 'invalide' }
  const ligne = await prisma.jetonAcces.findFirst({
    where: { empreinte: empreinteJetonAcces(jeton) },
    select: {
      id: true,
      userId: true,
      organisationId: true,
      portee: true,
      activiteIds: true,
      expireLe: true,
      revoqueLe: true,
      organisation: {
        select: {
          slug: true,
          statut: true,
          apiActivee: true,
          apiAutorisee: true,
          apiImposee: true,
          apiSuspendueLe: true,
          apiSuspensionMotif: true,
        },
      },
    },
  })
  if (
    ligne === null ||
    ligne.revoqueLe !== null ||
    ligne.expireLe.getTime() <= maintenant.getTime() ||
    !STATUTS_OUVERTS.includes(ligne.organisation.statut)
  ) {
    return { issue: 'invalide' }
  }
  const appartenance = await prisma.appartenance.findFirst({
    where: {
      userId: ligne.userId,
      organisationId: ligne.organisationId,
      archiveLe: null,
    },
    select: { id: true },
  })
  if (appartenance === null) return { issue: 'invalide' }
  if (!apiOuverte(ligne.organisation)) {
    const cause = causeFermeture(etatApi(ligne.organisation))
    return {
      issue: 'api-fermee',
      cause,
      motif:
        cause === 'suspendue' ? ligne.organisation.apiSuspensionMotif : null,
    }
  }
  return {
    issue: 'ok',
    userId: ligne.userId,
    organisationSlug: ligne.organisation.slug,
    jeton: {
      id: ligne.id,
      portee: ligne.portee,
      activites: lireActivitesDuJeton(ligne.activiteIds),
      expireLe: ligne.expireLe,
    },
  }
}

/** Note le dernier usage d'un jeton, au plus une fois par minute. */
export async function noterAcces(
  jetonId: string,
  maintenant = new Date()
): Promise<void> {
  await prisma.jetonAcces.updateMany({
    where: {
      id: jetonId,
      OR: [
        { dernierAccesLe: null },
        {
          dernierAccesLe: {
            lt: new Date(maintenant.getTime() - ECART_DERNIER_ACCES_MS),
          },
        },
      ],
    },
    data: { dernierAccesLe: maintenant },
  })
}

// Création et révocation

type Client = Prisma.TransactionClient | typeof prisma

/** La date de fin d'un jeton : celle demandée, bornée à un an, sinon dans un an. */
export function finDuJeton(
  demandee: Date | null | undefined,
  maintenant = new Date()
): Date {
  const max = new Date(maintenant.getTime() + DUREE_MAX_JOURS * 86_400_000)
  if (demandee === null || demandee === undefined) return max
  if (demandee.getTime() <= maintenant.getTime()) {
    throw erreurSaisie(i18n._('La date de fin du jeton doit être à venir.'))
  }
  if (demandee.getTime() > max.getTime()) {
    throw erreurSaisie(
      i18n._('Un jeton vaut un an au plus : choisissez une date plus proche.')
    )
  }
  return demandee
}

export interface JetonACreer {
  organisationId: string
  userId: string
  creeParId: string
  nom: string
  portee: PorteeJeton
  activiteIds: string[] | null
  expireLe: Date
  /** Jetons actifs permis à la porteuse : 10 pour une personne, 5 pour un robot. */
  max?: number
}

/**
 * Crée un jeton et rend sa valeur, la seule fois où elle existe. Le plafond se
 * vérifie sous le verrou de l'organisation : deux créations simultanées ne le
 * dépassent pas.
 */
export async function creerJetonAcces(
  donnees: JetonACreer,
  maintenant = new Date()
) {
  const jeton = nouveauJetonAcces()
  const ligne = await sousVerrouOrganisation(
    donnees.organisationId,
    async tx => {
      const actifs = await tx.jetonAcces.count({
        where: {
          organisationId: donnees.organisationId,
          userId: donnees.userId,
          revoqueLe: null,
          expireLe: { gt: maintenant },
        },
      })
      const max = donnees.max ?? JETONS_ACTIFS_MAX
      if (actifs >= max) {
        throw erreurSaisie(
          donnees.max === undefined
            ? i18n._(
                'Vous avez déjà {max} jetons actifs dans cette organisation : révoquez-en un avant d’en créer un autre.',
                { max }
              )
            : i18n._(
                'Ce robot a déjà {max} jetons actifs : révoquez-en un avant d’en créer un autre.',
                { max }
              )
        )
      }
      return tx.jetonAcces.create({
        data: {
          organisationId: donnees.organisationId,
          userId: donnees.userId,
          creeParId: donnees.creeParId,
          nom: donnees.nom,
          empreinte: empreinteJetonAcces(jeton),
          apercu: apercuJeton(jeton),
          portee: donnees.portee,
          activiteIds: donnees.activiteIds ?? undefined,
          expireLe: donnees.expireLe,
        },
      })
    }
  )
  return { jeton, ligne }
}

/** Révoque les jetons actifs d'une personne dans une organisation. Rend leur nombre. */
export async function revoquerJetonsDe(
  db: Client,
  cible: { organisationId: string; userId: string },
  maintenant = new Date()
): Promise<number> {
  const { count } = await db.jetonAcces.updateMany({
    where: { ...cible, revoqueLe: null },
    data: { revoqueLe: maintenant },
  })
  return count
}

/** Révoque tous les jetons actifs d'une organisation. Rend leur nombre. */
export async function revoquerJetonsDeLOrganisation(
  db: Client,
  organisationId: string,
  maintenant = new Date()
): Promise<number> {
  const { count } = await db.jetonAcces.updateMany({
    where: { organisationId, revoqueLe: null },
    data: { revoqueLe: maintenant },
  })
  return count
}
