import { createHash, randomBytes } from 'node:crypto'

import { prisma, type AbonnementAgenda } from '@relaytour/database'

import { buildContext, type AppContext } from '../context.ts'

import { bornesDesPhases, decalerJour, jourISO } from './agenda.ts'
import { aujourdhui, perimetresLisibles } from './droits.ts'
import { calendrier, type EvenementIcs } from './ics.ts'
import { configurationOrganisation } from './organisation.ts'
import { lirePhases } from './phases.ts'

// Abonnements à l'agenda (ADR 0037).
//
// Une adresse secrète sert un agenda au format iCalendar, en lecture seule. Le
// jeton n'est jamais gardé : le serveur garde son empreinte SHA-256 et recalcule
// les droits de la personne à chaque lecture.

/** Le nom de fichier d'une adresse : 32 octets aléatoires en base64url, puis .ics. */
export const FICHIER_ABONNEMENT = /^([A-Za-z0-9_-]{43})\.ics$/

/** Fenêtre servie : 90 jours en arrière, 540 jours en avant. */
export const JOURS_AVANT = 90
export const JOURS_APRES = 540
/** Un abonnement sert 2 000 événements au plus. */
export const EVENEMENTS_MAX = 2000

export function nouveauJeton(): string {
  return randomBytes(32).toString('base64url')
}

export function empreinteJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex')
}

/** L'adresse d'un abonnement, affichée une seule fois, à sa création. */
export function adresseAbonnement(origine: string, jeton: string): string {
  return `${origine.replace(/\/$/, '')}/agenda/${jeton}.ics`
}

interface Fenetre {
  depuis: string
  jusqua: string
  depuisInstant: Date
  jusquaInstant: Date
}

function fenetre(maintenant: Date, fuseau: string): Fenetre {
  const jour = aujourdhui(maintenant, fuseau)
  const depuis = decalerJour(jour, -JOURS_AVANT)
  const jusqua = decalerJour(jour, JOURS_APRES)
  return {
    depuis,
    jusqua,
    depuisInstant: new Date(`${depuis}T00:00:00.000Z`),
    jusquaInstant: new Date(`${jusqua}T23:59:59.999Z`),
  }
}

const dansLaFenetre = (f: Fenetre, du: string, au: string | null) =>
  du <= f.jusqua && (au ?? du) >= f.depuis

/** Les repères d'une période : phases, premier et dernier jour, dates clés. */
async function reperesDesPeriodes(
  activiteIds: string[],
  f: Fenetre,
  hote: string,
  fuseau: string
): Promise<EvenementIcs[]> {
  if (activiteIds.length === 0) return []
  const editions = await prisma.edition.findMany({
    where: { activiteId: { in: activiteIds }, statut: { not: 'ARCHIVEE' } },
    include: {
      activite: { select: { nom: true, phases: true } },
      datesCles: true,
    },
  })
  const evenements: EvenementIcs[] = []
  for (const edition of editions) {
    const debut = jourISO(edition.debut)
    const fin = jourISO(edition.fin)
    for (const phase of bornesDesPhases(lirePhases(edition.activite.phases), {
      debut,
      fin,
      ouverture: aujourdhui(edition.createdAt, fuseau),
    })) {
      if (!dansLaFenetre(f, phase.du, phase.au)) continue
      evenements.push({
        uid: `phase-${edition.id}-${phase.cle}@${hote}`,
        titre: `${edition.activite.nom} · phase ${phase.libelle}`,
        horaire: { jour: phase.du, jourFin: phase.au },
      })
    }
    if (dansLaFenetre(f, debut, fin)) {
      evenements.push({
        uid: `periode-${edition.id}@${hote}`,
        titre: edition.nom,
        horaire: { jour: debut, jourFin: fin },
        modifieLe: edition.updatedAt,
      })
    }
    for (const d of edition.datesCles) {
      const du = jourISO(d.jour)
      const au = d.jourFin === null ? null : jourISO(d.jourFin)
      if (!dansLaFenetre(f, du, au)) continue
      evenements.push({
        uid: `date-cle-${d.id}@${hote}`,
        titre: d.titre,
        horaire: { jour: du, jourFin: au },
        description: d.description,
        modifieLe: d.updatedAt,
      })
    }
  }
  return evenements
}

const SELECTION_REUNION = {
  id: true,
  titre: true,
  debut: true,
  fin: true,
  lieu: true,
  lienVisio: true,
  description: true,
  statut: true,
  sequence: true,
  updatedAt: true,
  activite: { select: { slug: true } },
  editionId: true,
} as const

