import type { MessageDescriptor } from '@lingui/core'
import { msg, t } from '@lingui/core/macro'
import {
  nomVide,
  regrouper,
  sansAccent,
  type Identite,
} from '@relaytour/commun'

// Import de listes de bénévoles (ADR 0042), côté navigateur. Le fichier se lit
// ici et ne quitte jamais le poste : seules les colonnes associées partent vers le
// serveur, sous la forme de personnes déjà réunies. Ce module ne dépend ni de
// React ni des bibliothèques de lecture, que `lireFichier` charge à la demande.

/** Bornes d'un fichier (ADR 0042). */
export const TAILLE_MAX = 2 * 1024 * 1024
export const LIGNES_MAX = 5000
export const COLONNES_MAX = 200
/** Le serveur reçoit les personnes par lots (corps de requête sous 1 Mo). */
export const LOT = 500

export interface Tableau {
  entetes: string[]
  lignes: string[][]
  /** Le séparateur d'un CSV, repris pour le fichier des lignes écartées. */
  separateur?: string
}

export interface Feuille {
  nom: string
  tableau: Tableau
}

// ── Lecture ──────────────────────────────────────────────────────────────────

/** Le texte d'un CSV : UTF-8 (avec ou sans BOM), sinon Windows-1252. */
export function decoderTexte(octets: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true })
      .decode(octets)
      .replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(octets)
  }
}

/** Une valeur de cellule en texte : une date devient AAAA-MM-JJ. */
export function texteDeCellule(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10)
  if (typeof valeur === 'string') return valeur.trim()
  if (typeof valeur === 'number' || typeof valeur === 'boolean') {
    return String(valeur)
  }
  return ''
}

/** Un tableau depuis des lignes brutes : la première ligne non vide donne les en-têtes. */
export function tableauDepuis(lignes: readonly unknown[][]): Tableau {
  const textes = lignes
    .map(l => l.map(texteDeCellule))
    .filter(l => l.some(c => c !== ''))
  const [entetes = [], ...reste] = textes
  const largeur = Math.max(entetes.length, ...reste.map(l => l.length))
  if (largeur > COLONNES_MAX) {
    throw new Error(t`Un fichier compte ${COLONNES_MAX} colonnes au plus.`)
  }
  if (reste.length > LIGNES_MAX) {
    throw new Error(t`Un fichier compte ${LIGNES_MAX} lignes au plus.`)
  }
  const nommer = (e: string | undefined, i: number) => {
    const numero = i + 1
    return e && e !== '' ? e : t`Colonne ${numero}`
  }
  return {
    entetes: Array.from({ length: largeur }, (_, i) => nommer(entetes[i], i)),
    lignes: reste.map(l =>
      Array.from({ length: largeur }, (_, i) => l[i] ?? '')
    ),
  }
}

/** Lit un CSV : le séparateur (point-virgule, virgule, tabulation) est détecté. */
export async function lireCsv(texte: string): Promise<Tableau> {
  const { default: Papa } = await import('papaparse')
  const resultat = Papa.parse<string[]>(texte, {
    delimitersToGuess: [';', ',', '\t'],
    skipEmptyLines: 'greedy',
  })
  return {
    ...tableauDepuis(resultat.data),
    separateur: resultat.meta.delimiter,
  }
}

/** Lit un fichier CSV ou XLSX : une feuille par feuille du classeur. */
export async function lireFichier(fichier: File): Promise<Feuille[]> {
  if (fichier.size > TAILLE_MAX) {
    throw new Error(t`Un fichier pèse 2 Mo au plus.`)
  }
  const octets = await fichier.arrayBuffer()
  if (/\.xlsx$/i.test(fichier.name)) {
    const { default: lireClasseur } = await import('read-excel-file/universal')
    const feuilles = await lireClasseur(octets)
    return feuilles.map(f => ({
      nom: f.sheet,
      tableau: tableauDepuis(f.data as unknown[][]),
    }))
  }
  if (/\.(csv|txt)$/i.test(fichier.name)) {
    return [{ nom: fichier.name, tableau: await lireCsv(decoderTexte(octets)) }]
  }
  throw new Error(t`Choisissez un fichier CSV ou Excel (.xlsx).`)
}

