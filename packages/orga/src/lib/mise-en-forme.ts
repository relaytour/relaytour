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
      return entourer(saisie, GRAS)
    case 'italique':
      return entourer(saisie, ITALIQUE)
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

interface Emphase {
  /** Les marques que le format reconnaît, la marque posée par défaut en tête. */
  marques: string[]
  exemple: string
  /** La marque à poser autour d'un passage. */
  choisir: (texte: string, debut: number, fin: number) => string
}

const LETTRE = /[\p{L}\p{N}]/u

/** Un passage collé à une lettre de chaque côté se trouve au milieu d'un mot. */
function auMilieuDUnMot(texte: string, debut: number, fin: number): boolean {
  return LETTRE.test(texte[debut - 1] ?? '') || LETTRE.test(texte[fin] ?? '')
}

const GRAS: Emphase = {
  marques: ['**', '__'],
  exemple: EXEMPLES.gras,
  choisir: () => '**',
}

// Le tiret bas ne marque pas l'italique au milieu d'un mot : l'astérisque le fait.
const ITALIQUE: Emphase = {
  marques: ['_', '*'],
  exemple: EXEMPLES.italique,
  choisir: (texte, debut, fin) =>
    auMilieuDUnMot(texte, debut, fin) ? '*' : '_',
}

/**
 * Une marque se trouve à cette position, seule : `*` ne se lit pas dans `**`, ni
 * `**` dans `***`.
 */
function marqueA(texte: string, position: number, marque: string): boolean {
  const signe = marque[0]
  return (
    position >= 0 &&
    texte.slice(position, position + marque.length) === marque &&
    texte[position - 1] !== signe &&
    texte[position + marque.length] !== signe
  )
}

/** La marque qui entoure entièrement un texte, sans se répéter à l'intérieur. */
function marqueQuiEntoure(texte: string, f: Emphase): string | null {
  return (
    f.marques.find(
      m =>
        texte.length > 2 * m.length &&
        marqueA(texte, 0, m) &&
        marqueA(texte, texte.length - m.length, m) &&
        !texte.slice(m.length, -m.length).includes(m)
    ) ?? null
  )
}

/** Retire toutes les marques du format d'un texte. */
function sansMarques(texte: string, f: Emphase): string {
  let resultat = texte
  for (const m of f.marques) {
    let i = resultat.length
    while ((i = resultat.lastIndexOf(m, i - 1)) !== -1) {
      if (marqueA(resultat, i, m))
        resultat = resultat.slice(0, i) + resultat.slice(i + m.length)
      if (i === 0) break
    }
  }
  return resultat
}

/**
 * Gras et italique : la sélection reçoit la marque de chaque côté, ou la perd si
 * elle la porte déjà. Les espaces du bord restent hors de la marque, sinon
 * Markdown ne la reconnaît pas. Sans sélection, un texte d'exemple se sélectionne.
 * Une sélection de plusieurs lignes se met en forme ligne par ligne : une marque
 * ne traverse pas une ligne vide.
 */
function entourer({ texte, debut, fin }: Saisie, f: Emphase): Remplacement {
  const choisi = texte.slice(debut, fin)
  if (choisi.includes('\n')) return entourerLesLignes(texte, debut, fin, f)

  if (choisi.length === 0) {
    // Le curseur se trouve entre deux marques vides : elles disparaissent.
    const vide = f.marques.find(
      m =>
        texte.slice(debut - m.length, debut) === m &&
        texte.slice(fin, fin + m.length) === m
    )
    if (vide !== undefined)
      return {
        debut: debut - vide.length,
        fin: fin + vide.length,
        insertion: '',
        selection: [debut - vide.length, debut - vide.length],
      }
    const m = f.choisir(texte, debut, fin)
    return {
      debut,
      fin,
      insertion: m + f.exemple + m,
      selection: [debut + m.length, debut + m.length + f.exemple.length],
    }
  }

  // La sélection comprend ses marques.
  const dedans = marqueQuiEntoure(choisi, f)
  if (dedans !== null) {
    const interieur = choisi.slice(dedans.length, -dedans.length)
    return {
      debut,
      fin,
      insertion: interieur,
      selection: [debut, debut + interieur.length],
    }
  }

  // Les marques entourent la sélection.
  const autour = f.marques.find(
    m => marqueA(texte, debut - m.length, m) && marqueA(texte, fin, m)
  )
  if (autour !== undefined) {
    const n = autour.length
    return {
      debut: debut - n,
      fin: fin + n,
      insertion: choisi,
      selection: [debut - n, debut - n + choisi.length],
    }
  }

  // Plusieurs passages déjà mis en forme : la sélection perd toutes ses marques.
  const nettoye = sansMarques(choisi, f)
  if (nettoye !== choisi)
    return {
      debut,
      fin,
      insertion: nettoye,
      selection: [debut, debut + nettoye.length],
    }

  const avant = /^\s*/.exec(choisi)?.[0] ?? ''
  const apres = /\s*$/.exec(choisi)?.[0] ?? ''
  const coeur = choisi.slice(avant.length, choisi.length - apres.length)
  const m = f.choisir(texte, debut + avant.length, fin - apres.length)
  if (coeur.length === 0)
    return {
      debut,
      fin,
      insertion: choisi + m + f.exemple + m,
      selection: [
        debut + choisi.length + m.length,
        debut + choisi.length + m.length + f.exemple.length,
      ],
    }
  const ouverture = debut + avant.length + m.length
  return {
    debut,
    fin,
    insertion: avant + m + coeur + m + apres,
    selection: [ouverture, ouverture + coeur.length],
  }
}

