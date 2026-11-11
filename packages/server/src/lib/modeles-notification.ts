import type {
  FrequenceResume,
  MailPriorites,
  PrismaClient,
  SuiviAdmin,
  SuiviPerimetres,
} from '@relaytour/database'

import { membreActif } from './appartenances.ts'
import { i18n } from './langue.ts'

// Modèles de réglages des notifications (ADR 0065). Un modèle remplit les réglages
// en un geste ; le serveur ne garde pas son nom et le déduit des réglages.

export type Modele =
  'ESSENTIEL' | 'REFERENT' | 'CONTACT_PRINCIPAL' | 'ADMIN_ACTIVITE'

export const MODELES: readonly Modele[] = [
  'ESSENTIEL',
  'REFERENT',
  'CONTACT_PRINCIPAL',
  'ADMIN_ACTIVITE',
]

export interface ReglagesModele {
  suiviPerimetres: SuiviPerimetres
  detailContactPrincipal: boolean
  suiviAdmin: SuiviAdmin
  frequenceResume: FrequenceResume
  mailPriorites: MailPriorites
  mailModification: boolean
  mailEcheance: boolean
  mailDemandes: boolean
  pushEquipe: boolean
}

const COMMUN = {
  mailModification: true,
  mailEcheance: true,
  mailDemandes: true,
} as const

export const REGLAGES_DES_MODELES: Record<Modele, ReglagesModele> = {
  ESSENTIEL: {
    ...COMMUN,
    suiviPerimetres: 'MOI',
    detailContactPrincipal: false,
    suiviAdmin: 'ACTIONS',
    frequenceResume: 'HEBDOMADAIRE',
    mailPriorites: 'MES_PERIMETRES',
    pushEquipe: false,
  },
  REFERENT: {
    ...COMMUN,
    suiviPerimetres: 'SUIVI',
    detailContactPrincipal: false,
    suiviAdmin: 'ACTIONS',
    frequenceResume: 'HEBDOMADAIRE',
    mailPriorites: 'MES_PERIMETRES',
    pushEquipe: false,
  },
  CONTACT_PRINCIPAL: {
    ...COMMUN,
    suiviPerimetres: 'SUIVI',
    detailContactPrincipal: true,
    suiviAdmin: 'ACTIONS',
    frequenceResume: 'QUOTIDIEN',
    mailPriorites: 'MES_PERIMETRES',
    pushEquipe: false,
  },
  ADMIN_ACTIVITE: {
    ...COMMUN,
    suiviPerimetres: 'SUIVI',
    detailContactPrincipal: false,
    suiviAdmin: 'DETAIL',
    frequenceResume: 'QUOTIDIEN',
    mailPriorites: 'ACTIVITE',
    pushEquipe: true,
  },
}

/** Le nom d'un modèle, dans la langue courante. */
export function libelleModele(modele: Modele): string {
  switch (modele) {
    case 'ESSENTIEL':
      return i18n._('Essentiel')
    case 'REFERENT':
      return i18n._('Référent·e')
    case 'CONTACT_PRINCIPAL':
      return i18n._('Contact principal')
    case 'ADMIN_ACTIVITE':
      return i18n._('Admin d’activité')
  }
}

/** Le modèle que des réglages reproduisent, ou null pour des réglages personnalisés. */
export function modeleDe(reglages: ReglagesModele): Modele | null {
  for (const modele of MODELES) {
    const attendu = REGLAGES_DES_MODELES[modele]
    const identiques = (Object.keys(attendu) as (keyof ReglagesModele)[]).every(
      cle => attendu[cle] === reglages[cle]
    )
    if (identiques) return modele
  }
  return null
}

/**
 * Le modèle recommandé pour le rôle le plus large de la personne dans
 * l'organisation : admin, puis contact principal. Une personne seulement affectée
 * garde le modèle Essentiel, qui vaut par défaut ; le modèle Référent·e reste un
 * choix. La recommandation ne change aucun réglage (ADR 0065).
 */
export async function modeleRecommande(
  prisma: PrismaClient,
  userId: string,
  organisationId: string
): Promise<Modele> {
  const [appartenance, adminActivite, affectations] = await Promise.all([
    prisma.appartenance.findFirst({
      where: { userId, organisationId, archiveLe: null },
      select: { role: true },
    }),
    prisma.adminActivite.count({ where: { userId, organisationId } }),
    prisma.affectation.findMany({
      where: {
        userId,
        perimetre: { organisationId },
        edition: { statut: { not: 'ARCHIVEE' } },
        user: membreActif(organisationId),
      },
      select: { contactPrincipal: true },
    }),
  ])
  if (appartenance === null) return 'ESSENTIEL'
  if (appartenance.role === 'ADMIN' || adminActivite > 0)
    return 'ADMIN_ACTIVITE'
  if (affectations.some(a => a.contactPrincipal)) return 'CONTACT_PRINCIPAL'
  return 'ESSENTIEL'
}

/**
 * Le modèle à proposer à une personne : celui de son rôle, quand ses réglages ne le
 * suivent pas et qu'elle ne l'a pas refusé. Null sinon (ADR 0065).
 */
export async function propositionModele(
  prisma: PrismaClient,
  preferences: ReglagesModele & {
    userId: string
    organisationId: string
    modeleEcarte: Modele | null
  }
): Promise<Modele | null> {
  const recommande = await modeleRecommande(
    prisma,
    preferences.userId,
    preferences.organisationId
  )
  return recommande === modeleDe(preferences) ||
    recommande === preferences.modeleEcarte
    ? null
    : recommande
}