// ── Colonnes ─────────────────────────────────────────────────────────────────

export type Champ =
  | 'IGNORER'
  | 'PRENOM'
  | 'NOM'
  | 'NOM_COMPLET'
  | 'COURRIEL'
  | 'TELEPHONE'
  | 'PRECISIONS'
  | 'CHOIX'
  | 'VALEURS'
  | 'REF_EXTERNE'
  | 'REGROUPEMENT'
  | 'DATE_ACCORD'

/** Les libellés des champs, à traduire à l'affichage : `t(LIBELLES_CHAMP[champ])`. */
export const LIBELLES_CHAMP: Record<Champ, MessageDescriptor> = {
  IGNORER: msg({
    message: 'Ignorer',
    comment:
      'Champ à associer à une colonne d’un fichier : ne pas importer la colonne',
  }),
  PRENOM: msg({
    message: 'Prénom',
    comment: 'Champ à associer à une colonne d’un fichier',
  }),
  NOM: msg({
    message: 'Nom',
    comment: 'Champ à associer à une colonne d’un fichier : nom de famille',
  }),
  NOM_COMPLET: msg`Prénom et nom`,
  COURRIEL: msg({
    message: 'Adresse mail',
    comment: 'Champ à associer à une colonne d’un fichier',
  }),
  TELEPHONE: msg({
    message: 'Téléphone',
    comment: 'Champ à associer à une colonne d’un fichier',
  }),
  PRECISIONS: msg`Précisions de disponibilité`,
  CHOIX: msg`Un poste ou un créneau (une colonne par choix)`,
  VALEURS: msg`Postes et créneaux (plusieurs par cellule)`,
  REF_EXTERNE: msg`Identifiant externe`,
  REGROUPEMENT: msg`Regroupement des lignes`,
  DATE_ACCORD: msg`Date de l’accord`,
}

/** Les champs qu'une seule colonne reçoit. */
const UNIQUES: Champ[] = [
  'PRENOM',
  'NOM',
  'NOM_COMPLET',
  'COURRIEL',
  'TELEPHONE',
  'REF_EXTERNE',
  'REGROUPEMENT',
  'DATE_ACCORD',
]

