import { z } from 'zod'

import { donneesPersonnelles, type AdressesDeRole } from './contenu.ts'

// Formulaire public pour rejoindre l'équipe d'une activité (ADR 0015).
//
// Ce module ne lit pas la base : le contenu d'organisation et le schéma l'importent.
// Le réglage d'une activité porte le texte d'introduction, le libellé d'une question
// complémentaire et les paliers de disponibilité. C'est du contenu : il s'importe et
// s'exporte avec l'activité, et ne contient aucune coordonnée personnelle. L'ouverture
// du formulaire, elle, vit en base seulement.

export const PALIERS_MAX = 8

export const FormulaireSchema = z.strictObject({
  introduction: z.string().trim().min(1).max(600).optional(),
  // Libellé d'une question propre à l'organisation, par exemple « Section ».
  question: z.string().trim().min(1).max(120).optional(),
  paliers: z
    .array(z.string().trim().min(1).max(80))
    .max(PALIERS_MAX)
    .optional(),
})

export type Formulaire = z.infer<typeof FormulaireSchema>

/** Le réglage porté par la colonne JSON. Une valeur illisible vaut aucun réglage. */
export function lireFormulaire(valeur: unknown): Formulaire {
  const r = FormulaireSchema.safeParse(valeur ?? {})
  return r.success ? r.data : {}
}

/** Vrai quand le réglage ne porte rien : il ne s'écrit ni en base ni dans le contenu. */
export function formulaireVide(formulaire: Formulaire): boolean {
  return (
    formulaire.introduction === undefined &&
    formulaire.question === undefined &&
    (formulaire.paliers ?? []).length === 0
  )
}

/** Les textes d'un réglage, pour y chercher une coordonnée personnelle. */
export function textesDuFormulaire(formulaire: Formulaire): string[] {
  return [
    formulaire.introduction,
    formulaire.question,
    ...(formulaire.paliers ?? []),
  ].filter(texte => texte !== undefined)
}

/**
 * La description d'un périmètre telle qu'une page publique peut l'afficher : une
 * description qui contient une coordonnée personnelle n'est pas publiée
 * (invariant 16). Une adresse de rôle de l'organisation reste publiable.
 */
export function descriptionPubliable(
  description: string | null,
  role: AdressesDeRole
): string | null {
  if (description === null) return null
  return donneesPersonnelles(description, role).length === 0
    ? description
    : null
}

// Un lien s'écrit avec un schéma (https://, mailto:), avec « www. », ou comme un nom
// de domaine nu. Les extensions les plus courantes suffisent : la liste complète
// refuserait une phrase où l'espace manque après un point (« tournoi.Merci »).
const EXTENSIONS =
  'app|be|biz|ca|ch|club|co|com|de|dev|es|eu|fr|gg|info|io|it|link|live|ly|me|net|online|org|pro|ru|shop|site|store|tech|top|tv|uk|us|xyz'
const LIENS = [
  /\b[a-z][a-z0-9+.-]*:\/\//i,
  /\bmailto:/i,
  /\bwww\./i,
  new RegExp(`\\b(?:[a-z0-9-]+\\.)+(?:${EXTENSIONS})\\b`, 'i'),
]

/**
 * Vrai quand un texte libre du formulaire contient un lien, que le dépôt refuse. Une
 * adresse mail compte comme un lien : le formulaire a déjà son champ d'adresse. Ce
 * contrôle complète les limites de débit et la revue par un admin ; l'espace
 * organisateur n'affiche jamais ces textes comme des liens.
 */
export function contientUnLien(texte: string): boolean {
  return LIENS.some(lien => lien.test(texte))
}
