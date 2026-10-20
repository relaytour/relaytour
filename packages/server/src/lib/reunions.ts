import { prisma, type CibleConvocation, type Prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'

import { decalerJour, exigerEcritureGlobale } from './agenda.ts'
import { membreActif, dansLEquipe } from './appartenances.ts'
import { accesAuPerimetre, exigerEcriture } from './droits.ts'
import { accesRefuse, erreurSaisie } from './erreurs.ts'
import { instantDepuisHeureLocale } from './heures.ts'

// Réunions de l'agenda (ADR 0037).
//
// Une réunion appartient à l'agenda global d'une activité (sans périmètre) ou à
// l'agenda d'un périmètre, pour une période. Les admins de l'activité écrivent
// dans l'agenda global ; les personnes qui écrivent dans un périmètre écrivent
// dans le sien. Une convocation vise un compte de l'équipe, jamais une adresse.

export const TITRE_REUNION_MAX = 200
export const LIEU_MAX = 200
export const LIEN_VISIO_MAX = 500
export const DESCRIPTION_REUNION_MAX = 4000
/** Une réunion lie vingt tâches au plus. */
export const TACHES_LIEES_MAX = 20
/** Une réunion compte 300 personnes convoquées au plus. */
export const CONVOCATIONS_MAX = 300

/** Le lien de visio : une adresse web en http ou https, ou rien. */
export function lienVisioValide(
  brut: string | null | undefined
): string | null {
  const texte = (brut ?? '').trim()
  if (texte === '') return null
  if (texte.length > LIEN_VISIO_MAX) {
    throw erreurSaisie(`Le lien de visio dépasse ${LIEN_VISIO_MAX} caractères.`)
  }
  let adresse: URL
  try {
    adresse = new URL(texte)
  } catch {
    throw erreurSaisie('Le lien de visio doit être une adresse web complète.')
  }
  if (adresse.protocol !== 'https:' && adresse.protocol !== 'http:') {
    throw erreurSaisie('Le lien de visio commence par https://.')
  }
  return adresse.toString()
}

/**
 * Refuse l'écriture d'une réunion : l'agenda global aux admins de l'activité,
 * l'agenda d'un périmètre aux personnes qui y écrivent. Une période archivée est
 * en lecture seule.
 */
export async function exigerEcritureReunion(
  ctx: AppContext,
  lieu: { editionId: string; perimetreId: string | null }
): Promise<{ activiteId: string }> {
  if (lieu.perimetreId === null) {
    const edition = await exigerEcritureGlobale(ctx, lieu.editionId)
    return { activiteId: edition.activiteId }
  }
  await exigerEcriture(ctx, lieu.perimetreId, lieu.editionId)
  const edition = await ctx.exigerEdition(lieu.editionId)
  return { activiteId: edition.activiteId }
}

/**
 * Les tâches liées, vérifiées : de la même période, du même périmètre pour une
 * réunion de périmètre, d'un périmètre de l'activité pour une réunion globale.
 * Une tâche hors de ces règles vaut une tâche inconnue.
 */
export async function tachesLieesValides(
  ids: readonly (string | number)[] | null | undefined,
  lieu: { editionId: string; perimetreId: string | null; activiteId: string }
): Promise<string[]> {
  const uniques = [...new Set((ids ?? []).map(String))]
  if (uniques.length === 0) return []
  if (uniques.length > TACHES_LIEES_MAX) {
    throw erreurSaisie(`Une réunion lie ${TACHES_LIEES_MAX} tâches au plus.`)
  }
  const trouvees = await prisma.tache.count({
    where: {
      id: { in: uniques },
      editionId: lieu.editionId,
      ...(lieu.perimetreId === null
        ? { perimetre: { activiteId: lieu.activiteId } }
        : { perimetreId: lieu.perimetreId }),
    },
  })
  if (trouvees !== uniques.length) {
    throw erreurSaisie('Une des tâches ne peut pas être liée à cette réunion.')
  }
  return uniques
}

/**
 * Les comptes convoqués selon la cible. Tout le périmètre : les personnes
 * affectées pour la période. Toute l'équipe : l'équipe de l'activité (ADR 0018).
 * Au choix : chaque personne doit appartenir à l'équipe, sinon le serveur refuse
 * comme pour un identifiant inconnu. Les personnes archivées ne sont jamais
 * convoquées.
 */
export async function personnesConvoquees(
  organisationId: string,
  demande: {
    cible: CibleConvocation | null
    personneIds?: readonly (string | number)[] | null
    editionId: string
    perimetreId: string | null
    activiteId: string
  }
): Promise<string[]> {
  const actif = membreActif(organisationId)
  let ids: string[]
  if (demande.cible === null) return []
  if (demande.cible === 'PERIMETRE') {
    if (demande.perimetreId === null) {
      throw erreurSaisie(
        'Une réunion de l’agenda global convoque toute l’équipe ou des personnes choisies.'
      )
    }
    ids = (
      await prisma.affectation.findMany({
        where: {
          perimetreId: demande.perimetreId,
          editionId: demande.editionId,
          user: actif,
        },
        select: { userId: true },
      })
    ).map(a => a.userId)
  } else if (demande.cible === 'EQUIPE') {
    ids = (
      await prisma.user.findMany({
        where: { AND: [dansLEquipe([demande.activiteId]), actif] },
        select: { id: true },
      })
    ).map(u => u.id)
  } else {
    const voulus = [...new Set((demande.personneIds ?? []).map(String))]
    if (voulus.length === 0) {
      throw erreurSaisie('Choisissez au moins une personne à convoquer.')
    }
    if (voulus.length > CONVOCATIONS_MAX) {
      throw erreurSaisie(
        `Une réunion compte ${CONVOCATIONS_MAX} personnes convoquées au plus.`
      )
    }
    ids = (
      await prisma.user.findMany({
        where: {
          id: { in: voulus },
          AND: [dansLEquipe([demande.activiteId]), actif],
        },
        select: { id: true },
      })
    ).map(u => u.id)
    if (ids.length !== voulus.length) throw accesRefuse()
  }
  if (ids.length > CONVOCATIONS_MAX) {
    throw erreurSaisie(
      `Une réunion compte ${CONVOCATIONS_MAX} personnes convoquées au plus : choisissez les personnes.`
    )
  }
  return ids
}

/** Une réunion à venir : prévue, et pas encore commencée. */
const aVenir = (maintenant: Date): Prisma.ReunionWhereInput => ({
  statut: 'PREVUE',
  debut: { gt: maintenant },
})

/**
 * Convoque une personne nouvellement affectée aux réunions à venir qui
 * convoquent tout le périmètre (ADR 0037). Renvoie les réunions concernées.
 */
export async function convoquerApresAffectation(
  db: Prisma.TransactionClient,
  demande: {
    userId: string
    perimetreIds: string[]
    editionId: string
    maintenant: Date
  }
): Promise<string[]> {
  if (demande.perimetreIds.length === 0) return []
  const reunions = await db.reunion.findMany({
    where: {
      ...aVenir(demande.maintenant),
      editionId: demande.editionId,
      perimetreId: { in: demande.perimetreIds },
      cible: 'PERIMETRE',
      convocations: { none: { userId: demande.userId } },
    },
    select: { id: true },
  })
  if (reunions.length === 0) return []
  await db.convocationReunion.createMany({
    data: reunions.map(r => ({ reunionId: r.id, userId: demande.userId })),
    skipDuplicates: true,
  })
  return reunions.map(r => r.id)
}

/**
 * Retire une personne des réunions à venir d'un périmètre, quand elle quitte ce
 * périmètre (ADR 0037). Les réunions passées gardent sa convocation. Renvoie les
 * réunions dont la convocation a été retirée.
 */
export async function retirerDesReunionsDuPerimetre(
  db: Prisma.TransactionClient,
  demande: {
    userId: string
    perimetreId: string
    editionId: string
    maintenant: Date
  }
): Promise<string[]> {
  const convocations = await db.convocationReunion.findMany({
    where: {
      userId: demande.userId,
      reunion: {
        ...aVenir(demande.maintenant),
        perimetreId: demande.perimetreId,
        editionId: demande.editionId,
      },
    },
    select: { id: true, reunionId: true },
  })
  if (convocations.length === 0) return []
  await db.convocationReunion.deleteMany({
    where: { id: { in: convocations.map(c => c.id) } },
  })
  return convocations.map(c => c.reunionId)
}

/**
 * Retire une personne archivée de toutes les réunions à venir de
 * l'organisation, sans mail (ADR 0037).
 */
export async function retirerDesReunionsDeLOrganisation(
  db: Prisma.TransactionClient,
  demande: { userId: string; organisationId: string; maintenant: Date }
): Promise<number> {
  const { count } = await db.convocationReunion.deleteMany({
    where: {
      userId: demande.userId,
      reunion: {
        ...aVenir(demande.maintenant),
        organisationId: demande.organisationId,
      },
    },
  })
  return count
}

/**
 * Vrai si la personne lit le détail d'une réunion : le lieu, le lien de visio et
 * la description. Une réunion globale s'ouvre à toute personne qui voit
 * l'activité ; une réunion de périmètre, aux personnes qui lisent ce périmètre et
 * aux personnes convoquées. En consultation, seuls le titre et l'horaire restent.
 */
export async function detailOuvert(
  ctx: AppContext,
  reunion: {
    organisationId: string
    activiteId: string
    perimetreId: string | null
  },
  convoquee: boolean
): Promise<boolean> {
  if (reunion.perimetreId === null || convoquee) return true
  return (
    (await accesAuPerimetre(ctx, {
      id: reunion.perimetreId,
      organisationId: reunion.organisationId,
      activiteId: reunion.activiteId,
    })) === 'COMPLET'
  )
}

/**
 * L'horaire d'une réunion : un jour, une heure de début et une heure de fin dans
 * le fuseau de l'organisation. La fin suit le début, et le jour reste dans les
 * deux ans qui entourent la période.
 */
export function horaireValide(
  saisie: { jour: string; heureDebut: string; heureFin: string },
  periode: { debut: string; fin: string },
  fuseau: string
): { debut: Date; fin: Date } {
  if (
    saisie.jour < decalerJour(periode.debut, -730) ||
    saisie.jour > decalerJour(periode.fin, 730)
  ) {
    throw erreurSaisie(
      'Une réunion se place dans les deux ans qui entourent la période.'
    )
  }
  const debut = instantDepuisHeureLocale(saisie.jour, saisie.heureDebut, fuseau)
  const fin = instantDepuisHeureLocale(saisie.jour, saisie.heureFin, fuseau)
  if (fin.getTime() <= debut.getTime()) {
    throw erreurSaisie('L’heure de fin suit l’heure de début.')
  }
  return { debut, fin }
}