/** Les synonymes d'en-tête, comparés sans accent ni casse. */
const SYNONYMES: [Champ, RegExp][] = [
  ['COURRIEL', /\b(e-?mail|courriel|mail|adresse electronique)\b/],
  ['TELEPHONE', /\b(tel|telephone|portable|mobile|gsm|phone)\b/],
  ['PRENOM', /\b(prenom|first ?name)\b/],
  [
    'NOM_COMPLET',
    /^(nom complet|nom et prenom|prenom et nom|participant|name|full name)$/,
  ],
  ['NOM', /\b(nom|last ?name|nom de famille)\b/],
  [
    'PRECISIONS',
    /\b(disponibilites?|precisions?|commentaires?|remarques?|precise)\b/,
  ],
  ['VALEURS', /\b(prestations?|postes?|creneaux|missions?)\b/],
  [
    'DATE_ACCORD',
    /\b(date (de )?(la )?commande|date (de )?creation|date d'inscription|inscrit le)\b/,
  ],
  ['REF_EXTERNE', /\b(billet|ticket|numero de billet|identifiant|id)\b/],
  ['REGROUPEMENT', /\b(commande|transaction|numero de commande)\b/],
]

/** Les colonnes qui ne doivent jamais partir : elles restent ignorées. */
const SENSIBLES =
  /\b(genre|sexe|civilite|pronom|sante|allergie|handicap|paiement|montant|prix|moyen de paiement|tarif|iban|carte)\b/

export type Confiance = 'HAUTE' | 'MOYENNE' | 'BASSE'

export interface Colonne {
  index: number
  entete: string
  exemples: string[]
  champ: Champ
  confiance: Confiance
  /** Une colonne sensible ne peut qu'être ignorée. */
  sensible: boolean
  remplissage: number
}

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HORAIRE =
  /(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:-|–|à|a|\/)\s*(\d{1,2})\s*(?:h|:)?\s*(\d{2})?/i

/** La part de cellules non vides d'une colonne qui vérifie un test. */
function part(valeurs: readonly string[], test: (v: string) => boolean) {
  const remplies = valeurs.filter(v => v !== '')
  if (remplies.length === 0) return 0
  return remplies.filter(test).length / remplies.length
}

/** Propose un champ pour chaque colonne, par son en-tête puis par son contenu. */
export function detecterColonnes(tableau: Tableau): Colonne[] {
  const colonnes: Colonne[] = tableau.entetes.map((entete, index) => {
    const valeurs = tableau.lignes.map(l => l[index] ?? '')
    const remplies = valeurs.filter(v => v !== '')
    const cle = sansAccent(entete)
    const sensible = SENSIBLES.test(cle)
    const base = {
      index,
      entete,
      exemples: [...new Set(remplies)].slice(0, 3),
      sensible,
      remplissage:
        tableau.lignes.length === 0
          ? 0
          : remplies.length / tableau.lignes.length,
    }
    if (sensible) return { ...base, champ: 'IGNORER', confiance: 'HAUTE' }
    // Un en-tête qui porte un horaire désigne une colonne par poste ou par
    // créneau : « Service au bar - 18h - 19h ».
    if (HORAIRE.test(entete)) {
      return { ...base, champ: 'CHOIX', confiance: 'HAUTE' }
    }
    const parContenu: [Champ, number][] = [
      ['COURRIEL', part(valeurs, v => COURRIEL.test(v))],
      // Neuf chiffres au moins : un numéro de billet ne passe pas pour un téléphone.
      [
        'TELEPHONE',
        part(
          valeurs,
          v => v.replace(/\D/g, '').length >= 9 && /^[+0-9 ().-]+$/.test(v)
        ),
      ],
      ['VALEURS', part(valeurs, v => v.includes('\n') && HORAIRE.test(v))],
    ]
    const synonyme = SYNONYMES.find(([, motif]) => motif.test(cle))?.[0]
    const contenu = parContenu.find(([, taux]) => taux >= 0.8)?.[0]
    // L'en-tête l'emporte ; le contenu le confirme, ou propose un champ quand
    // l'en-tête ne dit rien.
    if (synonyme) {
      return {
        ...base,
        champ: synonyme,
        confiance: contenu === synonyme ? 'HAUTE' : 'MOYENNE',
      }
    }
    if (contenu) return { ...base, champ: contenu, confiance: 'MOYENNE' }
    return { ...base, champ: 'IGNORER', confiance: 'BASSE' }
  })
  // Un champ unique revient à la colonne la plus remplie (« Prénom participant »
  // et « Prénom » : la colonne remplie l'emporte).
  for (const champ of UNIQUES) {
    const candidates = colonnes.filter(c => c.champ === champ)
    if (candidates.length < 2) continue
    const gardee = [...candidates].sort(
      (a, b) => b.remplissage - a.remplissage
    )[0]!
    for (const c of candidates) {
      if (c !== gardee)
        Object.assign(c, { champ: 'IGNORER', confiance: 'BASSE' })
    }
  }
  return colonnes
}

/** Vrai si les colonnes associées désignent au moins une personne. */
export function associationSuffisante(champs: readonly Champ[]): boolean {
  return champs.some(c =>
    ['PRENOM', 'NOM', 'NOM_COMPLET', 'COURRIEL', 'TELEPHONE'].includes(c)
  )
}

// ── Horaires et dates ────────────────────────────────────────────────────────

export interface Horaire {
  heureDebut: string
  heureFin: string
}

const deux = (n: number) => String(n).padStart(2, '0')

/** Lit un horaire « 17h - 18h », « 17:00-18:30 » ou « 9h à 12h ». */
export function lireHoraire(texte: string): Horaire | null {
  const m = HORAIRE.exec(texte)
  if (!m) return null
  const [h1, m1, h2, m2] = [m[1], m[2], m[3], m[4]].map(v => Number(v ?? 0))
  if (h1! > 24 || h2! > 24 || m1! > 59 || m2! > 59) return null
  return {
    heureDebut: `${deux(h1! % 24)}:${deux(m1!)}`,
    heureFin: `${deux(h2! % 24)}:${deux(m2!)}`,
  }
}

/** Le texte d'un choix sans son horaire : « Service au bar - 18h - 19h » → « Service au bar ». */
export function posteDe(texte: string): string {
  return texte
    .replace(HORAIRE, '')
    .replace(/[\s\-–:,·]+$/, '')
    .trim()
}

/**
 * Lit une date : AAAA-MM-JJ, JJ/MM/AAAA, ou un nombre de série Excel. Rend
 * AAAA-MM-JJ, ou null.
 */
export function lireDate(texte: string): string | null {
  const t = texte.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return dateValide(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t)
  if (m) {
    const [premier, second, annee] = [Number(m[1]), Number(m[2]), Number(m[3])]
    // JJ/MM/AAAA, sauf quand le second nombre ne peut être qu'un jour : un
    // export américain écrit MM/JJ/AAAA.
    return second > 12 && premier <= 12
      ? dateValide(annee, premier, second)
      : dateValide(annee, second, premier)
  }
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const jours = Math.floor(Number(t))
    // Le nombre de série compte les jours depuis le 30 décembre 1899.
    const date = new Date(Date.UTC(1899, 11, 30) + jours * 86_400_000)
    return date.toISOString().slice(0, 10)
  }
  return null
}

