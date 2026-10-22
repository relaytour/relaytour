// Espace de fichiers d'une organisation (ADR 0038) : ce que chaque fournisseur
// sait faire. Relaytour lit l'espace ; il n'y écrit que l'export des fiches. Un
// annuaire facultatif lit les comptes et les droits (ADR 0044).

/** Fournisseurs connus du schéma. Un fournisseur s'ouvre par ses variables. */
export type Fournisseur =
  'SHAREPOINT' | 'GOOGLE_DRIVE' | 'DROPBOX' | 'NEXTCLOUD'

/**
 * Ce que la connexion permet en plus des fichiers (ADR 0044) : lire l'annuaire et
 * les droits, puis appliquer des propositions d'accès.
 */
export type Portee = 'FICHIERS' | 'ANNUAIRE' | 'GESTION'

/** Jeton d'accès du fournisseur ; `forcer` le renouvelle. */
export type Jeton = (forcer?: boolean) => Promise<string>

/**
 * Un élément désigné depuis une base : la racine d'un emplacement (base nulle) ou
 * un dossier connu par son identifiant, puis un chemin de noms. Le chemin part de
 * la base et n'en sort jamais (`validerChemin`).
 */
export interface Position {
  emplacement: string
  base: string | null
  chemin: string[]
}

/** Une bibliothèque de documents : le OneDrive du compte, ou celle d'un site. */
export interface Emplacement {
  id: string
  nom: string
  site: string | null
}

export interface ElementEspace {
  id: string
  nom: string
  dossier: boolean
  taille: number | null
  modifieLe: Date | null
  typeMime: string | null
  /** Adresse du fichier chez le fournisseur, pour une personne qui y a un compte. */
  lienWeb: string | null
  /** Étiquette de version : elle change à chaque modification du fichier. */
  etag: string | null
}

/** Le contenu d'un dossier. `complet` est faux quand la liste a été coupée. */
export interface ListeElements {
  elements: ElementEspace[]
  complet: boolean
}

export interface ContenuFichier {
  flux: ReadableStream<Uint8Array>
  taille: number | null
  /**
   * Nom sous lequel servir le contenu, quand il diffère du nom de l'élément :
   * un document natif exporté gagne l'extension de son format.
   */
  nom?: string
}

// ── Annuaire et droits (ADR 0044) ─────────────────────────────────────────────

/** Un compte de l'annuaire du fournisseur. */
export interface CompteAnnuaire {
  identifiant: string
  /** Adresse principale du compte, en minuscules. */
  adresse: string
  nom: string
  /** Vrai pour un compte externe déjà accueilli (un invité). */
  invite: boolean
}

/** Qui reçoit un droit sur un élément. */
export type Beneficiaire =
  | {
      type: 'personne'
      identifiant: string | null
      adresse: string | null
      nom: string
    }
  | { type: 'groupe'; identifiant: string; nom: string }
  /**
   * Les comptes d'un domaine (`exemple.org`), ou, sans domaine, tous les comptes
   * de l'organisation du fournisseur, invités exclus.
   */
  | { type: 'domaine'; nom: string; domaine?: string }
  /** Un lien de partage : il ne nomme personne. */
  | { type: 'lien'; nom: string }

export interface DroitElement {
  /** Identifiant du droit chez le fournisseur. */
  identifiant: string
  beneficiaire: Beneficiaire
  role: 'LECTURE' | 'ECRITURE'
  /** Vrai quand le droit vient d'un dossier parent ou du site. */
  herite: boolean
}

/** Ce que l'annuaire d'un fournisseur sait faire. */
export interface CapacitesAnnuaire {
  /**
   * Chercher un compte par adresse. Sans annuaire, Relaytour compare les
   * adresses des droits à celles des personnes.
   */
  comptes: boolean
  droits: boolean
  membresDeGroupe: boolean
  /** Partager un élément avec une personne, et retirer ce partage. */
  partage: boolean
  /** Faire entrer une personne dans un groupe, et l'en retirer. */
  gestionDeGroupe: boolean
}

/**
 * L'annuaire du fournisseur, lu pour vérifier les accès (ADR 0044). Relaytour y
 * cherche des adresses précises et ne liste jamais tout l'annuaire.
 */
