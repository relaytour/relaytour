import type { TypePerimetre } from '@relaytour/database'

// Postes à pourvoir : places de référent·e encore libres pour une édition.
//
// Ce fichier ne lit ni la base ni l'environnement. Le schéma lui passe les effectifs
// et les affectations déjà chargés, et les tests unitaires l'appellent directement.

export interface OrganisationAppel {
  nom: string
  contact?: string | undefined
  pageEquipe?: string | undefined
}
export const EFFECTIF_MAX = 50

export type EtatPostes = 'SANS_PERSONNE' | 'INCOMPLET' | 'COMPLET'

const RANG_ETAT: Record<EtatPostes, number> = {
  SANS_PERSONNE: 0,
  INCOMPLET: 1,
  COMPLET: 2,
}

/**
 * État des postes d'un périmètre pour une édition.
 *
 * Sans effectif défini, un périmètre attend au moins une personne (cible = effectif ?? 1).
 * Un effectif de 0 signifie qu'aucune personne n'est recherchée : le périmètre est complet.
 */
export function etatPostes(
  effectif: number | null,
  affectes: number
): { aPourvoir: number; etat: EtatPostes } {
  const aPourvoir = Math.max(0, (effectif ?? 1) - affectes)
  if (aPourvoir === 0) return { aPourvoir, etat: 'COMPLET' }
  return { aPourvoir, etat: affectes === 0 ? 'SANS_PERSONNE' : 'INCOMPLET' }
}

/**
 * Ordre d'affichage : les périmètres sans personne, puis incomplets, puis complets ;
 * ensuite le plus grand nombre de postes à pourvoir ; enfin les sports avant les pôles,
 * l'ordre du périmètre et son nom. La liste d'origine n'est pas modifiée.
 */
export function trierPostes<
  T extends {
    etat: EtatPostes
    aPourvoir: number
    perimetre: { type: string; ordre: number; nom: string }
  },
>(liste: T[]): T[] {
  const rangType = (type: string) => (type === 'SPORT' ? 0 : 1)
  return [...liste].sort(
    (a, b) =>
      RANG_ETAT[a.etat] - RANG_ETAT[b.etat] ||
      b.aPourvoir - a.aPourvoir ||
      rangType(a.perimetre.type) - rangType(b.perimetre.type) ||
      a.perimetre.ordre - b.perimetre.ordre ||
      a.perimetre.nom.localeCompare(b.perimetre.nom, 'fr')
  )
}

/**
 * Message d'appel à diffuser, sans aucun chiffre en dehors de l'année.
 * Renvoie null quand aucun périmètre n'est à pourvoir. Un groupe vide est omis.
 */
export function texteAppel(
  annee: number,
  perimetres: { nom: string; type: TypePerimetre }[],
  organisation: OrganisationAppel
): string | null {
  if (perimetres.length === 0) return null
  const groupes = [
    { titre: 'Sports', type: 'SPORT' },
    { titre: 'Pôles', type: 'POLE' },
  ]
    .map(({ titre, type }) => ({
      titre,
      noms: perimetres.filter(p => p.type === type).map(p => p.nom),
    }))
    .filter(g => g.noms.length > 0)
    .map(g => [g.titre, ...g.noms.map(nom => `- ${nom}`)].join('\n'))

  const { nom, contact, pageEquipe } = organisation
  return [
    `${nom} ${annee} : rejoignez l’équipe d’organisation`,
    `Nous préparons ${nom} ${annee}. Nous cherchons encore des référentes et des référents pour ces périmètres :`,
    ...groupes,
    ...(contact
      ? [`Vous pouvez proposer votre aide par mail :\n${contact}`]
      : []),
    ...(pageEquipe
      ? [
          `Vous trouverez plus d’informations sur la page de l’équipe :\n${pageEquipe}`,
        ]
      : []),
  ].join('\n\n')
}