/** AAAA-MM-JJ si le jour existe, sinon null : une date invalide n'atteint pas le serveur. */
function dateValide(annee: number, mois: number, jour: number): string | null {
  const date = new Date(Date.UTC(annee, mois - 1, jour))
  return date.getUTCFullYear() === annee &&
    date.getUTCMonth() === mois - 1 &&
    date.getUTCDate() === jour
    ? date.toISOString().slice(0, 10)
    : null
}

// ── Choix ────────────────────────────────────────────────────────────────────

/** Un choix du fichier : une colonne de la forme 2, ou une valeur de la forme 4. */
export interface Choix {
  cle: string
  libelle: string
  horaire: Horaire | null
}

export type Cible =
  | { type: 'SEQUENCE'; sequenceId: string }
  | { type: 'PLAGE' }
  | { type: 'IGNORER' }

/**
 * Les valeurs d'une cellule de la forme 4, séparées par des retours à la ligne,
 * des virgules ou des points-virgules. Un poste suivi d'horaires seuls donne une
 * valeur par horaire : « Service au bar / 18h - 19h / 19h - 20h » donne « Service
 * au bar 18h - 19h » et « Service au bar 19h - 20h ».
 */
export function valeursDe(cellule: string): string[] {
  const brutes = cellule
    .split(/\r?\n|;|,(?![^(]*\))/)
    .map(v => v.trim())
    .filter(Boolean)
  const valeurs: string[] = []
  let poste: string | null = null
  let posteServi = true
  for (const brute of brutes) {
    const horaire = lireHoraire(brute) !== null
    if (horaire && posteDe(brute) === '' && poste !== null) {
      valeurs.push(`${poste} ${brute}`)
      posteServi = true
      continue
    }
    if (poste !== null && !posteServi) valeurs.push(poste)
    if (horaire) {
      valeurs.push(brute)
      // « Buvette 19h-20h, 20h-21h » : l'horaire seul qui suit reprend le poste.
      poste = posteDe(brute) || null
      posteServi = true
    } else {
      poste = brute
      posteServi = false
    }
  }
  if (poste !== null && !posteServi) valeurs.push(poste)
  return valeurs
}

