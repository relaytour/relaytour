import type {
  AnnuaireFournisseur,
  CompteAnnuaire,
  DroitElement,
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
  /** Absent pour un dossier. Un document binaire (Word) se donne en octets. */
  contenu?: string | Uint8Array
  enfants?: NoeudMemoire[]
  /** Numéro de version, qui change à chaque écriture. */
  version?: number
}

export interface EmplacementMemoire extends Emplacement {
  racine: NoeudMemoire
  /**
   * Vrai pour une vue comme « Partagés avec moi » : elle montre des éléments
   * rangés dans un autre emplacement, sous le même identifiant.
   */
  vue?: boolean
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

/** L'annuaire d'un espace en mémoire (ADR 0044). */
export interface AnnuaireMemoire {
  comptes: CompteAnnuaire[]
  /** Les droits de chaque élément, par son identifiant. */
  droits: Record<string, DroitElement[]>
  /** Les membres de chaque groupe par identifiant de compte ; null : illisible. */
  groupes: Record<string, string[] | null>
}

export function annuaireEnMemoire(
  donnees: AnnuaireMemoire
): AnnuaireFournisseur {
  let suivant = 0
  return {
    capacites: {
      comptes: true,
      droits: true,
      membresDeGroupe: true,
      partage: true,
      gestionDeGroupe: true,
    },
    partager(position, personne, options) {
      const compte = donnees.comptes.find(
        c => c.adresse === personne.adresse.toLowerCase()
      )
      const identifiant = `partage-${++suivant}`
      const droits = (donnees.droits[position.base ?? ''] ??= [])
      droits.push({
        identifiant,
        beneficiaire: {
          type: 'personne',
          identifiant: compte?.identifiant ?? null,
          adresse: personne.adresse.toLowerCase(),
          nom: compte?.nom ?? personne.adresse,
        },
        role: options.role,
        herite: false,
      })
      return Promise.resolve({ identifiant })
    },
    retirerPartage(position, identifiant) {
      const droits = donnees.droits[position.base ?? '']
      if (droits !== undefined) {
        donnees.droits[position.base ?? ''] = droits.filter(
          d => d.identifiant !== identifiant
        )
      }
      return Promise.resolve()
    },
    ajouterAuGroupe(groupe, compte) {
      const membres = donnees.groupes[groupe]
      if (
        membres !== null &&
        membres !== undefined &&
        !membres.includes(compte)
      ) {
        membres.push(compte)
      }
      return Promise.resolve()
    },
    retirerDuGroupe(groupe, compte) {
      const membres = donnees.groupes[groupe]
      if (membres !== null && membres !== undefined) {
        donnees.groupes[groupe] = membres.filter(m => m !== compte)
      }
      return Promise.resolve()
    },
    chercherComptes(adresses) {
      return Promise.resolve(
        new Map(
          adresses.map(a => [
            a,
            donnees.comptes.find(c => c.adresse === a.toLowerCase()) ?? null,
          ])
        )
      )
    },
    droits(position) {
      const id = position.base ?? ''
      return Promise.resolve(donnees.droits[id] ?? [])
    },
    membresDuGroupe(identifiant) {
      const membres = donnees.groupes[identifiant]
      if (membres === null || membres === undefined)
        return Promise.resolve(null)
      return Promise.resolve(
        donnees.comptes.filter(c => membres.includes(c.identifiant))
      )
    },
  }
}

export function espaceEnMemoire(
  emplacements: EmplacementMemoire[],
  annuaire?: AnnuaireFournisseur
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
    ...(annuaire === undefined ? {} : { annuaire }),
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
      const cible = emplacements.find(e => e.id === emplacement)
      if (cible === undefined) return Promise.resolve(null)
      // Depuis une vue, les parents sont ceux de l'emplacement réel, comme chez
      // Google : la vue ne coiffe la chaîne que faute de mieux.
      const ordre =
        cible.vue === true
          ? [...emplacements.filter(e => e !== cible), cible]
          : [cible]
      for (const e of ordre) {
        const chemin = parcours(e.racine, element)
        if (chemin !== null) {
          return Promise.resolve(
            chemin.reverse().map(n => ({ id: n.id, nom: n.nom }))
          )
        }
      }
      return Promise.resolve(null)
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
      const contenu = noeud.contenu
      const octets =
        typeof contenu === 'string'
          ? new TextEncoder().encode(
              pdf ? `%PDF converti : ${contenu}` : contenu
            )
          : contenu
      return Promise.resolve({
        flux: new Blob([octets]).stream(),
        taille: octets.length,
      })
    },
  }
}
