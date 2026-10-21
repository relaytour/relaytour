// Mise en forme Markdown d'une zone de texte : chaque format calcule le passage
// de texte à remplacer et la sélection à poser ensuite. Le composant applique le
// remplacement dans la zone, ce qui garde l'historique d'annulation du navigateur.

export type Format =
  | 'gras'
  | 'italique'
  | 'titre2'
  | 'titre3'
  | 'puces'
  | 'numeros'
  | 'cases'
  | 'lien'
  | 'tableau'

/** Le texte de la zone et sa sélection (`debut` égal à `fin` pour un curseur). */
export interface Saisie {
  texte: string
  debut: number
  fin: number
}

/** Le passage `[debut, fin)` du texte d'origine devient `insertion`. */
export interface Remplacement {
  debut: number
  fin: number
  insertion: string
  /** La sélection à poser dans le texte obtenu. */
  selection: [number, number]
}

export const EXEMPLES = {
  gras: 'texte en gras',
  italique: 'texte en italique',
  lien: 'texte du lien',
  adresse: 'https://',
} as const

export const TABLEAU = [
  '| Colonne 1 | Colonne 2 |',
  '| --- | --- |',
  '| Texte | Texte |',
].join('\n')

/** Le texte obtenu après un remplacement. */
export function appliquer(texte: string, r: Remplacement): string {
  return texte.slice(0, r.debut) + r.insertion + texte.slice(r.fin)
}

export function mettreEnForme(format: Format, saisie: Saisie): Remplacement {
  switch (format) {
    case 'gras':
      return entourer(saisie, '**', EXEMPLES.gras)
    case 'italique':
      return entourer(saisie, '_', EXEMPLES.italique)
    case 'titre2':
      return prefixer(saisie, 'titre2')
    case 'titre3':
      return prefixer(saisie, 'titre3')
    case 'puces':
      return prefixer(saisie, 'puces')
    case 'numeros':
      return prefixer(saisie, 'numeros')
    case 'cases':
      return prefixer(saisie, 'cases')
    case 'lien':
      return lien(saisie)
    case 'tableau':
      return tableau(saisie)
  }
}

/**
 * Gras et italique : la sélection reçoit la marque de chaque côté, ou la perd si
 * elle la porte déjà. Les espaces du bord restent hors de la marque, sinon
 * Markdown ne la reconnaît pas. Sans sélection, un texte d'exemple se sélectionne.
 */
function entourer(
  { texte, debut, fin }: Saisie,
  marque: string,
  exemple: string
): Remplacement {
  const m = marque.length
  const choisi = texte.slice(debut, fin)

  if (choisi.length === 0) {
    // Le curseur se trouve entre deux marques vides : elles disparaissent.
    if (
      texte.slice(debut - m, debut) === marque &&
      texte.slice(fin, fin + m) === marque
    )
      return {
        debut: debut - m,
        fin: fin + m,
        insertion: '',
        selection: [debut - m, debut - m],
      }
    return {
      debut,
      fin,
      insertion: marque + exemple + marque,
      selection: [debut + m, debut + m + exemple.length],
    }
  }

  // La sélection comprend ses marques.
  if (
    choisi.length >= 2 * m &&
    choisi.startsWith(marque) &&
    choisi.endsWith(marque)
  ) {
    const interieur = choisi.slice(m, -m)
    return {
      debut,
      fin,
      insertion: interieur,
      selection: [debut, debut + interieur.length],
    }
  }

  // Les marques entourent la sélection.
  if (
    texte.slice(debut - m, debut) === marque &&
    texte.slice(fin, fin + m) === marque
  )
    return {
      debut: debut - m,
      fin: fin + m,
      insertion: choisi,
      selection: [debut - m, debut - m + choisi.length],
    }

  const avant = /^\s*/.exec(choisi)?.[0] ?? ''
  const apres = /\s*$/.exec(choisi)?.[0] ?? ''
  const coeur = choisi.slice(avant.length, choisi.length - apres.length)
  if (coeur.length === 0)
    return {
      debut,
      fin,
      insertion: choisi + marque + exemple + marque,
      selection: [
        debut + choisi.length + m,
        debut + choisi.length + m + exemple.length,
      ],
    }
  const ouverture = debut + avant.length + m
  return {
    debut,
    fin,
    insertion: avant + marque + coeur + marque + apres,
    selection: [ouverture, ouverture + coeur.length],
  }
}

type Bloc = 'titre2' | 'titre3' | 'puces' | 'numeros' | 'cases'

