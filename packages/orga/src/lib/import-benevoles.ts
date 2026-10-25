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

import {
  detecterColonnesSelon,
  lireDate,
  part,
  type ColonneDetectee,
  type LigneEcartee,
  type Tableau,
} from './import-tableur'

// Lecture, dates et lots : le module commun des imports de tableurs (ADR 0049).
export {
  COLONNES_MAX,
  csvDesEcartees,
  decoderTexte,
  enLots,
  LIGNES_MAX,
  lireCsv,
  lireDate,
  lireFichier,
  LOT,
  TAILLE_MAX,
  tableauDepuis,
  texteDeCellule,
  type Confiance,
  type Feuille,
  type LigneEcartee,
  type Tableau,
} from './import-tableur'

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

/** Les synonymes d'en-tête, en français et en anglais (ADR 0047), comparés sans accent ni casse. */
const SYNONYMES: [Champ, RegExp][] = [
  ['COURRIEL', /\b(e-?mail|courriel|mail|adresse electronique)\b/],
  ['TELEPHONE', /\b(tel|telephone|portable|mobile|gsm|phone)\b/],
  ['PRENOM', /\b(prenom|first ?name)\b/],
  [
    'NOM_COMPLET',
    /^(nom complet|nom et prenom|prenom et nom|participant|name|full name)$/,
  ],
  ['NOM', /\b(nom|last ?name|nom de famille|surname|family name)\b/],
  [
    'PRECISIONS',
    // En anglais, seules des formes explicites : « notes » ou « details » seuls
    // désignent aussi une adresse (« Billing details ») ou un régime (« Dietary notes »).
    /\b(disponibilites?|precisions?|commentaires?|remarques?|precise|availability|availabilities|additional (notes|details|information)|in writing|comments?|remarks?)\b/,
  ],
  [
    'VALEURS',
    /\b(prestations?|postes?|creneaux|missions?|services?|shifts?|positions?|slots?)\b/,
  ],
  [
    'DATE_ACCORD',
    /\b(date (de )?(la )?commande|date (de )?creation|date d'inscription|inscrit le|order date|registration date|registered on|signed up)\b/,
  ],
  ['REF_EXTERNE', /\b(billet|ticket|numero de billet|identifiant|id)\b/],
  [
    'REGROUPEMENT',
    // « Order » seul désignerait aussi « Order status » : seul le numéro regroupe.
    /\b(commande|transaction|numero de commande|order (number|no))\b|\border #/,
  ],
]

/** Les colonnes qui ne doivent jamais partir : elles restent ignorées. */
const SENSIBLES =
  /\b(genre|sexe|civilite|pronom|sante|allergie|handicap|paiement|montant|prix|moyen de paiement|tarif|iban|carte|gender|sex|pronouns?|health|medical|allerg(y|ies)|disability|payment|amount|price|fee|card)\b/

export type Colonne = ColonneDetectee<Champ>

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HORAIRE =
  /(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:-|–|à|a|to|\/)\s*(\d{1,2})\s*(?:h|:)?\s*(\d{2})?/i

/** Propose un champ pour chaque colonne, par son en-tête puis par son contenu. */
export function detecterColonnes(tableau: Tableau): Colonne[] {
  return detecterColonnesSelon<Champ>(
    tableau,
    {
      ignorer: 'IGNORER',
      synonymes: SYNONYMES,
      sensibles: SENSIBLES,
      // Un en-tête qui porte un horaire désigne une colonne par poste ou par
      // créneau : « Service au bar - 18h - 19h ».
      parEntete: entete => (HORAIRE.test(entete) ? 'CHOIX' : null),
      parContenu: valeurs => [
        ['COURRIEL', part(valeurs, v => COURRIEL.test(v))],
        // Neuf chiffres au moins : un numéro de billet ne passe pas pour un
        // téléphone.
        [
          'TELEPHONE',
          part(
            valeurs,
            v => v.replace(/\D/g, '').length >= 9 && /^[+0-9 ().-]+$/.test(v)
          ),
        ],
        ['VALEURS', part(valeurs, v => v.includes('\n') && HORAIRE.test(v))],
      ],
      uniques: UNIQUES,
    },
    sansAccent
  )
}

/** Vrai si les colonnes associées désignent au moins une personne. */
export function associationSuffisante(champs: readonly Champ[]): boolean {
  return champs.some(c =>
    ['PRENOM', 'NOM', 'NOM_COMPLET', 'COURRIEL', 'TELEPHONE'].includes(c)
  )
}

// ── Horaires ─────────────────────────────────────────────────────────────────

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

/** Les champs qu'une seule colonne peut recevoir. */
export function champUnique(champ: Champ): boolean {
  return UNIQUES.includes(champ)
}
