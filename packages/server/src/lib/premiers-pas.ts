import { Prisma, prisma } from '@relaytour/database'
import { z } from 'zod'

import { configurationActivite } from './organisation.ts'

// Liste « Premiers pas » d'une activité (ADR 0048). L'état de chaque étape se
// calcule à partir des données, sauf la première : seul un admin confirme que
// l'activité est bien décrite. Une étape faite par un autre chemin (un autre écran,
// un import, la ligne de commande) est donc cochée.

export const ETAPES = [
  'ACTIVITE',
  'PERIODE',
  'PERIMETRES',
  'TACHES',
  'CONTACT',
  'EQUIPE',
] as const

export type Etape = (typeof ETAPES)[number]

export interface PremiersPas {
  etapes: { etape: Etape; faite: boolean }[]
  /** Un admin a masqué la liste pour toute l'activité. */
  masques: boolean
  /** Toutes les étapes sont faites : la liste disparaît d'elle-même. */
  termines: boolean
}

const Reglage = z.object({
  activiteConfirmeeLe: z.string().optional(),
  masqueeLe: z.string().optional(),
})

type Reglage = z.infer<typeof Reglage>

/** Le réglage enregistré ; une valeur illisible vaut un réglage vide. */
function lireReglage(valeur: Prisma.JsonValue | null): Reglage {
  const lu = Reglage.safeParse(valeur ?? {})
  return lu.success ? lu.data : {}
}

/** L'état des premiers pas de l'activité, vu par la personne `moiId`. */
export async function etatPremiersPas(
  activiteId: string,
  moiId: string
): Promise<PremiersPas> {
  const activite = await prisma.activite.findUniqueOrThrow({
    where: { id: activiteId },
    select: { premiersPas: true },
  })
  const reglage = lireReglage(activite.premiersPas)
  const courante = await prisma.edition.findFirst({
    where: { activiteId, statut: { not: 'ARCHIVEE' } },
    orderBy: { annee: 'desc' },
    select: { id: true },
  })
  const autres = { userId: { not: moiId } }
  const [perimetres, taches, rattaches, admins, affectes, configuration] =
    await Promise.all([
      prisma.perimetre.count({ where: { activiteId, archivedAt: null } }),
      courante === null
        ? 0
        : prisma.tache.count({
            // Une tâche abandonnée ne prépare rien : elle ne coche pas l'étape.
            where: { editionId: courante.id, statut: { not: 'ABANDONNEE' } },
          }),
      prisma.rattachementActivite.count({ where: { activiteId, ...autres } }),
      prisma.adminActivite.count({ where: { activiteId, ...autres } }),
      prisma.affectation.count({
        where: { edition: { activiteId }, ...autres },
      }),
      configurationActivite(activiteId),
    ])
  const faites: Record<Etape, boolean> = {
    ACTIVITE: reglage.activiteConfirmeeLe !== undefined,
    PERIODE: courante !== null,
    PERIMETRES: perimetres > 0,
    TACHES: taches > 0,
    // Le contact de l'activité, sinon celui de l'organisation, reçoit les
    // réponses aux mails (ADR 0053).
    CONTACT: configuration.contactRecrutement !== undefined,
    EQUIPE: rattaches + admins + affectes > 0,
  }
  const etapes = ETAPES.map(etape => ({ etape, faite: faites[etape] }))
  return {
    etapes,
    masques: reglage.masqueeLe !== undefined,
    termines: etapes.every(e => e.faite),
  }
}

/** Modifie le réglage des premiers pas de l'activité. */
export async function reglerPremiersPas(
  activiteId: string,
  changement: (reglage: Reglage) => Reglage
): Promise<void> {
  await prisma.$transaction(async tx => {
    // Deux admins qui règlent la liste en même temps ne perdent aucun changement.
    await tx.$queryRaw`SELECT id FROM Activite WHERE id = ${activiteId} FOR UPDATE`
    const activite = await tx.activite.findUniqueOrThrow({
      where: { id: activiteId },
      select: { premiersPas: true },
    })
    await tx.activite.update({
      where: { id: activiteId },
      data: { premiersPas: changement(lireReglage(activite.premiersPas)) },
    })
  })
}