/** Les choix d'un fichier : les colonnes de la forme 2, puis les valeurs distinctes de la forme 4. */
export function choixDuFichier(
  tableau: Tableau,
  champs: readonly Champ[]
): Choix[] {
  const choix = new Map<string, Choix>()
  champs.forEach((champ, i) => {
    if (champ === 'CHOIX') {
      const libelle = tableau.entetes[i]!
      choix.set(`colonne:${i}`, {
        cle: `colonne:${i}`,
        libelle,
        horaire: lireHoraire(libelle),
      })
    }
    if (champ === 'VALEURS') {
      for (const ligne of tableau.lignes) {
        for (const valeur of valeursDe(ligne[i] ?? '')) {
          const cle = `valeur:${sansAccent(valeur)}`
          if (!choix.has(cle)) {
            choix.set(cle, {
              cle,
              libelle: valeur,
              horaire: lireHoraire(valeur),
            })
          }
        }
      }
    }
  })
  return [...choix.values()]
}

export interface SequenceProposable {
  id: string
  titre: string
  jour: string
  heureDebut: string
  heureFin: string
}

const minutes = (h: string) => {
  const [a, b] = h.split(':').map(Number)
  return (a ?? 0) * 60 + (b ?? 0)
}

/**
 * Propose une séquence pour un choix : un mot du titre en commun, puis le
 * recouvrement de l'horaire le jour choisi. Sans séquence plausible, un choix
 * qui porte un horaire devient une plage de disponibilité.
 */
export function proposerCible(
  choix: Choix,
  sequences: readonly SequenceProposable[],
  jour: string | null
): Cible {
  const mots = new Set(
    sansAccent(posteDe(choix.libelle))
      .split(/[^a-z0-9]+/)
      .filter(m => m.length >= 3)
  )
  const notes = sequences.map(s => {
    const communs = sansAccent(s.titre)
      .split(/[^a-z0-9]+/)
      .filter(m => mots.has(m)).length
    let recouvre = 0
    if (choix.horaire && (jour === null || s.jour === jour)) {
      const debut = Math.max(
        minutes(choix.horaire.heureDebut),
        minutes(s.heureDebut)
      )
      const fin = Math.min(minutes(choix.horaire.heureFin), minutes(s.heureFin))
      recouvre = fin > debut ? 1 : 0
    }
    return { s, note: communs * 2 + recouvre }
  })
  const meilleure = notes.sort((a, b) => b.note - a.note)[0]
  if (meilleure && meilleure.note >= 2) {
    return { type: 'SEQUENCE', sequenceId: meilleure.s.id }
  }
  return choix.horaire ? { type: 'PLAGE' } : { type: 'IGNORER' }
}

// ── Personnes ────────────────────────────────────────────────────────────────

export interface Reglages {
  /** Les valeurs qui signifient « non » dans une colonne de la forme 2. */
  valeursNon: string[]
  /** Le jour d'un horaire sans jour. */
  jour: string | null
}

export const VALEURS_NON_PAR_DEFAUT = ['non', 'no', 'false', 'faux', 'n']

export interface PlageSaisie {
  jour: string
  heureDebut: string
  heureFin: string
}

export interface PersonneLue extends Identite {
  cle: string
  /** Les numéros des lignes du fichier, comme les montre un tableur. */
  lignes: number[]
  nom: string
  courriel: string | null
  telephone: string | null
  precisions: string | null
  refExterne: string | null
  accordLe: string | null
  sequenceIds: string[]
  plages: PlageSaisie[]
}

export interface LigneEcartee {
  ligne: number
  motif: string
  valeurs: string[]
}

