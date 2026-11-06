import { plural, t } from '@lingui/core/macro'

// Jalons (ADR 0062) : libellés du décompte, sans accès au réseau.

/** L'état des tâches liées d'un jalon, en nombres. */
export interface ResumeJalon {
  total: number
  ouvertes: number
  faites: number
  abandonnees: number
  enRetard: number
  assigneesAMoi: number
}

/**
 * Le décompte d'un jalon en deux temps : combien de tâches liées restent ouvertes,
 * puis les retards, la part de la personne et les abandons. Une tâche liée
 * abandonnée sort du total.
 */
export function libelleJalon(resume: ResumeJalon): {
  titre: string
  details: string[]
} {
  const gardees = resume.total - resume.abandonnees
  const { ouvertes } = resume
  const titre =
    gardees === 0
      ? t`Jalon : aucune tâche liée`
      : ouvertes === 0
        ? t`Jalon : toutes les tâches liées sont faites`
        : t`${plural(ouvertes, {
            one: `Jalon : # tâche ouverte sur ${gardees}`,
            other: `Jalon : # tâches ouvertes sur ${gardees}`,
          })}`
  const details: string[] = []
  if (resume.enRetard > 0) {
    const enRetard = resume.enRetard
    details.push(
      t`${plural(enRetard, { one: '# en retard', other: '# en retard' })}`
    )
  }
  if (resume.assigneesAMoi > 0) {
    const miennes = resume.assigneesAMoi
    details.push(
      t`${plural(miennes, { one: 'dont # vous est assignée', other: 'dont # vous sont assignées' })}`
    )
  }
  if (resume.abandonnees > 0) {
    const abandonnees = resume.abandonnees
    details.push(
      t`${plural(abandonnees, { one: '# abandonnée', other: '# abandonnées' })}`
    )
  }
  return { titre, details }
}
