import type { PrismaClient } from '@relaytour/database'

import { mettreEnFile } from '../courriel/file.ts'

import { COURRIEL } from './benevoles.ts'
import { JOIGNABLE } from './espace-benevole.ts'
import { courrielTronque, journal } from './journal.ts'
import { limiterParCle } from './limite.ts'

// Rappel des adresses d'un membre (ADR 0054).
//
// L'administration de l'installation transmet une adresse saisie sur la page d'accès
// d'un hébergeur. Si l'adresse appartient à un membre, l'installation lui écrit
// elle-même : un compte reçoit l'adresse de l'espace organisateur, une fiche bénévole
// confirmée reçoit de nouveau son lien personnel. Rien ne revient à l'appelant : la
// mutation répond toujours vrai, que l'adresse soit connue ou non.

/** Un rappel par adresse toutes les dix minutes. */
export const RAPPELS_PAR_ADRESSE = { max: 1, fenetreSecondes: 600 }
/** Trois rappels par adresse et par jour. */
export const RAPPELS_PAR_ADRESSE_ET_PAR_JOUR = {
  max: 3,
  fenetreSecondes: 86_400,
}

// Organisations dont les membres lisent encore l'espace : une organisation suspendue
// ou archivée n'ouvre plus aucun accès, et son rappel n'aurait pas d'objet.
const STATUTS_OUVERTS = ['ACTIVE', 'LECTURE_SEULE'] as const

/** L'adresse en minuscules, ou null quand elle n'a pas la forme d'une adresse. */
export function adresseDuRappel(brut: string): string | null {
  const adresse = brut.trim().toLowerCase()
  if (adresse.length > 254 || !COURRIEL.test(adresse)) return null
  return adresse
}

/**
 * Met en file les rappels d'une adresse : un mail pour un compte qui a une
 * appartenance active, et le lien personnel de chaque fiche bénévole confirmée.
 * Rend le nombre de mails mis en file, pour les tests seulement : l'API ne le
 * rend jamais.
 */
export async function rappelerAdresses(
  prisma: PrismaClient,
  brut: string,
  maintenant = new Date()
): Promise<number> {
  const adresse = adresseDuRappel(brut)
  if (adresse === null) return 0
  // La limite compte chaque demande, qu'elle mène à un mail ou non : le débit ne
  // dépend pas de l'existence de l'adresse.
  const permis =
    (await limiterParCle(
      `rappel:${adresse}`,
      RAPPELS_PAR_ADRESSE.max,
      RAPPELS_PAR_ADRESSE.fenetreSecondes
    )) &&
    (await limiterParCle(
      `rappel-jour:${adresse}`,
      RAPPELS_PAR_ADRESSE_ET_PAR_JOUR.max,
      RAPPELS_PAR_ADRESSE_ET_PAR_JOUR.fenetreSecondes
    ))
  if (!permis) {
    journal.warn(
      {
        evenement: 'rappel-adresses-limite',
        destinataire: courrielTronque(adresse),
      },
      'Trop de rappels demandés pour cette adresse.'
    )
    return 0
  }

  let enFile = 0
  const appartenanceOuverte = {
    archiveLe: null,
    organisation: { statut: { in: [...STATUTS_OUVERTS] } },
  }
  const compte = await prisma.user.findFirst({
    where: { email: adresse, appartenances: { some: appartenanceOuverte } },
    select: {
      id: true,
      // Le mail porte le nom et les couleurs d'une organisation du compte : sans elle,
      // un compte de plusieurs organisations recevrait l'identité de la première
      // organisation de l'installation, dont il n'est peut-être pas membre.
      appartenances: {
        where: appartenanceOuverte,
        select: { organisationId: true },
        orderBy: { organisation: { nom: 'asc' } },
        take: 1,
      },
    },
  })
  if (compte !== null) {
    if (
      await mettreEnFile(
        'rappel-adresse',
        { userId: compte.id },
        {
          jobId: `rappel-adresse-${compte.id}-${maintenant.getTime()}`,
          organisationId: compte.appartenances[0]?.organisationId,
        }
      )
    ) {
      enFile += 1
    }
  }

  // Une fiche reçoit de nouveau son lien seulement si la personne a déjà confirmé
  // son adresse depuis ce lien (ADR 0041) : une adresse saisie par erreur par
  // l'équipe ne reçoit rien de plus que le premier mail.
  const fiches = await prisma.benevole.findMany({
    where: {
      ...JOIGNABLE,
      courriel: adresse,
      courrielConfirmeLe: { not: null },
      lienEnvoyeLe: { not: null },
      organisation: { statut: { in: [...STATUTS_OUVERTS] } },
    },
    select: { id: true, organisationId: true, activiteId: true },
  })
  for (const fiche of fiches) {
    if (
      await mettreEnFile(
        'benevole-lien',
        { benevoleId: fiche.id },
        {
          jobId: `benevole-rappel-${fiche.id}-${maintenant.getTime()}`,
          organisationId: fiche.organisationId,
          activiteId: fiche.activiteId,
        }
      )
    ) {
      enFile += 1
    }
  }

  journal.info(
    { evenement: 'rappel-adresses-traite', mails: enFile },
    'Une demande de rappel des adresses a été traitée.'
  )
  return enFile
}