/** Les personnes du fichier, réunies, et les lignes écartées avec leur motif. */
export function construirePersonnes(
  tableau: Tableau,
  champs: readonly Champ[],
  cibles: ReadonlyMap<string, Cible>,
  reglages: Reglages
): { personnes: PersonneLue[]; ecartees: LigneEcartee[] } {
  const colonne = (champ: Champ) => champs.indexOf(champ)
  const non = new Set(reglages.valeursNon.map(v => sansAccent(v)))
  const ecartees: LigneEcartee[] = []
  const lues: (PersonneLue & { groupe: string | null })[] = []
  tableau.lignes.forEach((ligne, i) => {
    const numero = i + 2
    const valeur = (champ: Champ) => {
      const index = colonne(champ)
      return index < 0 ? '' : (ligne[index] ?? '').trim()
    }
    const complet = valeur('NOM_COMPLET')
    const separe = [valeur('PRENOM'), valeur('NOM')].filter(Boolean).join(' ')
    const nom = nomVide(complet) ? separe : complet
    const courriel = valeur('COURRIEL') || null
    const telephone = valeur('TELEPHONE') || null
    const groupe = valeur('REGROUPEMENT') || null
    // Une ligne sans personne rejoint encore son groupe : la ligne d'une commande
    // peut ne porter qu'un poste.
    if (
      nomVide(nom) &&
      courriel === null &&
      telephone === null &&
      groupe === null
    ) {
      ecartees.push({
        ligne: numero,
        motif: t`La ligne ne porte ni nom, ni adresse, ni téléphone.`,
        valeurs: ligne,
      })
      return
    }
    const sequenceIds = new Set<string>()
    const plages: PlageSaisie[] = []
    const retenir = (cle: string, libelle: string) => {
      const cible = cibles.get(cle)
      if (!cible || cible.type === 'IGNORER') return
      if (cible.type === 'SEQUENCE') {
        sequenceIds.add(cible.sequenceId)
        return
      }
      const horaire = lireHoraire(libelle)
      const deja = plages.some(
        p =>
          p.heureDebut === horaire?.heureDebut &&
          p.heureFin === horaire.heureFin
      )
      if (horaire && reglages.jour && !deja) {
        plages.push({ jour: reglages.jour, ...horaire })
      }
    }
    champs.forEach((champ, index) => {
      const cellule = (ligne[index] ?? '').trim()
      if (
        champ === 'CHOIX' &&
        cellule !== '' &&
        !non.has(sansAccent(cellule))
      ) {
        retenir(`colonne:${index}`, tableau.entetes[index]!)
      }
      if (champ === 'VALEURS') {
        for (const v of valeursDe(cellule))
          retenir(`valeur:${sansAccent(v)}`, v)
      }
    })
    const precisions =
      champs
        .map((c, index) =>
          c === 'PRECISIONS' ? (ligne[index] ?? '').trim() : ''
        )
        .filter(Boolean)
        .join(' · ') || null
    lues.push({
      cle: `L${numero}`,
      lignes: [numero],
      // Une ligne sans nom, mais avec une adresse ou un téléphone, prend cette
      // coordonnée pour nom : l'aperçu la montre telle quelle.
      nom: nomVide(nom) ? (courriel ?? telephone ?? '') : nom,
      courriel,
      telephone,
      precisions,
      refExterne: valeur('REF_EXTERNE') || null,
      accordLe: lireDate(valeur('DATE_ACCORD')),
      sequenceIds: [...sequenceIds],
      plages,
      groupe,
    })
  })
  // Les lignes d'une même personne se réunissent : par la colonne de
  // regroupement, puis par l'adresse, le téléphone ou le nom.
  const parGroupe = new Map<string, (typeof lues)[number]>()
  const seules: (typeof lues)[number][] = []
  for (const l of lues) {
    if (l.groupe === null) {
      seules.push(l)
      continue
    }
    const deja = parGroupe.get(l.groupe)
    // Deux adresses différentes dans un même groupe désignent deux personnes :
    // une commande de deux billets, par exemple.
    if (
      deja &&
      deja.courriel !== null &&
      l.courriel !== null &&
      deja.courriel.toLowerCase() !== l.courriel.toLowerCase()
    ) {
      seules.push(l)
    } else if (deja) fusionner(deja, l)
    else parGroupe.set(l.groupe, l)
  }
  // Un groupe qui ne désigne toujours personne est écarté, ligne par ligne.
  const designees = [...parGroupe.values()].filter(l => {
    if (!nomVide(l.nom) || l.courriel !== null || l.telephone !== null) {
      return true
    }
    for (const numero of l.lignes) {
      ecartees.push({
        ligne: numero,
        motif: t`Le groupe de la ligne ne porte ni nom, ni adresse, ni téléphone.`,
        valeurs: tableau.lignes[numero - 2] ?? [],
      })
    }
    return false
  })
  const personnes = regrouper([...designees, ...seules]).map(lignes => {
    const [premiere, ...autres] = lignes
    for (const autre of autres) fusionner(premiere!, autre)
    const { groupe, ...personne } = premiere!
    void groupe
    return personne
  })
  ecartees.sort((a, b) => a.ligne - b.ligne)
  return {
    personnes: personnes.sort((a, b) => a.lignes[0]! - b.lignes[0]!),
    ecartees,
  }
}

