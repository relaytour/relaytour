import { echapperHtml } from '../lib/html.ts'

import { GABARITS, type NomGabarit } from './gabarits.genere.ts'

// Un lien de mail est en https, sauf sur le poste local.
const LIEN_ATTENDU = /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//

export interface Rendu {
  html: string
  texte: string
}

/** Une liste sous un intertitre : les rappels et le résumé, par activité (ADR 0032). */
export interface GroupeDeListe {
  titre: string
  elements: string[]
}

export type Variables = Record<string, string | string[] | GroupeDeListe[]>

/**
 * Ce que l'organisation apporte à chaque mail : son nom court, son logo, ses
 * couleurs et la consigne de réponse de son pied.
 */
export interface VariablesOrganisation {
  organisation: string
  /** Logo PNG en adresse https, ou chaîne vide : l'en-tête affiche alors le nom. */
  logoUrl: string
  couleurEncre: string
  couleurPrimaire: string
  couleurAccent: string
  couleurSol: string
  /** La dernière phrase du pied : répondre au mail, ou passer par un espace (ADR 0053). */
  consigneReponse: string
}

const COULEUR = /^#[0-9A-F]{6}$/i

/**
 * Remplit un gabarit précompilé. Les valeurs sont échappées dans la partie HTML
 * et laissées telles quelles dans la partie texte.
 *
 * Une valeur de type tableau devient une liste : `<ul>` dans la partie HTML, lignes
 * « - » dans la partie texte. Chaque élément est échappé séparément. Une liste de
 * groupes place chaque liste sous son intertitre.
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
  // Les textes fixes du gabarit, dans la langue de l'envoi (ADR 0047). Une variable
  // de liste n'entre pas dans un texte traduit.
  const valeursTexte = Object.fromEntries(
    Object.entries(toutes).filter(
      (e): e is [string, string] => typeof e[1] === 'string'
    )
  )
  const textes = gabarit.textes(valeursTexte)
  const estGroupee = (v: string[] | GroupeDeListe[]): v is GroupeDeListe[] =>
    v.length > 0 && typeof v[0] !== 'string'
  const poser = (
    source: string,
    texte: (v: string) => string,
    liste: (v: string[]) => string,
    groupes: (v: GroupeDeListe[]) => string
  ): string =>
    source.replaceAll(/\{\{(\w+|§\d+)\}\}/g, (_m, cle: string) => {
      if (cle.startsWith('§')) return texte(textes[Number(cle.slice(1))] ?? '')
      if (cle === 'marque')
        return texte === echapperHtml ? marque : organisation.organisation
      const valeur = toutes[cle] ?? ''
      if (typeof valeur === 'string') return texte(valeur)
      return estGroupee(valeur) ? groupes(valeur) : liste(valeur)
    })
  const listeHtml = (elements: string[]) =>
    `<ul style="margin:0;padding-left:20px">${elements
      .map(e => `<li style="margin:0 0 8px">${echapperHtml(e)}</li>`)
      .join('')}</ul>`
  const listeTexte = (elements: string[]) =>
    elements.map(e => `- ${e}`).join('\n')
  return {
    html: poser(gabarit.html, echapperHtml, listeHtml, groupes =>
      groupes
        .map(
          g =>
            `<p style="margin:12px 0 6px;font-weight:700">${echapperHtml(g.titre)}</p>${listeHtml(g.elements)}`
        )
        .join('')
    ),
    texte: poser(
      gabarit.texte,
      v => v,
      listeTexte,
      groupes =>
        groupes.map(g => `${g.titre}\n${listeTexte(g.elements)}`).join('\n\n')
    ),
  }
}

export type { NomGabarit }
