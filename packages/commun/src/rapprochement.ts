// Rapprochement des personnes (ADR 0042) : deux lignes d'un fichier, ou une
// personne et une fiche bénévole, désignent-elles la même personne ? Le serveur
// et l'espace organisateur appliquent les mêmes règles.
//
// - fort : la même adresse, sans casse ;
// - moyen : le même téléphone, ramené au format international ;
// - faible : le même nom, prénom et nom dans les deux ordres, ou un nom très
//   proche (deux lettres d'écart au plus, même initiale).

export type Niveau = 'FORT' | 'MOYEN' | 'FAIBLE'

export interface Identite {
  nom: string
  courriel?: string | null
  telephone?: string | null
}

/** Le texte sans accent, en minuscules, sans espace superflu. */
export function sansAccent(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** L'adresse comparable : sans casse ni espace ; null si vide. */
export function cleCourriel(
  courriel: string | null | undefined
): string | null {
  const cle = (courriel ?? '').trim().toLowerCase()
  return cle === '' ? null : cle
}

/**
 * Le téléphone comparable, au format international : « 06 12 34 56 78 » et
 * « +33 6 12 34 56 78 » donnent « +33612345678 ». Un numéro à dix chiffres qui
 * commence par 0 est tenu pour français. Null sous six chiffres.
 */
export function cleTelephone(
  telephone: string | null | undefined
): string | null {
  const brut = (telephone ?? '').trim()
  let chiffres = brut.replace(/[^0-9]/g, '')
  if (chiffres.length < 6) return null
  if (brut.startsWith('00')) chiffres = chiffres.slice(2)
  else if (!brut.startsWith('+') && /^0[1-9][0-9]{8}$/.test(chiffres)) {
    chiffres = `33${chiffres.slice(1)}`
  }
  return `+${chiffres}`
}

/**
 * Le nom comparable : sans accent ni casse, mots triés. « Martin Camille » et
 * « camille MARTIN » donnent la même clé.
 */
export function cleNom(nom: string): string {
  return sansAccent(nom)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ')
}

/**
 * Vrai pour un nom qui ne désigne personne : vide, un numéro de billet
 * (« #12345 ») ou des chiffres seulement.
 */
export function nomVide(nom: string | null | undefined): boolean {
  const texte = (nom ?? '').trim()
  return texte === '' || /^#?[0-9\s]+$/.test(texte)
}

/** La distance d'édition entre deux textes, bornée : au-delà de `max`, max + 1. */
export function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let precedente = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i += 1) {
    const ligne = [i]
    let minimum = i
    for (let j = 1; j <= b.length; j += 1) {
      const valeur = Math.min(
        precedente[j]! + 1,
        ligne[j - 1]! + 1,
        precedente[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      ligne.push(valeur)
      minimum = Math.min(minimum, valeur)
    }
    if (minimum > max) return max + 1
    precedente = ligne
  }
  return Math.min(precedente[b.length]!, max + 1)
}

/**
 * Vrai si deux noms sont très proches : les mêmes mots, avec deux lettres d'écart
 * au plus en tout, et la même initiale. Un mot de moins de six lettres ne tolère
 * qu'une lettre d'écart : « Lou » et « Léa » restent deux personnes.
 */
export function nomsProches(a: string, b: string): boolean {
  const x = cleNom(a)
  const y = cleNom(b)
  if (x === '' || y === '') return false
  if (x === y) return true
  if (x[0] !== y[0]) return false
  const motsX = x.split(' ')
  const motsY = y.split(' ')
  if (motsX.length !== motsY.length) return false
  let total = 0
  for (let i = 0; i < motsX.length; i += 1) {
    const motX = motsX[i] ?? ''
    const motY = motsY[i] ?? ''
    const ecart = distance(motX, motY)
    if (ecart > (Math.min(motX.length, motY.length) < 6 ? 1 : 2)) return false
    total += ecart
    if (total > 2) return false
  }
  return true
}

/** Le niveau de rapprochement de deux personnes, ou null. */
export function rapprocher(a: Identite, b: Identite): Niveau | null {
  const courrielA = cleCourriel(a.courriel)
  if (courrielA !== null && courrielA === cleCourriel(b.courriel)) {
    return 'FORT'
  }
  const telephoneA = cleTelephone(a.telephone)
  if (telephoneA !== null && telephoneA === cleTelephone(b.telephone)) {
    return 'MOYEN'
  }
  return nomsProches(a.nom, b.nom) ? 'FAIBLE' : null
}

const RANG: Record<Niveau, number> = { FORT: 0, MOYEN: 1, FAIBLE: 2 }

/** Le plus fort de deux niveaux. */
export function plusFort(a: Niveau | null, b: Niveau | null): Niveau | null {
  if (a === null) return b
  if (b === null) return a
  return RANG[a] <= RANG[b] ? a : b
}

/**
 * Les lignes d'un fichier réunies par personne : deux lignes vont ensemble quand
 * elles ont la même adresse, le même téléphone ou le même nom. Les groupes
 * gardent l'ordre de leur première ligne.
 */
export function regrouper<T extends Identite>(lignes: readonly T[]): T[][] {
  const parent = lignes.map((_, i) => i)
  const racine = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!
      i = parent[i]!
    }
    return i
  }
  const vues = new Map<string, number>()
  lignes.forEach((ligne, i) => {
    const cles = [
      cleCourriel(ligne.courriel),
      cleTelephone(ligne.telephone),
      nomVide(ligne.nom) ? null : `nom:${cleNom(ligne.nom)}`,
    ]
    for (const cle of cles) {
      if (cle === null || cle === 'nom:') continue
      const deja = vues.get(cle)
      if (deja === undefined) vues.set(cle, i)
      else parent[racine(i)] = racine(deja)
    }
  })
  const groupes = new Map<number, T[]>()
  lignes.forEach((ligne, i) => {
    const r = racine(i)
    const groupe = groupes.get(r) ?? []
    groupe.push(ligne)
    groupes.set(r, groupe)
  })
  return [...groupes.values()]
}