/** Réunit une ligne dans une autre : les champs vides se complètent, les choix s'additionnent. */
function fusionner(a: PersonneLue, b: PersonneLue) {
  a.lignes = [...a.lignes, ...b.lignes].sort((x, y) => x - y)
  if (nomVide(a.nom) || a.nom === a.courriel || a.nom === a.telephone) {
    if (!nomVide(b.nom)) a.nom = b.nom
  }
  a.courriel ??= b.courriel
  a.telephone ??= b.telephone
  a.refExterne ??= b.refExterne
  a.accordLe ??= b.accordLe
  a.precisions =
    [a.precisions, b.precisions]
      .filter((p, i, liste) => p && liste.indexOf(p) === i)
      .join(' · ') || null
  a.sequenceIds = [...new Set([...a.sequenceIds, ...b.sequenceIds])]
  const vues = new Set(
    a.plages.map(p => `${p.jour}${p.heureDebut}${p.heureFin}`)
  )
  for (const p of b.plages) {
    if (!vues.has(`${p.jour}${p.heureDebut}${p.heureFin}`)) a.plages.push(p)
  }
}

/** Les personnes par lots de LOT, dans l'ordre. */
export function enLots<T>(liste: readonly T[], taille = LOT): T[][] {
  const lots: T[][] = []
  for (let i = 0; i < liste.length; i += taille)
    lots.push(liste.slice(i, i + taille))
  return lots
}

/** Les lignes écartées en CSV, avec leur motif en première colonne. */
export async function csvDesEcartees(
  entetes: readonly string[],
  ecartees: readonly LigneEcartee[],
  separateur = ';'
): Promise<string> {
  const { default: Papa } = await import('papaparse')
  return Papa.unparse(
    {
      fields: [
        t({
          message: 'Ligne',
          comment: 'En-tête d’une colonne du fichier des lignes écartées',
        }),
        t({
          message: 'Motif',
          comment: 'En-tête d’une colonne du fichier des lignes écartées',
        }),
        ...entetes,
      ],
      data: ecartees.map(e => [String(e.ligne), e.motif, ...e.valeurs]),
    },
    // Le séparateur du fichier d'origine ; un point-virgule pour un classeur,
    // que les tableurs en français ouvrent colonne par colonne.
    { delimiter: separateur }
  )
}

/** Les champs qu'une seule colonne peut recevoir. */
export function champUnique(champ: Champ): boolean {
  return UNIQUES.includes(champ)
}
