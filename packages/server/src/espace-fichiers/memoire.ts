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

function versElement(n: NoeudMemoire): ElementEspace {
  return {
    id: n.id,
    nom: n.nom,
    dossier: n.contenu === undefined,
    taille: n.contenu === undefined ? null : Buffer.byteLength(n.contenu),
    modifieLe: new Date('2026-10-01T08:00:00Z'),
    typeMime: null,
    lienWeb: `https://exemple.invalid/${n.id}`,
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
    lister: p => {
      const noeud = trouver(p)
      return Promise.resolve(
        noeud === null || noeud.contenu !== undefined
          ? null
          : (noeud.enfants ?? []).map(versElement)
      )
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
