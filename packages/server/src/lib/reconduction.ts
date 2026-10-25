import type { PrismaClient, StatutTache } from '@relaytour/database'

import { i18n } from './langue.ts'

// Reconduction d'une période (ADR 0048) : les tâches choisies d'une période passée
// sont recréées dans une autre période de la même activité, avec le même écart en
// jours depuis le premier jour. Une tâche reconduite repart à faire, sans
// assignation, sans commentaire ni journal. Une tâche partagée revient avec ses
// déclinaisons, sauf celles qui avaient été refusées : la reconduction est faite par
// un admin, ses déclinaisons sont donc acceptées d'office (ADR 0026).

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

const JOUR_MS = 24 * 60 * 60 * 1000

export type EtatReconduction = 'A_CREER' | 'DEJA_PRESENTE' | 'ECARTEE'

export interface LigneReconduction {
  tacheId: string
  perimetreId: string
  perimetre: string
  titre: string
  statutSource: StatutTache
  echeance: Date | null
  /** Les déclinaisons recréées avec la tâche partagée. */
  declinaisons: number
  /** Retenue par défaut : toute tâche qui n'a pas été abandonnée. */
  parDefaut: boolean
  /** Choisie pour cette reconduction. */
  retenue: boolean
  etat: EtatReconduction
  raison: string | null
}

export interface RapportReconduction {
  lignes: LigneReconduction[]
  effectifs: { crees: string[]; dejaPresents: string[] }
  /** Les identifiants demandés qui ne désignent aucune tâche de la période source. */
  ignorees: number
}

export interface OptionsReconduction {
  source: { id: string; debut: Date }
  cible: { id: string; debut: Date }
  /** Sans valeur, toutes les tâches de la période source qui n'ont pas été abandonnées. */
  tacheIds: readonly string[] | null
  auteurId: string
  ecrire: boolean
}

/** La date décalée d'un nombre de jours entiers, à minuit UTC. */
export function decaler(date: Date | null, jours: number): Date | null {
  if (date === null) return null
  const resultat = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  resultat.setUTCDate(resultat.getUTCDate() + jours)
  return resultat
}

/** L'écart en jours entre les premiers jours de deux périodes. */
export function ecartEnJours(source: Date, cible: Date): number {
  const jour = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((jour(cible) - jour(source)) / JOUR_MS)
}

