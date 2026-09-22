import { GROUPES_PAR_DEFAUT, type GroupePerimetres } from './activites.ts'

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
 * ensuite le plus grand nombre de postes à pourvoir ; enfin l'ordre des groupes de
 * l'activité (sport puis pôle par défaut), l'ordre du périmètre et son nom. La liste
 * d'origine n'est pas modifiée.
 */
export function trierPostes<
  T extends {
    etat: EtatPostes
    aPourvoir: number
    perimetre: { groupe: string; ordre: number; nom: string }
  },
>(liste: T[], groupes: string[] = GROUPES_PAR_DEFAUT.map(g => g.cle)): T[] {
  const rangGroupe = (groupe: string) => {
    const rang = groupes.indexOf(groupe)
    return rang === -1 ? groupes.length : rang
  }
  return [...liste].sort(
    (a, b) =>
      RANG_ETAT[a.etat] - RANG_ETAT[b.etat] ||
      b.aPourvoir - a.aPourvoir ||
      rangGroupe(a.perimetre.groupe) - rangGroupe(b.perimetre.groupe) ||
      a.perimetre.ordre - b.perimetre.ordre ||
      a.perimetre.nom.localeCompare(b.perimetre.nom, 'fr')
  )
}

/**
 * Message d'appel à diffuser, sans aucun chiffre en dehors de l'année.
 * Renvoie null quand aucun périmètre n'est à pourvoir. Les périmètres se rangent
 * par groupe de l'activité, sous son libellé pluriel ; un groupe vide est omis.
 */
export function texteAppel(
  annee: number,
  perimetres: { nom: string; groupe: string }[],
  organisation: OrganisationAppel,
  groupesActivite: GroupePerimetres[] = GROUPES_PAR_DEFAUT
): string | null {
  if (perimetres.length === 0) return null
  const groupes = groupesActivite
    .map(({ libellePluriel, cle }) => ({
      titre: libellePluriel,
      noms: perimetres.filter(p => p.groupe === cle).map(p => p.nom),
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
