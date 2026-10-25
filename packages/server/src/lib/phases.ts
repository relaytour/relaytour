import { z } from 'zod'

import { erreurSaisie } from './erreurs.ts'
import { i18n } from './langue.ts'

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
    .max(60, { error: () => i18n._('clé de 60 caractères au plus') })
    .regex(SLUG, {
      error: () => i18n._('minuscules, chiffres et tirets seulement'),
    }),
  libelle: z
    .string()
    .trim()
    .min(1, { error: () => i18n._('libellé attendu') })
    .max(60, { error: () => i18n._('libellé de 60 caractères au plus') }),
  jusquA: z
    .string()
    .regex(ECHEANCE_RELATIVE, {
      error: () => i18n._('borne attendue de la forme J-120 ou J+3'),
    })
    .optional(),
})

// Un type plutôt qu'une interface : Prisma exige une valeur JSON indexable.
export type Phase = z.infer<typeof PhaseSchema>

export const PhasesSchema = z
  .array(PhaseSchema)
  .min(1, { error: () => i18n._('une phase au moins') })
  .max(PHASES_MAX, {
    error: () => i18n._('{max} phases au plus', { max: PHASES_MAX }),
  })
  .superRefine((phases, ctx) => {
    const cles = new Set<string>()
    let precedente: number | null = null
    phases.forEach((phase, rang) => {
      if (cles.has(phase.cle)) {
        ctx.addIssue({
          code: 'custom',
          path: [rang, 'cle'],
          message: i18n._('la clé {cle} est déclarée deux fois', {
            cle: phase.cle,
          }),
        })
      }
      cles.add(phase.cle)
      const derniere = rang === phases.length - 1
      if (derniere) {
        if (phase.jusquA !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [rang, 'jusquA'],
            message: i18n._(
              'la dernière phase ne porte pas de borne : elle reçoit tout ce qui suit'
            ),
          })
        }
        return
      }
      if (phase.jusquA === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [rang, 'jusquA'],
          message: i18n._(
            'borne attendue : seule la dernière phase n’en porte pas'
          ),
        })
        return
      }
      const borne = joursRelatifs(phase.jusquA)
      if (precedente !== null && borne <= precedente) {
        ctx.addIssue({
          code: 'custom',
          path: [rang, 'jusquA'],
          message: i18n._('les bornes se suivent dans l’ordre croissant'),
        })
      }
      precedente = borne
    })
  })

// Phases d'une activité qui n'en déclare pas : quatre temps génériques, valables pour
// un événement, une saison ou un mandat.
//
// Les libellés se traduisent à la lecture : l'activité qui les reçoit à sa création
// les écrit dans la langue de la requête, puis ils sont des données (ADR 0047).
export const PHASES_PAR_DEFAUT: Phase[] = [
  {
    cle: 'lancement',
    get libelle() {
      return i18n._(
        'Lancement',
        {},
        { comment: 'Phase par défaut d’une activité' }
      )
    },
    jusquA: 'J-120',
  },
  {
    cle: 'preparation',
    get libelle() {
      return i18n._(
        'Préparation',
        {},
        { comment: 'Phase par défaut d’une activité' }
      )
    },
    jusquA: 'J-30',
  },
  {
    cle: 'derniers-reglages',
    get libelle() {
      return i18n._(
        'Derniers réglages',
        {},
        { comment: 'Phase par défaut d’une activité' }
      )
    },
    jusquA: 'J-1',
  },
  {
    cle: 'deroulement-et-bilan',
    get libelle() {
      return i18n._(
        'Déroulement et bilan',
        {},
        { comment: 'Dernière phase par défaut d’une activité' }
      )
    },
  },
]

/** Les phases par défaut, libellés écrits dans la langue courante : des données prêtes à stocker. */
export function phasesParDefaut(): Phase[] {
  return PHASES_PAR_DEFAUT.map(phase => ({ ...phase }))
}

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
      ? i18n._('La phase {numero} n’est pas valide : {motif}.', {
          numero: rang + 1,
          motif: manquement.message,
        })
      : i18n._('Les phases ne sont pas valides : {motif}.', {
          motif: manquement.message,
        })
  )
}