/** Calcule la reconduction et, avec `ecrire`, crée les tâches et les effectifs qui manquent. */
export async function reconduire(
  tx: Transaction,
  options: OptionsReconduction
): Promise<RapportReconduction> {
  const { source, cible, auteurId, ecrire } = options
  const jours = ecartEnJours(source.debut, cible.debut)
  const rapport: RapportReconduction = {
    lignes: [],
    effectifs: { crees: [], dejaPresents: [] },
    ignorees: 0,
  }

  const taches = await tx.tache.findMany({
    where: { editionId: source.id, origineId: null },
    orderBy: [{ echeance: 'asc' }, { titre: 'asc' }],
    select: {
      id: true,
      titre: true,
      description: true,
      echeance: true,
      statut: true,
      modeleSlug: true,
      perimetreId: true,
      perimetre: { select: { nom: true, archivedAt: true } },
      fiche: { select: { id: true, archivedAt: true } },
      declinaisons: {
        where: { accord: { not: 'REFUSE' } },
        orderBy: { perimetreId: 'asc' },
        select: {
          titre: true,
          description: true,
          echeance: true,
          modeleSlug: true,
          perimetreId: true,
          perimetre: { select: { archivedAt: true } },
          fiche: { select: { id: true, archivedAt: true } },
        },
      },
    },
  })
  const demandees = options.tacheIds === null ? null : new Set(options.tacheIds)
  if (demandees !== null) {
    const connues = new Set(taches.map(t => t.id))
    rapport.ignorees = [...demandees].filter(id => !connues.has(id)).length
  }

  // Les tâches de la période cible, pour ne jamais créer deux fois la même : par
  // tâche type quand elle en a une, sinon par titre dans son périmètre.
  const presentes = await tx.tache.findMany({
    where: { editionId: cible.id, origineId: null },
    select: { perimetreId: true, modeleSlug: true, titre: true },
  })
  const cle = (
    perimetreId: string,
    modeleSlug: string | null,
    titre: string
  ) =>
    modeleSlug === null
      ? `${perimetreId}#titre#${titre.trim().toLowerCase()}`
      : `${perimetreId}#modele#${modeleSlug}`
  const dejaLa = new Set(
    presentes.map(t => cle(t.perimetreId, t.modeleSlug, t.titre))
  )
  const ficheValide = (
    fiche: { id: string; archivedAt: Date | null } | null
  ) => (fiche === null || fiche.archivedAt !== null ? null : fiche.id)

  for (const tache of taches) {
    const parDefaut = tache.statut !== 'ABANDONNEE'
    const retenue = demandees === null ? parDefaut : demandees.has(tache.id)
    const declinaisons = tache.declinaisons.filter(
      d => d.perimetre.archivedAt === null
    )
    const ligne: LigneReconduction = {
      tacheId: tache.id,
      perimetreId: tache.perimetreId,
      perimetre: tache.perimetre.nom,
      titre: tache.titre,
      statutSource: tache.statut,
      echeance: decaler(tache.echeance, jours),
      declinaisons: declinaisons.length,
      parDefaut,
      retenue,
      etat: 'A_CREER',
      raison: null,
    }
    rapport.lignes.push(ligne)
    if (tache.perimetre.archivedAt !== null) {
      ligne.etat = 'ECARTEE'
      ligne.raison = i18n._('Le périmètre est archivé.')
      continue
    }
    const cleTache = cle(tache.perimetreId, tache.modeleSlug, tache.titre)
    if (dejaLa.has(cleTache)) {
      ligne.etat = 'DEJA_PRESENTE'
      continue
    }
    if (!retenue) continue
    dejaLa.add(cleTache)
    if (!ecrire) continue
    const creee = await tx.tache.create({
      data: {
        editionId: cible.id,
        perimetreId: tache.perimetreId,
        titre: tache.titre,
        description: tache.description,
        echeance: ligne.echeance,
        modeleSlug: tache.modeleSlug,
        ficheId: ficheValide(tache.fiche),
        creeParId: auteurId,
      },
      select: { id: true },
    })
    const maintenant = new Date()
    for (const declinaison of declinaisons) {
      await tx.tache.create({
        data: {
          editionId: cible.id,
          perimetreId: declinaison.perimetreId,
          titre: declinaison.titre,
          description: declinaison.description,
          echeance: decaler(declinaison.echeance, jours),
          modeleSlug: declinaison.modeleSlug,
          ficheId: ficheValide(declinaison.fiche),
          creeParId: auteurId,
          origineId: creee.id,
          accord: 'ACCEPTE',
          accordParId: auteurId,
          accordLe: maintenant,
        },
      })
    }
  }

  // Effectifs souhaités des périmètres actifs, quand la période cible n'en a pas.
  const effectifsCible = new Set(
    (
      await tx.effectifPerimetre.findMany({
        where: { editionId: cible.id },
        select: { perimetreId: true },
      })
    ).map(e => e.perimetreId)
  )
  const effectifsSource = await tx.effectifPerimetre.findMany({
    where: { editionId: source.id, perimetre: { archivedAt: null } },
    select: {
      perimetreId: true,
      effectif: true,
      perimetre: { select: { slug: true } },
    },
    orderBy: { perimetre: { ordre: 'asc' } },
  })
  for (const effectif of effectifsSource) {
    if (effectifsCible.has(effectif.perimetreId)) {
      rapport.effectifs.dejaPresents.push(effectif.perimetre.slug)
      continue
    }
    rapport.effectifs.crees.push(
      `${effectif.perimetre.slug} (${effectif.effectif})`
    )
    if (!ecrire) continue
    await tx.effectifPerimetre.create({
      data: {
        perimetreId: effectif.perimetreId,
        editionId: cible.id,
        effectif: effectif.effectif,
      },
    })
  }
  return rapport
}