function evenementDeReunion(
  r: {
    id: string
    titre: string
    debut: Date
    fin: Date
    lieu: string | null
    lienVisio: string | null
    description: string | null
    statut: string
    sequence: number
    updatedAt: Date
    activite: { slug: string }
    editionId: string
  },
  origine: string,
  hote: string,
  slugOrganisation: string
): EvenementIcs {
  const lien = `${origine}/${r.activite.slug}/agenda?edition=${r.editionId}&reunion=${r.id}&organisation=${encodeURIComponent(slugOrganisation)}`
  return {
    uid: `reunion-${r.id}@${hote}`,
    titre: r.titre,
    horaire: { debut: r.debut, fin: r.fin },
    lieu: r.lieu,
    description: [
      r.description,
      r.lienVisio ? `Visio : ${r.lienVisio}` : null,
      `Dans l’espace organisateur : ${lien}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    url: lien,
    sequence: r.sequence,
    annule: r.statut === 'ANNULEE',
    modifieLe: r.updatedAt,
  }
}

/**
 * L'agenda d'une personne, avec ses droits du moment : l'agenda global des
 * activités qu'elle voit, les réunions des périmètres choisis qu'elle lit, ses
 * convocations et, en option, les échéances de ses tâches.
 */
export async function evenementsPersonnels(
  ctx: AppContext,
  abonnement: Pick<
    AbonnementAgenda,
    'perimetreIds' | 'inclureGlobal' | 'inclureEcheances'
  >,
  maintenant: Date
): Promise<EvenementIcs[]> {
  const organisation = ctx.organisation!
  const moi = ctx.personne!.id
  const configuration = await configurationOrganisation(organisation.id)
  const origine = configuration.origineOrga.replace(/\/$/, '')
  const hote = new URL(origine).hostname
  const f = fenetre(maintenant, organisation.fuseauHoraire)
  const activites = [...(await ctx.activitesVisibles())]
  const lisibles = new Set(await perimetresLisibles(ctx))
  const choisis = Array.isArray(abonnement.perimetreIds)
    ? (abonnement.perimetreIds as unknown[])
        .map(String)
        .filter(id => lisibles.has(id))
    : [...lisibles]
  const periodeOuverte = { statut: { not: 'ARCHIVEE' as const } }
  const fenetreReunion = {
    debut: { lte: f.jusquaInstant },
    fin: { gte: f.depuisInstant },
  }
  const [reperes, reunions, taches] = await Promise.all([
    abonnement.inclureGlobal
      ? reperesDesPeriodes(activites, f, hote, organisation.fuseauHoraire)
      : [],
    prisma.reunion.findMany({
      where: {
        organisationId: organisation.id,
        activiteId: { in: activites },
        edition: periodeOuverte,
        ...fenetreReunion,
        OR: [
          ...(abonnement.inclureGlobal ? [{ perimetreId: null }] : []),
          { perimetreId: { in: choisis } },
          { convocations: { some: { userId: moi } } },
        ],
      },
      select: SELECTION_REUNION,
      orderBy: { debut: 'asc' },
      take: EVENEMENTS_MAX,
    }),
    abonnement.inclureEcheances
      ? prisma.tache.findMany({
          where: {
            assignations: { some: { userId: moi } },
            perimetre: {
              organisationId: organisation.id,
              activiteId: { in: activites },
            },
            edition: periodeOuverte,
            statut: { notIn: ['FAITE', 'ABANDONNEE'] },
            echeance: {
              gte: new Date(`${f.depuis}T00:00:00.000Z`),
              lte: new Date(`${f.jusqua}T00:00:00.000Z`),
            },
          },
          select: {
            id: true,
            titre: true,
            echeance: true,
            updatedAt: true,
            perimetre: { select: { nom: true } },
          },
          take: EVENEMENTS_MAX,
        })
      : [],
  ])
  return [
    ...reperes,
    ...reunions.map(r =>
      evenementDeReunion(r, origine, hote, configuration.slug)
    ),
    ...taches.map(t => ({
      uid: `tache-${t.id}@${hote}`,
      titre: `Échéance · ${t.titre} (${t.perimetre.nom})`,
      horaire: { jour: jourISO(t.echeance!) },
      modifieLe: t.updatedAt,
    })),
  ].slice(0, EVENEMENTS_MAX)
}

/** L'agenda global d'une activité : repères des périodes et réunions globales. */
export async function evenementsActivite(
  activite: { id: string; organisationId: string },
  fuseau: string,
  maintenant: Date
): Promise<EvenementIcs[]> {
  const configuration = await configurationOrganisation(activite.organisationId)
  const origine = configuration.origineOrga.replace(/\/$/, '')
  const hote = new URL(origine).hostname
  const f = fenetre(maintenant, fuseau)
  const [reperes, reunions] = await Promise.all([
    reperesDesPeriodes([activite.id], f, hote, fuseau),
    prisma.reunion.findMany({
      where: {
        organisationId: activite.organisationId,
        activiteId: activite.id,
        perimetreId: null,
        edition: { statut: { not: 'ARCHIVEE' } },
        debut: { lte: f.jusquaInstant },
        fin: { gte: f.depuisInstant },
      },
      select: SELECTION_REUNION,
      orderBy: { debut: 'asc' },
      take: EVENEMENTS_MAX,
    }),
  ])
  return [
    ...reperes,
    ...reunions.map(r =>
      evenementDeReunion(r, origine, hote, configuration.slug)
    ),
  ].slice(0, EVENEMENTS_MAX)
}

export type LectureAbonnement =
  { statut: 404 | 429 | 503 } | { statut: 200; contenu: string; etag: string }

/**
 * Le calendrier d'une adresse d'abonnement, ou 404 dans tous les cas de refus :
 * nom mal formé, jeton inconnu ou révoqué, personne archivée, activité archivée,
 * organisation suspendue ou archivée. Le journal ne reçoit jamais le jeton.
 */
export async function lireAbonnement(
  fichier: string,
  ip: string | undefined,
  maintenant = new Date(),
  limiter: (cle: string, max: number, fenetre: number) => Promise<boolean>
): Promise<LectureAbonnement> {
  const m = FICHIER_ABONNEMENT.exec(fichier)
  const empreinte = m === null ? null : empreinteJeton(m[1]!)
  const abonnement =
    empreinte === null
      ? null
      : await prisma.abonnementAgenda.findFirst({
          where: { empreinte, revoqueLe: null },
          include: {
            organisation: {
              select: { slug: true, statut: true, fuseauHoraire: true },
            },
            activite: {
              select: {
                id: true,
                organisationId: true,
                nom: true,
                archivedAt: true,
              },
            },
          },
        })
  if (abonnement === null) {
    // Les jetons refusés se comptent par adresse IP : une recherche à l'aveugle
    // s'arrête vite.
    if (!(await limiter(`agenda-refus:${ip ?? 'inconnue'}`, 30, 15 * 60))) {
      return { statut: 429 }
    }
    return { statut: 404 }
  }
  // Un agenda se relit depuis les adresses partagées de Google ou d'Outlook :
  // la limite se compte par abonnement.
  if (!(await limiter(`agenda:${abonnement.id}`, 120, 60 * 60))) {
    return { statut: 429 }
  }
  if (!['ACTIVE', 'LECTURE_SEULE'].includes(abonnement.organisation.statut)) {
    return { statut: 404 }
  }
  const configuration = await configurationOrganisation(
    abonnement.organisationId
  )
  let evenements: EvenementIcs[]
  let nom: string
  if (abonnement.sorte === 'ACTIVITE') {
    const activite = abonnement.activite
    if (activite === null || activite.archivedAt !== null) {
      return { statut: 404 }
    }
    evenements = await evenementsActivite(
      activite,
      abonnement.organisation.fuseauHoraire,
      maintenant
    )
    nom = `${configuration.nomCourt} · ${activite.nom}`
  } else {
    if (abonnement.userId === null) return { statut: 404 }
    // Les droits se relisent comme pour une requête : une personne archivée, ou
    // retirée d'un périmètre, perd aussitôt le contenu correspondant.
    const ctx = await buildContext(
      ip,
      abonnement.userId,
      abonnement.organisation.slug
    )
    if (
      ctx.personne === null ||
      ctx.organisation?.id !== abonnement.organisationId
    ) {
      return { statut: 404 }
    }
    evenements = await evenementsPersonnels(ctx, abonnement, maintenant)
    nom = `${configuration.nomCourt} · Mon agenda`
  }
  if (
    abonnement.dernierAccesLe === null ||
    maintenant.getTime() - abonnement.dernierAccesLe.getTime() > 60 * 60 * 1000
  ) {
    await prisma.abonnementAgenda.update({
      where: { id: abonnement.id },
      data: { dernierAccesLe: maintenant },
    })
  }
  const contenu = calendrier({
    evenements,
    nom,
    fuseau: abonnement.organisation.fuseauHoraire,
    maintenant,
  })
  // L'empreinte ignore la ligne DTSTAMP, qui change à chaque lecture.
  const etag = `"${createHash('sha256')
    .update(contenu.replace(/^DTSTAMP:.*$/gm, ''))
    .digest('base64url')
    .slice(0, 27)}"`
  return { statut: 200, contenu, etag }
}