/**
 * Une sélection de plusieurs lignes : chaque ligne non vide reçoit la marque après
 * sa marque de titre ou de liste. Si toutes les lignes la portent déjà, elles la
 * perdent. Les lignes vides restent vides.
 */
function entourerLesLignes(
  texte: string,
  debut: number,
  fin: number,
  f: Emphase
): Remplacement {
  const lignes = texte.slice(debut, fin).split('\n')
  const lues = lignes.map(ligne => {
    const entete = DEBUT_DE_BLOC.exec(ligne)?.[0] ?? ''
    const reste = ligne.slice(entete.length)
    const avant = /^\s*/.exec(reste)?.[0] ?? ''
    const apres = /\s*$/.exec(reste)?.[0] ?? ''
    const coeur = reste.slice(avant.length, reste.length - apres.length)
    return { entete, avant, coeur, apres }
  })
  const pleines = lues.filter(l => l.coeur.length > 0)
  const retirer =
    pleines.length > 0 &&
    pleines.every(l => marqueQuiEntoure(l.coeur, f) !== null)
  const insertion = lues
    .map(l => {
      if (l.coeur.length === 0) return l.entete + l.avant + l.apres
      const deja = marqueQuiEntoure(l.coeur, f)
      if (retirer && deja !== null)
        return (
          l.entete +
          l.avant +
          l.coeur.slice(deja.length, -deja.length) +
          l.apres
        )
      if (deja !== null) return l.entete + l.avant + l.coeur + l.apres
      const m = f.choisir(l.coeur, 0, l.coeur.length)
      return l.entete + l.avant + m + l.coeur + m + l.apres
    })
    .join('\n')
  return { debut, fin, insertion, selection: [debut, debut + insertion.length] }
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
  const premiere = debut === 0 ? 0 : texte.lastIndexOf('\n', debut - 1) + 1
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

  // Une ligne plus en retrait que la précédente est un élément d'une sous-liste.
  // Son retrait se recalcule sur la colonne du texte de son parent, et chaque
  // niveau se numérote à part : une marque plus large ne casse pas l'imbrication.
  const pile: { retrait: number; colonne: number; enfants: number }[] = []
  let racine = 0
  const largeur = (r: string) => r.replace(/\t/g, '    ').length
  const nouvelles = lues.map(l => {
    if (l.vide && lues.length > 1) return l.ligne
    if (retirer) return l.retrait + l.corps
    // Un titre ne garde pas de retrait : Markdown le lirait comme du code.
    if (titre) return marqueDuBloc(bloc, 1) + l.corps
    const r = largeur(l.retrait)
    while (pile.length > 0 && r <= pile[pile.length - 1]!.retrait) pile.pop()
    const parent = pile[pile.length - 1]
    const rang = parent === undefined ? ++racine : ++parent.enfants
    const retrait =
      parent === undefined ? l.retrait : ' '.repeat(parent.colonne)
    const marque = marqueDuBloc(bloc, rang)
    pile.push({
      retrait: r,
      colonne: largeur(retrait) + marque.length,
      enfants: 0,
    })
    return retrait + marque + l.corps
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
 * pour être collée. Une adresse sélectionnée devient l'adresse du lien. Une
 * sélection dans un lien, sur son texte ou sur son adresse, retire le lien et
 * garde son texte.
 */
function lien({ texte, debut, fin }: Saisie): Remplacement {
  for (const trouve of texte.matchAll(/\[([^\]\n]*)\]\(([^)\s]*)\)/g)) {
    const depart = trouve.index ?? 0
    const arrivee = depart + trouve[0].length
    if (depart <= debut && fin <= arrivee && debut < arrivee) {
      const libelle = trouve[1] ?? ''
      return {
        debut: depart,
        fin: arrivee,
        insertion: libelle,
        selection: [depart, depart + libelle.length],
      }
    }
  }
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
