import type { PrismaClient } from '@relaytour/database'

import { i18n } from '../lib/langue.ts'
import { LIENS_JALON_MAX } from '../lib/saisie.ts'

import {
  ciblesDeLaDeclinaison,
  dateEcheance,
  textesDeLaDeclinaison,
  type TacheModele,
} from './modeles.ts'

// Effectifs et tâches d'une période créés depuis les tâches types (ADR 0003, ADR
// 0048). `orga:importer --edition` et l'espace organisateur partagent ce code : une
// tâche type crée sa tâche une seule fois, et une tâche déjà créée ne change plus.

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface PerimetreDeLaPeriode {
  slug: string
  groupe: string
  /** Absent en simulation pour un périmètre que l'import créerait. */
  id: string | undefined
  archive: boolean
  /** Effectif souhaité par défaut ; null ou absent : aucun effectif à créer. */
  effectif?: number | null
}

export interface RapportTachesDeLaPeriode {
  effectifs: { crees: string[]; dejaPresents: string[] }
  /**
   * `rattachees` : des tâches déjà présentes dans un périmètre cible, liées à leur
   * tâche partagée sans autre changement. `conflits` : des déclinaisons que l'import
   * ne crée ni ne lie, et des liens de jalon qu'il ne crée pas, avec la raison
   * (ADR 0026, 0062). `jalons` : des tâches qui reçoivent le marqueur de jalon.
   * `liens` : des liens de jalon créés, « jalon → tâche liée ».
   */
  taches: {
    creees: string[]
    dejaPresentes: string[]
    rattachees: string[]
    conflits: string[]
    jalons: string[]
    liens: string[]
  }
}

export interface OptionsTachesDeLaPeriode {
  periode: { id: string; debut: Date }
  activiteId: string
  /** Tous les périmètres de l'activité, dans leur ordre : les cibles s'y cherchent. */
  perimetres: readonly PerimetreDeLaPeriode[]
  /** Les tâches types de chaque périmètre d'origine, par slug. */
  taches: ReadonlyMap<string, readonly TacheModele[]>
  /** L'identifiant d'une fiche citée par son slug, ou null. */
  ficheDe: (slug: string | undefined) => string | null
  /**
   * Les périmètres d'origine retenus : seuls leurs effectifs et leurs tâches types
   * sont créés. Une tâche partagée d'un périmètre retenu se décline dans tous ses
   * périmètres cibles, retenus ou non. Sans valeur, tous les périmètres.
   */
  origines?: ReadonlySet<string>
  ecrire: boolean
}

export function rapportTachesVide(): RapportTachesDeLaPeriode {
  return {
    effectifs: { crees: [], dejaPresents: [] },
    taches: {
      creees: [],
      dejaPresentes: [],
      rattachees: [],
      conflits: [],
      jalons: [],
      liens: [],
    },
  }
}

/**
 * La fiche d'une tâche ou d'une déclinaison, jugée en base : une fiche commune de
 * l'activité, ou une fiche du périmètre d'origine. Une fiche en conflit garde le
 * périmètre qu'elle avait, même quand le dossier la range ailleurs. Une tâche ne
 * reçoit donc jamais une fiche que les personnes de son périmètre ne lisent pas.
 */
async function ficheEnBase(
  tx: Transaction,
  ficheId: string | null,
  activiteId: string,
  perimetreOrigineId: string | undefined
): Promise<string | null> {
  if (ficheId === null) return null
  const fiche = await tx.fiche.findUnique({
    where: { id: ficheId },
    select: { perimetreId: true, activiteId: true },
  })
  return fiche !== null &&
    fiche.activiteId === activiteId &&
    (fiche.perimetreId === null || fiche.perimetreId === perimetreOrigineId)
    ? ficheId
    : null
}