export interface AnnuaireFournisseur {
  readonly capacites: CapacitesAnnuaire
  /** Le compte de chaque adresse, ou null quand l'annuaire ne la connaît pas. */
  chercherComptes(
    adresses: readonly string[]
  ): Promise<Map<string, CompteAnnuaire | null>>
  /**
   * Les droits de l'élément à cette position, hérités compris. Null quand ils ne
   * se lisent pas en entier (refus, élément absent, liste coupée) : Relaytour ne
   * conclut alors à aucune absence de droit.
   */
  droits(position: Position): Promise<DroitElement[] | null>
  /** Les membres d'un groupe, sous-groupes compris, ou null s'ils ne se lisent pas. */
  membresDuGroupe(identifiant: string): Promise<CompteAnnuaire[] | null>
  /**
   * Faux pour un groupe que Relaytour ne doit jamais modifier : un groupe de site
   * SharePoint, le groupe des admins d'un Nextcloud. Absent : tout groupe lu.
   */
  groupeGerable?(identifiant: string): boolean

  // Écriture : les propositions qu'un admin applique (ADR 0044). Absentes quand
  // la connexion ne permet pas la gestion des accès.

  /**
   * Partage l'élément avec une personne, par son adresse. Rend l'identifiant du
   * droit créé.
   */
  partager?(
    position: Position,
    personne: { adresse: string; identifiant?: string | null },
    options: { role: 'LECTURE' | 'ECRITURE'; invitation: boolean }
  ): Promise<{ identifiant: string }>
  /** Retire un droit de l'élément. Un droit absent ne lève pas. */
  retirerPartage?(position: Position, identifiant: string): Promise<void>
  /** Fait entrer un compte dans un groupe. Un membre déjà présent ne lève pas. */
  ajouterAuGroupe?(groupe: string, compte: string): Promise<void>
  /** Retire un compte d'un groupe. Un compte absent ne lève pas. */
  retirerDuGroupe?(groupe: string, compte: string): Promise<void>
}

export interface EspaceFichiers {
  readonly fournisseur: Fournisseur
  /**
   * L'annuaire du fournisseur, quand la connexion permet de le lire (ADR 0044).
   * Absent sinon.
   */
  readonly annuaire?: AnnuaireFournisseur
  /**
   * Vrai quand le fournisseur sait rendre ce document en PDF. Le type compte
   * pour un document natif du fournisseur, qui n'a pas d'extension (Google).
   */
  convertitEnPdf(nom: string, typeMime?: string | null): boolean
  emplacements(): Promise<Emplacement[]>
  /**
   * L'élément désigné par son identifiant, puis ses dossiers parents jusqu'à la
   * racine de la bibliothèque. Null si l'élément n'existe pas.
   */
  ancetres(
    emplacement: string,
    element: string
  ): Promise<{ id: string; nom: string }[] | null>
  /** L'élément à cette position, ou null s'il n'existe pas. */
  element(position: Position): Promise<ElementEspace | null>
  /**
   * Les éléments du dossier à cette position, coupés au-delà d'une borne de coût.
   * Null si le dossier n'existe pas.
   */
  lister(position: Position): Promise<ListeElements | null>
  /** Le contenu du fichier, tel quel ou converti en PDF. */
  ouvrir(position: Position, options: { pdf: boolean }): Promise<ContenuFichier>
  /**
   * Le Markdown d'un document natif du fournisseur (un document Google), pour
   * l'import des fiches. Absent chez un fournisseur sans document natif.
   */
  lireMarkdown?(position: Position): Promise<string>

  // Écriture : l'export des fiches seulement (ADR 0038).

  /**
   * Crée un dossier dans le dossier à cette position. Avec `renommer`, un nom
   * déjà pris reçoit un suffixe ; sinon le dossier existant est rendu.
   */
  creerDossier(
    parent: Position,
    nom: string,
    options: { renommer: boolean }
  ): Promise<ElementEspace>
  /** Écrit un fichier texte à cette position, en remplaçant le fichier existant. */
  ecrire(position: Position, texte: string): Promise<{ etag: string | null }>
  /** Supprime l'élément à cette position. Un élément absent ne lève pas. */
  supprimer(position: Position): Promise<void>
}

/** Le fournisseur refuse le jeton : un admin doit reconnecter l'espace. */
export class AccesRetire extends Error {}

/** Le fournisseur ne répond pas, ou répond une erreur inattendue. */
export class FournisseurIndisponible extends Error {}
