import { echapperHtml } from '../lib/html.ts'

import { GABARITS, type NomGabarit } from './gabarits.genere.ts'

// Un lien de mail est en https, sauf sur le poste local.
const LIEN_ATTENDU = /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//

export interface Rendu {
  html: string
  texte: string
}

export type Variables = Record<string, string | string[]>

/** Ce que l'organisation apporte à chaque mail : son nom court, son logo et ses couleurs. */
export interface VariablesOrganisation {
  organisation: string
  /** Logo PNG en adresse https, ou chaîne vide : l'en-tête affiche alors le nom. */
  logoUrl: string
  couleurEncre: string
  couleurPrimaire: string
  couleurAccent: string
  couleurSol: string
}

const COULEUR = /^#[0-9A-F]{6}$/i

/**
 * Remplit un gabarit précompilé. Les valeurs sont échappées dans la partie HTML
 * et laissées telles quelles dans la partie texte.
 *
 * Une valeur de type tableau devient une liste : `<ul>` dans la partie HTML, lignes
 * « - » dans la partie texte. Chaque élément est échappé séparément.
 */
export function rendre(
  nom: NomGabarit,
  variables: Variables,
  organisation: VariablesOrganisation
): Rendu {
  const gabarit = GABARITS[nom]
  const manquantes = gabarit.variables.filter(v => !(v in variables))
  if (manquantes.length > 0) {
    throw new Error(
      `Gabarit « ${nom} » : variables manquantes (${manquantes.join(', ')}).`
    )
  }
  for (const [cle, valeur] of Object.entries(variables)) {
    if (typeof valeur !== 'string') continue
    if (/lien|url/i.test(cle) && !LIEN_ATTENDU.test(valeur)) {
      throw new Error(
        `Gabarit « ${nom} » : la variable « ${cle} » doit être une adresse https.`
      )
    }
  }
  // Une couleur entre dans un attribut style : l'échappement HTML ne suffit pas.
  for (const [cle, valeur] of Object.entries(organisation) as [
    string,
    string,
  ][]) {
    if (cle.startsWith('couleur') && !COULEUR.test(valeur)) {
      throw new Error(
        `Gabarit « ${nom} » : la couleur « ${cle} » doit avoir la forme #RRGGBB.`
      )
    }
  }
  if (organisation.logoUrl !== '' && !LIEN_ATTENDU.test(organisation.logoUrl)) {
    throw new Error(
      `Gabarit « ${nom} » : le logo doit avoir une adresse https.`
    )
  }
  // La marque de l'en-tête HTML se compose ici, jamais depuis une valeur saisie :
  // l'adresse du logo et le nom sont échappés.
  const marque =
    organisation.logoUrl === ''
      ? echapperHtml(organisation.organisation)
      : `<img src="${echapperHtml(organisation.logoUrl)}" alt="${echapperHtml(organisation.organisation)}" height="48" style="display:inline-block;height:48px;max-width:200px;border:0" />`
  const toutes: Variables = { ...organisation, ...variables }
  const poser = (
    source: string,
    texte: (v: string) => string,
    liste: (v: string[]) => string
  ): string =>
    source.replaceAll(/\{\{(\w+)\}\}/g, (_m, cle: string) => {
      if (cle === 'marque')
        return texte === echapperHtml ? marque : organisation.organisation
      const valeur = toutes[cle] ?? ''
      return typeof valeur === 'string' ? texte(valeur) : liste(valeur)
    })
  return {
    html: poser(
      gabarit.html,
      echapperHtml,
      elements =>
        `<ul style="margin:0;padding-left:20px">${elements
          .map(e => `<li style="margin:0 0 8px">${echapperHtml(e)}</li>`)
          .join('')}</ul>`
    ),
    texte: poser(
      gabarit.texte,
      v => v,
      elements => elements.map(e => `- ${e}`).join('\n')
    ),
  }
}

export type { NomGabarit }
