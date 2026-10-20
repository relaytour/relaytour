import type {
  ElementEspace,
  Emplacement,
  EspaceFichiers,
  Position,
} from './types.ts'

// Un espace de fichiers en mémoire, pour les tests (ADR 0038). Il adresse les
// éléments comme Microsoft Graph : une base connue par son identifiant, puis un
// chemin de noms.

export interface NoeudMemoire {
  id: string
  nom: string
  /** Absent pour un dossier. */
  contenu?: string
  enfants?: NoeudMemoire[]
  /** Numéro de version, qui change à chaque écriture. */
  version?: number
}

export interface EmplacementMemoire extends Emplacement {
  racine: NoeudMemoire
}

function chercher(noeud: NoeudMemoire, id: string): NoeudMemoire | null {
  if (noeud.id === id) return noeud
  for (const enfant of noeud.enfants ?? []) {
    const trouve = chercher(enfant, id)
    if (trouve !== null) return trouve
  }
  return null
}

/** Le chemin de nœuds de la racine jusqu'au nœud cherché, ou null. */
function parcours(noeud: NoeudMemoire, id: string): NoeudMemoire[] | null {
  if (noeud.id === id) return [noeud]
  for (const enfant of noeud.enfants ?? []) {
    const suite = parcours(enfant, id)
    if (suite !== null) return [noeud, ...suite]
  }
  return null
}

function versElement(n: NoeudMemoire): ElementEspace {
  return {
    id: n.id,
    nom: n.nom,
    dossier: n.contenu === undefined,
    taille: n.contenu === undefined ? null : Buffer.byteLength(n.contenu),
    modifieLe: new Date('2026-10-01T08:00:00Z'),
    typeMime: null,
    lienWeb: `https://exemple.invalid/${n.id}`,
    etag: `"${n.id}:${n.version ?? 1}"`,
  }
}

export function espaceEnMemoire(
  emplacements: EmplacementMemoire[]
): EspaceFichiers {
  const trouver = (p: Position): NoeudMemoire | null => {
    const emplacement = emplacements.find(e => e.id === p.emplacement)
    if (emplacement === undefined) return null
    let noeud =
      p.base === null
        ? emplacement.racine
        : chercher(emplacement.racine, p.base)
    for (const nom of p.chemin) {
      noeud = noeud?.enfants?.find(e => e.nom === nom) ?? null
    }
    return noeud
  }
  return {
    fournisseur: 'SHAREPOINT',
    convertitEnPdf: nom => nom.endsWith('.docx'),
    emplacements: () =>
      Promise.resolve(
        emplacements.map(({ id, nom, site }) => ({ id, nom, site }))
      ),
    element: p => {
      const noeud = trouver(p)
      return Promise.resolve(noeud === null ? null : versElement(noeud))
    },
    ancetres: (emplacement, element) => {
      const racine = emplacements.find(e => e.id === emplacement)?.racine
      const chemin = racine === undefined ? null : parcours(racine, element)
      return Promise.resolve(
        chemin === null
          ? null
          : chemin.reverse().map(n => ({ id: n.id, nom: n.nom }))
      )
    },
    lister: p => {
      const noeud = trouver(p)
      return Promise.resolve(
        noeud === null || noeud.contenu !== undefined
          ? null
          : { elements: (noeud.enfants ?? []).map(versElement), complet: true }
      )
    },
    creerDossier: (parent, nom, { renommer }) => {
      const dossier = trouver(parent)
      if (dossier === null || dossier.contenu !== undefined)
        return Promise.reject(new Error('Dossier introuvable.'))
      dossier.enfants ??= []
      const pris = new Set(dossier.enfants.map(e => e.nom))
      if (pris.has(nom) && !renommer) {
        return Promise.resolve(
          versElement(dossier.enfants.find(e => e.nom === nom)!)
        )
      }
      let libre = nom
      for (let n = 1; pris.has(libre); n++) libre = `${nom} ${n}`
      const cree: NoeudMemoire = {
        id: `${dossier.id}/${libre}`,
        nom: libre,
        enfants: [],
      }
      dossier.enfants.push(cree)
      return Promise.resolve(versElement(cree))
    },
    ecrire: (p, texte) => {
      const nom = p.chemin[p.chemin.length - 1]
      const dossier = trouver({ ...p, chemin: p.chemin.slice(0, -1) })
      if (
        nom === undefined ||
        dossier === null ||
        dossier.contenu !== undefined
      )
        return Promise.reject(new Error('Dossier parent introuvable.'))
      dossier.enfants ??= []
      let fichier = dossier.enfants.find(e => e.nom === nom)
      if (fichier === undefined) {
        fichier = { id: `${dossier.id}/${nom}`, nom, contenu: texte }
        dossier.enfants.push(fichier)
      } else {
        fichier.contenu = texte
        fichier.version = (fichier.version ?? 1) + 1
      }
      return Promise.resolve({ etag: versElement(fichier).etag })
    },
    supprimer: p => {
      const nom = p.chemin[p.chemin.length - 1]
      const dossier = trouver({ ...p, chemin: p.chemin.slice(0, -1) })
      if (nom !== undefined && dossier?.enfants !== undefined) {
        dossier.enfants = dossier.enfants.filter(e => e.nom !== nom)
      }
      return Promise.resolve()
    },
    ouvrir: (p, { pdf }) => {
      const noeud = trouver(p)
      if (noeud?.contenu === undefined)
        return Promise.reject(new Error('Fichier introuvable.'))
      const octets = new TextEncoder().encode(
        pdf ? `%PDF converti : ${noeud.contenu}` : noeud.contenu
      )
      return Promise.resolve({
        flux: new Blob([octets]).stream(),
        taille: octets.length,
      })
    },
  }
}