// Le début de ligne d'un bloc : retrait, puis marque de titre, de case, de puce
// ou de numéro.
const DEBUT_DE_BLOC =
  /^([ \t]*)(#{1,6}[ \t]+|[-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)?/

function natureDuBloc(marque: string | undefined): Bloc | 'titre' | null {
  if (marque === undefined) return null
  if (/^###[ \t]/.test(marque)) return 'titre3'
  if (/^##[ \t]/.test(marque)) return 'titre2'
  if (marque.startsWith('#')) return 'titre'
  if (/\[[ xX]\]/.test(marque)) return 'cases'
  if (/^\d/.test(marque)) return 'numeros'
  return 'puces'
}

function marqueDuBloc(bloc: Bloc, rang: number): string {
  switch (bloc) {
    case 'titre2':
      return '## '
    case 'titre3':
      return '### '
    case 'puces':
      return '- '
    case 'numeros':
      return `${rang}. `
    case 'cases':
      return '- [ ] '
  }
}

/**
 * Titres et listes : chaque ligne touchée par la sélection reçoit la marque du
 * bloc, qui remplace une autre marque de titre ou de liste. Si toutes les lignes
 * portent déjà ce bloc, la marque disparaît. Les lignes vides restent vides.
 */
function prefixer({ texte, debut, fin }: Saisie, bloc: Bloc): Remplacement {
  const premiere = texte.lastIndexOf('\n', debut - 1) + 1
  // Une sélection qui s'arrête au début d'une ligne ne touche pas cette ligne.
  const borne = fin > debut && texte[fin - 1] === '\n' ? fin - 1 : fin
  const finDeLigne = texte.indexOf('\n', borne)
  const derniere = finDeLigne === -1 ? texte.length : finDeLigne
  const lignes = texte.slice(premiere, derniere).split('\n')

  const lues = lignes.map(ligne => {
    const [entete = '', retrait = '', marque] = DEBUT_DE_BLOC.exec(ligne) ?? []
    return {
      ligne,
      retrait,
      corps: ligne.slice(entete.length),
      nature: natureDuBloc(marque),
      vide: ligne.trim().length === 0,
    }
  })
  const pleines = lues.filter(l => !l.vide)
  const retirer = pleines.length > 0 && pleines.every(l => l.nature === bloc)
  const titre = bloc === 'titre2' || bloc === 'titre3'

  let rang = 0
  const nouvelles = lues.map(l => {
    if (l.vide && lues.length > 1) return l.ligne
    if (retirer) return l.retrait + l.corps
    rang += 1
    // Un titre ne garde pas de retrait : Markdown le lirait comme du code.
    return (titre ? '' : l.retrait) + marqueDuBloc(bloc, rang) + l.corps
  })
  const insertion = nouvelles.join('\n')

  const [seule] = lues
  if (lues.length === 1 && seule !== undefined) {
    // Le curseur garde sa place dans le texte de la ligne.
    const ancienne = seule.ligne.length - seule.corps.length
    const nouvelle = insertion.length - seule.corps.length
    const decalage = nouvelle - ancienne
    const plancher = premiere + nouvelle
    const placer = (position: number) => Math.max(plancher, position + decalage)
    return {
      debut: premiere,
      fin: derniere,
      insertion,
      selection: [placer(debut), placer(fin)],
    }
  }
  return {
    debut: premiere,
    fin: derniere,
    insertion,
    selection: [premiere, premiere + insertion.length],
  }
}

/**
 * Lien : la sélection devient le texte du lien, puis l'adresse se sélectionne
 * pour être collée. Une adresse sélectionnée devient l'adresse du lien.
 */
function lien({ texte, debut, fin }: Saisie): Remplacement {
  const choisi = texte.slice(debut, fin)
  if (/^https?:\/\/\S+$/.test(choisi.trim())) {
    const insertion = `[${EXEMPLES.lien}](${choisi.trim()})`
    return {
      debut,
      fin,
      insertion,
      selection: [debut + 1, debut + 1 + EXEMPLES.lien.length],
    }
  }
  if (choisi.trim().length === 0) {
    const insertion = `[${EXEMPLES.lien}](${EXEMPLES.adresse})`
    return {
      debut,
      fin,
      insertion,
      selection: [debut + 1, debut + 1 + EXEMPLES.lien.length],
    }
  }
  const insertion = `[${choisi}](${EXEMPLES.adresse})`
  const adresse = debut + choisi.length + 3
  return {
    debut,
    fin,
    insertion,
    selection: [adresse, adresse + EXEMPLES.adresse.length],
  }
}

/**
 * Tableau : un tableau de deux colonnes s'ajoute après la ligne du curseur,
 * séparé du texte par une ligne vide. Le titre de la première colonne se
 * sélectionne.
 */
function tableau({ texte, fin }: Saisie): Remplacement {
  const finDeLigne = texte.indexOf('\n', fin)
  const position = finDeLigne === -1 ? texte.length : finDeLigne
  const avant = texte.slice(0, position)
  const apres = texte.slice(position)
  const ouverture =
    avant.length === 0 || avant.endsWith('\n\n')
      ? ''
      : avant.endsWith('\n')
        ? '\n'
        : '\n\n'
  const fermeture =
    apres.length === 0 || apres.startsWith('\n\n')
      ? ''
      : apres.startsWith('\n')
        ? '\n'
        : '\n\n'
  const debutDuTableau = position + ouverture.length + 2
  return {
    debut: position,
    fin: position,
    insertion: ouverture + TABLEAU + fermeture,
    selection: [debutDuTableau, debutDuTableau + 'Colonne 1'.length],
  }
}
