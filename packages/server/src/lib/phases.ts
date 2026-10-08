import { z } from 'zod'

import { erreurSaisie } from './erreurs.ts'

// Phases d'une activité (ADR 0025).
//
// Ce module ne lit pas la base : le contenu d'organisation et le schéma l'importent.
// Une activité déclare ses phases dans l'ordre. Chaque phase porte une borne, en jours
// depuis le premier jour de la période (J-120, J+30), sauf la dernière, qui reçoit
// tout ce qui suit. Une tâche ne porte aucune phase : elle se range par son échéance,
// dans la première phase dont la borne n'est pas dépassée.

export const PHASES_MAX = 12

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// J-120 : 120 jours avant le premier jour de la période. J+3 : 3 jours après.
export const ECHEANCE_RELATIVE = /^J[-+]\d{1,3}$/

/** Le nombre de jours d'une échéance relative : -120 pour J-120, 3 pour J+3. */
export function joursRelatifs(relative: string): number {
  const jours = Number(relative.slice(2))
  // J-0 et J+0 désignent le même jour.
  return relative[1] === '-' && jours !== 0 ? -jours : jours
}

const PhaseSchema = z.strictObject({
  cle: z
    .string()
    .max(60, 'clé de 60 caractères au plus')
    .regex(SLUG, 'minuscules, chiffres et tirets seulement'),
  libelle: z
    .string()
    .trim()
    .min(1, 'libellé attendu')
    .max(60, 'libellé de 60 caractères au plus'),
  jusquA: z
    .string()
    .regex(ECHEANCE_RELATIVE, 'borne attendue de la forme J-120 ou J+3')
    .optional(),
})

// Un type plutôt qu'une interface : Prisma exige une valeur JSON indexable.
export type Phase = z.infer<typeof PhaseSchema>

export const PhasesSchema = z
  .array(PhaseSchema)
  .min(1, 'une phase au moins')
  .max(PHASES_MAX, `${PHASES_MAX} phases au plus`)
  .superRefine((phases, ctx) => {
    const cles = new Set<string>()
    let precedente: number | null = null
    phases.forEach((phase, rang) => {
      if (cles.has(phase.cle)) {
        ctx.addIssue({
          code: 'custom',
          path: [rang, 'cle'],
          message: `la clé ${phase.cle} est déclarée deux fois`,
        })
      }
      cles.add(phase.cle)
      const derniere = rang === phases.length - 1
      if (derniere) {
        if (phase.jusquA !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [rang, 'jusquA'],
            message:
              'la dernière phase ne porte pas de borne : elle reçoit tout ce qui suit',
          })
        }
        return
      }
      if (phase.jusquA === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [rang, 'jusquA'],
          message: 'borne attendue : seule la dernière phase n’en porte pas',
        })
        return
      }
      const borne = joursRelatifs(phase.jusquA)
      if (precedente !== null && borne <= precedente) {
        ctx.addIssue({
          code: 'custom',
          path: [rang, 'jusquA'],
          message: 'les bornes se suivent dans l’ordre croissant',
        })
      }
      precedente = borne
    })
  })

// Phases d'une activité qui n'en déclare pas : quatre temps génériques, valables pour
// un événement, une saison ou un mandat.
export const PHASES_PAR_DEFAUT: Phase[] = [
  { cle: 'lancement', libelle: 'Lancement', jusquA: 'J-120' },
  { cle: 'preparation', libelle: 'Préparation', jusquA: 'J-30' },
  { cle: 'derniers-reglages', libelle: 'Derniers réglages', jusquA: 'J-1' },
  { cle: 'deroulement-et-bilan', libelle: 'Déroulement et bilan' },
]

/**
 * Les phases déclarées par la colonne JSON, ou `null` quand l'activité n'en déclare
 * pas ou que la valeur est illisible : l'export n'écrit alors aucune phase.
 */
export function lirePhasesDeclarees(brut: unknown): Phase[] | null {
  if (brut === null || brut === undefined) return null
  const lu = PhasesSchema.safeParse(brut)
  return lu.success ? lu.data : null
}

/** Les phases d'une activité : celles qu'elle déclare, sinon les phases par défaut. */
export function lirePhases(brut: unknown): Phase[] {
  return lirePhasesDeclarees(brut) ?? PHASES_PAR_DEFAUT
}

/**
 * Valide les phases saisies dans l'espace organisateur, avec les règles du contenu.
 * Une borne vide vaut une borne absente.
 */
export function phasesValides(
  phases: readonly {
    cle: string
    libelle: string
    jusquA?: string | null
  }[]
): Phase[] {
  const lu = PhasesSchema.safeParse(
    phases.map(phase => {
      const borne = phase.jusquA?.trim() ?? ''
      return {
        cle: phase.cle.trim(),
        libelle: phase.libelle,
        ...(borne === '' ? {} : { jusquA: borne }),
      }
    })
  )
  if (lu.success) return lu.data
  const manquement = lu.error.issues[0]!
  const rang = manquement.path[0]
  throw erreurSaisie(
    typeof rang === 'number'
      ? `La phase ${rang + 1} n’est pas valide : ${manquement.message}.`
      : `Les phases ne sont pas valides : ${manquement.message}.`
  )
}
