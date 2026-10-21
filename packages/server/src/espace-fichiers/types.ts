// Espace de fichiers d'une organisation (ADR 0038) : ce que chaque fournisseur
// sait faire. Relaytour lit l'espace ; il n'y écrit que l'export des fiches.

/** Fournisseurs connus du schéma. Un fournisseur s'ouvre par ses variables. */
export type Fournisseur =
  'SHAREPOINT' | 'GOOGLE_DRIVE' | 'DROPBOX' | 'NEXTCLOUD'

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

export interface EspaceFichiers {
  readonly fournisseur: Fournisseur
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