/** Crée les effectifs et les tâches de la période qui manquent, et complète le rapport. */
export async function creerTachesDeLaPeriode(
  tx: Transaction,
  options: OptionsTachesDeLaPeriode,
  rapport: RapportTachesDeLaPeriode
): Promise<void> {
  const { periode, activiteId, perimetres, ficheDe, origines, ecrire } = options
  const retenu = (slug: string) => origines === undefined || origines.has(slug)
  const parSlug = new Map(perimetres.map(p => [p.slug, p]))

  // Deux applications simultanées à la même période ne créent pas deux fois les
  // mêmes tâches : la seconde attend la fin de la première, puis les trouve. Une
  // simulation ne verrouille rien.
  if (ecrire) {
    await tx.$queryRaw`SELECT id FROM Edition WHERE id = ${periode.id} FOR UPDATE`
  }

  // Effectifs de la période
  const effectifsExistants = new Set(
    (
      await tx.effectifPerimetre.findMany({
        where: { editionId: periode.id },
        select: { perimetreId: true },
      })
    ).map(e => e.perimetreId)
  )
  for (const perimetre of perimetres) {
    if (perimetre.effectif == null || !retenu(perimetre.slug)) continue
    if (perimetre.id !== undefined && effectifsExistants.has(perimetre.id)) {
      rapport.effectifs.dejaPresents.push(perimetre.slug)
      continue
    }
    rapport.effectifs.crees.push(`${perimetre.slug} (${perimetre.effectif})`)
    if (!ecrire || perimetre.id === undefined) continue
    await tx.effectifPerimetre.create({
      data: {
        perimetreId: perimetre.id,
        editionId: periode.id,
        effectif: perimetre.effectif,
      },
    })
  }

  // Les tâches que la période portera, « perimetre/modele » : celles qui existent
  // et celles que l'import crée. Les jalons ne lient que ces tâches.
  const prevues = new Set<string>()

  // Tâches types. Une tâche se retrouve par sa période, son périmètre et son
  // modèle : déjà présente, elle n'est jamais modifiée.
  for (const [slugPerimetre, taches] of options.taches) {
    if (!retenu(slugPerimetre)) continue
    const perimetreId = parSlug.get(slugPerimetre)?.id
    for (const tache of taches) {
      const cle = `${slugPerimetre}/${tache.modele}`
      const existante =
        perimetreId === undefined
          ? null
          : await tx.tache.findFirst({
              where: {
                editionId: periode.id,
                perimetreId,
                modeleSlug: tache.modele,
              },
              select: { id: true, origineId: true },
            })
      // L'identifiant de la tâche, pour y lier ses déclinaisons. Une simulation
      // qui la crée ne le connaît pas.
      let tacheId = existante?.id ?? null
      prevues.add(cle)
      if (existante !== null) {
        rapport.taches.dejaPresentes.push(cle)
      } else {
        rapport.taches.creees.push(cle)
        if (ecrire && perimetreId !== undefined) {
          const creee = await tx.tache.create({
            data: {
              editionId: periode.id,
              perimetreId,
              modeleSlug: tache.modele,
              titre: tache.titre,
              description: tache.description?.trim() || null,
              echeance: dateEcheance(tache.echeance, periode.debut),
              ficheId: await ficheEnBase(
                tx,
                ficheDe(tache.fiche),
                activiteId,
                perimetreId
              ),
            },
            select: { id: true },
          })
          tacheId = creee.id
        }
      }

      // Tâche partagée (ADR 0026) : une déclinaison par périmètre cible, acceptée
      // d'office puisque le contenu la déclare. Une déclinaison cite la fiche
      // qu'elle déclare, sinon celle de sa tâche partagée (ADR 0039).
      if (tache.declinaison === undefined) continue
      const textes = textesDeLaDeclinaison(tache)
      const ficheId = await ficheEnBase(
        tx,
        ficheDe(tache.declinaison.fiche ?? tache.fiche),
        activiteId,
        perimetreId
      )
      for (const cible of ciblesDeLaDeclinaison(
        tache,
        slugPerimetre,
        perimetres
      )) {
        const cleCible = i18n._('{cible} (déclinaison de {cle})', {
          cible: `${cible}/${tache.modele}`,
          cle,
        })
        const conflit = (raison: string) => {
          prevues.delete(`${cible}/${tache.modele}`)
          rapport.taches.conflits.push(`${cleCible} : ${raison}`)
        }
        prevues.add(`${cible}/${tache.modele}`)
        // Le lien garde un seul niveau : une tâche qui est déjà la déclinaison
        // d'une autre ne se décline pas. Le contenu a pu changer de sens depuis
        // un import précédent.
        if (existante !== null && existante.origineId !== null) {
          conflit(
            i18n._("{cle} est déjà la déclinaison d'une autre tâche", { cle })
          )
          continue
        }
        if (parSlug.get(cible)?.archive === true) {
          conflit(i18n._('le périmètre est archivé'))
          continue
        }
        const cibleId = parSlug.get(cible)?.id
        const declinaison =
          cibleId === undefined
            ? null
            : await tx.tache.findFirst({
                where: {
                  editionId: periode.id,
                  perimetreId: cibleId,
                  modeleSlug: tache.modele,
                },
                select: {
                  id: true,
                  origineId: true,
                  _count: { select: { declinaisons: true } },
                },
              })
        if (declinaison === null) {
          rapport.taches.creees.push(cleCible)
          if (!ecrire || cibleId === undefined || tacheId === null) continue
          await tx.tache.create({
            data: {
              editionId: periode.id,
              perimetreId: cibleId,
              modeleSlug: tache.modele,
              titre: textes.titre,
              description: textes.description?.trim() || null,
              echeance: dateEcheance(textes.echeance, periode.debut),
              ficheId,
              origineId: tacheId,
              accord: 'ACCEPTE',
              accordLe: new Date(),
            },
          })
          continue
        }
        if (declinaison.origineId !== null) {
          // Déjà liée : à cette tâche partagée, ou à une autre que le contenu ne
          // déclare plus. L'import ne déplace pas un lien.
          if (declinaison.origineId === tacheId) {
            rapport.taches.dejaPresentes.push(cleCible)
          } else {
            conflit(
              i18n._(
                'la tâche du périmètre est déjà liée à une autre tâche partagée'
              )
            )
          }
          continue
        }
        if (declinaison._count.declinaisons > 0) {
          conflit(
            i18n._('la tâche du périmètre porte déjà ses propres déclinaisons')
          )
          continue
        }
        // Une tâche importée avant que le contenu ne la partage : elle se lie à sa
        // tâche partagée. Son titre, son échéance, son statut et ses personnes
        // assignées ne changent pas.
        rapport.taches.rattachees.push(cleCible)
        if (!ecrire || tacheId === null) continue
        await tx.tache.update({
          where: { id: declinaison.id },
          data: { origineId: tacheId, accord: 'ACCEPTE', accordLe: new Date() },
        })
      }
    }
  }

  await creerJalonsDeLaPeriode(tx, options, prevues, rapport)
}