/**
 * Les paires de personnes d'une liste qui se rapprochent, sans comparer toutes
 * les paires : les candidates partagent une adresse, un téléphone, ou l'initiale
 * de leur nom.
 */
export function pairesRapprochees<T extends Identite>(
  personnes: readonly T[]
): { a: T; b: T; niveau: Niveau }[] {
  const seaux = new Map<string, number[]>()
  const ajouter = (cle: string | null, i: number) => {
    if (cle === null) return
    const seau = seaux.get(cle) ?? []
    seau.push(i)
    seaux.set(cle, seau)
  }
  personnes.forEach((p, i) => {
    ajouter(cleCourriel(p.courriel), i)
    ajouter(cleTelephone(p.telephone), i)
    const nom = cleNom(p.nom)
    if (nom !== '') ajouter(`initiale:${nom[0]}`, i)
  })
  const vues = new Set<string>()
  const paires: { a: T; b: T; niveau: Niveau }[] = []
  for (const seau of seaux.values()) {
    for (let x = 0; x < seau.length; x += 1) {
      for (let y = x + 1; y < seau.length; y += 1) {
        const i = Math.min(seau[x]!, seau[y]!)
        const j = Math.max(seau[x]!, seau[y]!)
        const cle = `${i}:${j}`
        if (vues.has(cle)) continue
        vues.add(cle)
        const niveau = rapprocher(personnes[i]!, personnes[j]!)
        if (niveau !== null) {
          paires.push({ a: personnes[i]!, b: personnes[j]!, niveau })
        }
      }
    }
  }
  return paires.sort((p, q) => RANG[p.niveau] - RANG[q.niveau])
}

/**
 * Un index des fiches pour chercher, pour une personne, la fiche la plus proche :
 * par adresse, par téléphone, puis par nom parmi les fiches de même initiale.
 */
export function indexerFiches<T extends Identite>(
  fiches: readonly T[]
): (personne: Identite) => { fiche: T; niveau: Niveau } | null {
  const parCourriel = new Map<string, T>()
  const parTelephone = new Map<string, T>()
  const parInitiale = new Map<string, T[]>()
  for (const fiche of fiches) {
    const courriel = cleCourriel(fiche.courriel)
    if (courriel !== null && !parCourriel.has(courriel)) {
      parCourriel.set(courriel, fiche)
    }
    const telephone = cleTelephone(fiche.telephone)
    if (telephone !== null && !parTelephone.has(telephone)) {
      parTelephone.set(telephone, fiche)
    }
    const nom = cleNom(fiche.nom)
    if (nom !== '') {
      const seau = parInitiale.get(nom[0]!) ?? []
      seau.push(fiche)
      parInitiale.set(nom[0]!, seau)
    }
  }
  return personne => {
    const courriel = cleCourriel(personne.courriel)
    const parAdresse = courriel === null ? undefined : parCourriel.get(courriel)
    if (parAdresse) return { fiche: parAdresse, niveau: 'FORT' }
    const telephone = cleTelephone(personne.telephone)
    const parNumero =
      telephone === null ? undefined : parTelephone.get(telephone)
    if (parNumero) return { fiche: parNumero, niveau: 'MOYEN' }
    const nom = cleNom(personne.nom)
    if (nom === '') return null
    const proche = (parInitiale.get(nom[0]!) ?? []).find(f =>
      nomsProches(f.nom, personne.nom)
    )
    return proche ? { fiche: proche, niveau: 'FAIBLE' } : null
  }
}
