import { echapperHtml } from '../lib/html.ts'

import { GABARITS, type NomGabarit } from './gabarits.genere.ts'

// Un lien de mail est en https, sauf sur le poste local.
const LIEN_ATTENDU = /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//

export interface Rendu {
  html: string
  texte: string
}

/** Une ligne de liste suivie de lignes en retrait : le résumé d'une tâche partagée (ADR 0063). */
export interface LigneDeListe {
  texte: string
  retrait: string[]
}

export type ElementDeListe = string | LigneDeListe

/** Une rubrique d'un périmètre : « En retard », « Échéance proche »… (ADR 0063). */
export interface RubriqueDeListe {
  titre: string
  /** Une rubrique d'alerte (les retards) prend la couleur d'erreur. */
  alerte?: boolean
  elements: ElementDeListe[]
}

/** Un périmètre sous l'intertitre de son activité (ADR 0063). */
export interface SousGroupeDeListe {
  titre: string
  rubriques: RubriqueDeListe[]
}

/**
 * Une liste sous un intertitre : les rappels et le résumé, par activité (ADR 0032).
 * Les sous-groupes rangent ensuite les lignes par périmètre et par rubrique
 * (ADR 0063).
 */
export interface GroupeDeListe {
  titre: string
  elements: ElementDeListe[]
  sousGroupes?: SousGroupeDeListe[]
}

export type Variables = Record<
  string,
  string | ElementDeListe[] | GroupeDeListe[]
>

const GRIS = '#5B6670'
const ERREUR = '#B0283F'

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
  const estGroupee = (
    v: ElementDeListe[] | GroupeDeListe[]
  ): v is GroupeDeListe[] =>
    v.length > 0 &&
    typeof v[0] !== 'string' &&
    v[0] !== undefined &&
    'titre' in v[0]
  const poser = (
    source: string,
    texte: (v: string) => string,
    liste: (v: ElementDeListe[]) => string,
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
  return {
    html: poser(gabarit.html, echapperHtml, listeHtml, groupesHtml),
    texte: poser(
      gabarit.texte,
      v => v,
      e => listeTexte(e, ''),
      groupesTexte
    ),
  }
}

// Chaque texte s'échappe séparément ; les styles sont fixes et ne viennent jamais
// d'une valeur saisie.
function elementHtml(e: ElementDeListe): string {
  if (typeof e === 'string')
    return `<li style="margin:0 0 8px">${echapperHtml(e)}</li>`
  const retrait =
    e.retrait.length === 0
      ? ''
      : `<ul style="margin:4px 0 0;padding-left:16px;list-style-type:circle">${e.retrait
          .map(
            r =>
              `<li style="margin:0 0 2px;font-size:14px;line-height:20px;color:${GRIS}">${echapperHtml(r)}</li>`
          )
          .join('')}</ul>`
  return `<li style="margin:0 0 8px">${echapperHtml(e.texte)}${retrait}</li>`
}

function listeHtml(elements: ElementDeListe[]): string {
  return `<ul style="margin:0;padding-left:20px">${elements.map(elementHtml).join('')}</ul>`
}

function groupesHtml(groupes: GroupeDeListe[]): string {
  return groupes
    .map(g => {
      const titre = `<p style="margin:16px 0 6px;font-size:16px;font-weight:700">${echapperHtml(g.titre)}</p>`
      const elements = g.elements.length > 0 ? listeHtml(g.elements) : ''
      const sousGroupes = (g.sousGroupes ?? [])
        .map(
          sg =>
            `<p style="margin:12px 0 4px;padding-left:8px;border-left:3px solid #010101;font-weight:700">${echapperHtml(sg.titre)}</p>${sg.rubriques
              .map(
                r =>
                  `<p style="margin:6px 0 4px;font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${r.alerte ? ERREUR : GRIS}">${echapperHtml(r.titre)}</p>${listeHtml(r.elements)}`
              )
              .join('')}`
        )
        .join('')
      return `${titre}${elements}${sousGroupes}`
    })
    .join('')
}

// La partie texte suit la même hiérarchie, avec deux espaces de retrait par niveau.
function listeTexte(elements: ElementDeListe[], marge: string): string {
  return elements
    .map(e =>
      typeof e === 'string'
        ? `${marge}- ${e}`
        : [
            `${marge}- ${e.texte}`,
            ...e.retrait.map(r => `${marge}    · ${r}`),
          ].join('\n')
    )
    .join('\n')
}

function groupesTexte(groupes: GroupeDeListe[]): string {
  return groupes
    .map(g =>
      [
        g.titre,
        ...(g.elements.length > 0 ? [listeTexte(g.elements, '')] : []),
        ...(g.sousGroupes ?? []).map(sg =>
          [
            `  ${sg.titre}`,
            ...sg.rubriques.map(
              r => `    ${r.titre}\n${listeTexte(r.elements, '    ')}`
            ),
          ].join('\n')
        ),
      ].join('\n')
    )
    .join('\n\n')
}

export type { NomGabarit }