/**
 * Jalons (ADR 0062) : marque les tâches que le contenu déclare comme jalons, puis
 * crée les liens manquants. L'import ne retire jamais un marqueur ni un lien, comme
 * il ne déplace jamais une déclinaison. Une tâche liée se retrouve, comme toute
 * tâche, par sa période, son périmètre et son modèle.
 */
async function creerJalonsDeLaPeriode(
  tx: Transaction,
  options: OptionsTachesDeLaPeriode,
  prevues: ReadonlySet<string>,
  rapport: RapportTachesDeLaPeriode
): Promise<void> {
  const { periode, perimetres, origines, ecrire } = options
  const retenu = (slug: string) => origines === undefined || origines.has(slug)
  const parSlug = new Map(perimetres.map(p => [p.slug, p]))
  const parId = new Map(
    perimetres.flatMap(p => (p.id === undefined ? [] : [[p.id, p.slug]]))
  )
  // Les jalons voulus : une tâche type marquée, et chaque déclinaison d'une tâche
  // type dont la déclinaison est marquée.
  const voulus: { cle: string; origine: string | null; lies: string[] }[] = []
  for (const [slugPerimetre, taches] of options.taches) {
    if (!retenu(slugPerimetre)) continue
    for (const tache of taches) {
      const cle = `${slugPerimetre}/${tache.modele}`
      if (tache.jalon !== undefined) {
        voulus.push({ cle, origine: null, lies: tache.jalon })
      }
      if (tache.declinaison?.jalon !== true) continue
      for (const cible of ciblesDeLaDeclinaison(
        tache,
        slugPerimetre,
        perimetres
      )) {
        voulus.push({ cle: `${cible}/${tache.modele}`, origine: cle, lies: [] })
      }
    }
  }
  if (voulus.length === 0) return

  // Les tâches de la période qui portent un modèle, lues après leur création.
  const lues = await tx.tache.findMany({
    where: { editionId: periode.id, modeleSlug: { not: null } },
    select: {
      id: true,
      perimetreId: true,
      modeleSlug: true,
      origineId: true,
      accord: true,
      jalonLe: true,
      liensJalon: { select: { tacheId: true } },
    },
  })
  const enBase = new Map<string, (typeof lues)[number]>()
  for (const tache of lues) {
    const slug = parId.get(tache.perimetreId)
    if (slug !== undefined) enBase.set(`${slug}/${tache.modeleSlug}`, tache)
  }

  for (const voulu of voulus) {
    if (!prevues.has(voulu.cle)) continue
    const jalon = enBase.get(voulu.cle)
    // Une déclinaison ne devient un jalon que si elle déclinait bien sa tâche
    // partagée : un conflit de l'import l'a laissée à part.
    if (
      jalon !== undefined &&
      voulu.origine !== null &&
      jalon.origineId !== enBase.get(voulu.origine)?.id
    ) {
      continue
    }
    if (jalon === undefined || jalon.jalonLe === null) {
      rapport.taches.jalons.push(voulu.cle)
      if (ecrire && jalon !== undefined) {
        await tx.tache.update({
          where: { id: jalon.id },
          data: { jalonLe: new Date() },
        })
      }
    }
    const presents = new Set(jalon?.liensJalon.map(l => l.tacheId) ?? [])
    for (const lie of voulu.lies) {
      const libelle = `${voulu.cle} → ${lie}`
      const conflit = (raison: string) =>
        rapport.taches.conflits.push(`${libelle} : ${raison}`)
      if (!prevues.has(lie) && !enBase.has(lie)) {
        conflit(i18n._('la tâche liée est absente de la période'))
        continue
      }
      if (parSlug.get(lie.split('/')[0]!)?.archive === true) {
        conflit(i18n._('le périmètre est archivé'))
        continue
      }
      const tache = enBase.get(lie)
      if (tache !== undefined && presents.has(tache.id)) continue
      if (presents.size >= LIENS_JALON_MAX) {
        conflit(
          i18n._('le jalon lie déjà {max} tâches', { max: LIENS_JALON_MAX })
        )
        continue
      }
      if (
        tache !== undefined &&
        tache.accord !== null &&
        tache.accord !== 'ACCEPTE'
      ) {
        conflit(i18n._('la tâche liée attend l’accord de son périmètre'))
        continue
      }
      rapport.taches.liens.push(libelle)
      if (tache !== undefined) presents.add(tache.id)
      if (!ecrire || jalon === undefined || tache === undefined) continue
      await tx.lienJalon.createMany({
        data: [{ jalonId: jalon.id, tacheId: tache.id }],
        skipDuplicates: true,
      })
    }
  }
}
