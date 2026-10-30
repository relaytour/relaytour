/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type AccesActivite =
  | 'COMPLET'
  | 'DECOUVERTE';

/** Comment Relaytour propose les accès d’un dossier lié chez le fournisseur : rien, un partage du dossier, ou l’entrée dans un groupe (ADR 0044). */
export type AccesFournisseurDossier =
  | 'AUCUN'
  | 'GROUPE'
  | 'PARTAGE';

export type AccesPerimetre =
  | 'AUCUN'
  | 'COMPLET'
  | 'CONSULTATION';

/** Accord du périmètre cible sur une déclinaison. EN_ATTENTE : la déclinaison est proposée et ne compte pas encore parmi les tâches du périmètre. */
export type AccordDeclinaison =
  | 'ACCEPTE'
  | 'EN_ATTENTE'
  | 'REFUSE';

export type ActionProposition =
  | 'AJOUTER'
  | 'RETIRER';

/** TOTALE : une plage couvre toute la séquence. PARTIELLE : une plage en couvre une partie. AUCUNE : aucune plage ne la touche. */
export type Adequation =
  | 'AUCUNE'
  | 'PARTIELLE'
  | 'TOTALE';

/** Adresses personnelles que l’organigramme d’une activité peut afficher, avec l’accord de chaque personne (ADR 0036). */
export type AdressesOrganigramme =
  | 'AUCUNE'
  | 'CONTACTS'
  | 'REFERENTS';

/** Les personnes qu’un dossier lié attend chez le fournisseur : tous les membres de la période, ou les contacts principaux seulement (ADR 0044). */
export type AttendusDossier =
  | 'CONTACTS_PRINCIPAUX'
  | 'MEMBRES';

/** Le champ de la messagerie qui reçoit les destinataires : « À » pour une seule personne, « Cc » (adresses visibles) ou « Cci » (adresses cachées). */
export type ChampDestinataires =
  | 'A'
  | 'CC'
  | 'CCI';

export type ChoixSondage =
  | 'NON'
  | 'OUI'
  | 'SI_BESOIN';

/** Les personnes convoquées : tout le périmètre, toute l’équipe de l’activité, ou des personnes choisies dans l’équipe. */
export type CibleConvocation =
  | 'CHOIX'
  | 'EQUIPE'
  | 'PERIMETRE';

/** La fiche dont une valeur est gardée. */
export type CoteFusion =
  | 'AUTRE'
  | 'GARDEE';

export type CreneauSondageInput = {
  /** HH:MM, ou rien. */
  heureDebut?: string | null | undefined;
  /** HH:MM, ou rien. */
  heureFin?: string | null | undefined;
  /** Un créneau existant, pour une modification. */
  id?: string | number | null | undefined;
  jour: string;
};

/** Les périmètres où décliner une tâche partagée. Un texte ou une échéance absents reprennent ceux de la tâche partagée. */
export type DeclinaisonInput = {
  description?: string | null | undefined;
  echeance?: string | null | undefined;
  perimetreIds: Array<string | number>;
  titre?: string | null | undefined;
};

/** Étape de l’accord d’une déclinaison. IMPOSEE : un admin de l’activité l’a ajoutée sans accord du périmètre. */
export type EtapeAccord =
  | 'ACCEPTEE'
  | 'IMPOSEE'
  | 'PROPOSEE'
  | 'REFUSEE';

export type EtapePremiersPas =
  | 'ACTIVITE'
  | 'CONTACT'
  | 'EQUIPE'
  | 'PERIMETRES'
  | 'PERIODE'
  | 'TACHES';

/** A_ACCES : un droit couvre la personne. SANS_COMPTE : l’annuaire du fournisseur ne la connaît pas. SANS_ACCES : aucun droit ne la couvre. INCONNU : un groupe illisible la couvre peut-être. EN_TROP : un compte a un droit sans être attendu. */
export type EtatAccesFournisseur =
  | 'A_ACCES'
  | 'EN_TROP'
  | 'INCONNU'
  | 'SANS_ACCES'
  | 'SANS_COMPTE';

export type EtatAppel =
  | 'A_VENIR'
  | 'FERME'
  | 'OUVERT';

export type EtatCompteFournisseur =
  | 'ABSENT'
  | 'INVITE'
  | 'TROUVE';

export type EtatConnexionFichiers =
  | 'ACTIVE'
  | 'A_RECONNECTER';

export type EtatLigneImport =
  | 'A_IMPORTER'
  | 'DEJA_IMPORTEE'
  | 'ECARTEE'
  | 'IMPORTEE';

/** CONFIRMEE : la place est tenue. A_CONFIRMER : la personne n’a pas encore confirmé. NON_CONFIRMEE : toujours à confirmer sept jours après sa création, ou la veille de la séquence (ADR 0041). */
export type EtatPlace =
  | 'A_CONFIRMER'
  | 'CONFIRMEE'
  | 'NON_CONFIRMEE';

export type EtatPostes =
  | 'COMPLET'
  | 'INCOMPLET'
  | 'SANS_PERSONNE';

export type EtatProposition =
  | 'APPLIQUEE'
  | 'ECARTEE'
  | 'ECHEC'
  | 'EN_ATTENTE'
  | 'EN_COURS';

export type EtatReconduction =
  | 'A_CREER'
  | 'DEJA_PRESENTE'
  | 'ECARTEE';

/** Ce que la liseuse affiche : un PDF, une image, un texte, du Markdown, un document bureautique converti en PDF par le fournisseur, ou rien (téléchargement). */
export type FormatApercu =
  | 'AUCUN'
  | 'IMAGE'
  | 'MARKDOWN'
  | 'PDF'
  | 'PDF_CONVERTI'
  | 'TEXTE';

export type FormatMedia =
  | 'PNG'
  | 'SVG';

export type FormulaireInput = {
  introduction?: string | null | undefined;
  paliers?: Array<string> | null | undefined;
  question?: string | null | undefined;
};

export type FournisseurFichiers =
  | 'DROPBOX'
  | 'GOOGLE_DRIVE'
  | 'NEXTCLOUD'
  | 'SHAREPOINT';

export type FrequenceResume =
  | 'AUCUN'
  | 'HEBDOMADAIRE'
  | 'QUOTIDIEN';

export type GroupePerimetresInput = {
  cle: string;
  libelle: string;
  libellePluriel: string;
};

/** Les lecteurs d’un dossier lié : toute l’activité, ou une liste de périmètres et de groupes de l’activité. */
export type LecteursDossierInput = {
  groupes: Array<string>;
  perimetreIds: Array<string | number>;
  touteActivite: boolean;
};

export type LigneEquipeImport = {
  adresse: string;
  contactPrincipal: boolean;
  ligne: number;
  nom: string;
  /** Les noms ou les identifiants des périmètres. */
  perimetres: Array<string>;
};

export type LigneTacheImport = {
  description?: string | null | undefined;
  /** Une date AAAA-MM-JJ, ou un décalage depuis le premier jour : J-30, J+3. */
  echeance?: string | null | undefined;
  /** Le titre ou l’identifiant d’une fiche. */
  fiche?: string | null | undefined;
  ligne: number;
  perimetre: string;
  /** L’adresse d’une personne affectée au périmètre. */
  responsable?: string | null | undefined;
  titre: string;
};

export type MessageInput = {
  /** L’activité du message. Sans elle, le message vient de l’annuaire : seul un admin de l’organisation l’écrit. */
  activiteId?: string | number | null | undefined;
  champ: ChampDestinataires;
  corps: string;
  destinataireIds: Array<string | number>;
  editionId?: string | number | null | undefined;
  /** Parmi les destinataires d’un message en copie cachée, les personnes placées en copie visible. */
  enCopieIds?: Array<string | number> | null | undefined;
  modele: string;
  objet: string;
  perimetreId?: string | number | null | undefined;
};

export type MethodeConnexionFichiers =
  | 'COMPTE'
  | 'COMPTE_SERVICE';

/** A_REPARTIR : chaque personne devient une candidature à traiter. PLACES_DIRECTES : chaque personne reçoit sa fiche et ses places. */
export type ModeImport =
  | 'A_REPARTIR'
  | 'PLACES_DIRECTES';

/** Écran facultatif d’une activité, avec ses données et ses envois (ADR 0052). */
export type ModuleActivite =
  | 'AGENDA'
  | 'BENEVOLES'
  | 'DOCUMENTS';

/** Fixe le libellé de la période : édition pour un événement, saison pour une section, mandat pour une instance. */
export type NatureActivite =
  | 'EVENEMENT'
  | 'MANDAT'
  | 'SAISON';

/** À quel titre la personne reçoit la notification (ADR 0033). Le niveau REFERENT reste dans la cloche ; les niveaux d’admin ont leur écran. */
export type NiveauNotification =
  | 'ADMIN_ACTIVITE'
  | 'ADMIN_ORGANISATION'
  | 'REFERENT';

/** FORT : même adresse. MOYEN : même téléphone. FAIBLE : même nom, ou nom très proche. */
export type NiveauRapprochement =
  | 'FAIBLE'
  | 'FORT'
  | 'MOYEN';

/** Chemin du partage d’une fiche vers un périmètre : sa liste « Concerne aussi », un groupe de cette liste, ou une déclinaison acceptée qui cite la fiche. */
export type OrigineConnexe =
  | 'DECLINAISON'
  | 'GROUPE'
  | 'LISTE';

export type OrigineDemande =
  | 'FORMULAIRE'
  | 'PROPOSITION';

/** Une personne du fichier, après l’association des colonnes et la réunion de ses lignes dans le navigateur. */
export type PersonneImportInput = {
  /** La date de l’accord lue dans le fichier. Sans valeur : la date de l’import. */
  accordLe?: string | null | undefined;
  /** La clé de la personne dans le rapport. */
  cle: string;
  courriel?: string | null | undefined;
  nom: string;
  /** Vrai : crée une fiche même quand une fiche a la même adresse. */
  nouvelleFiche?: boolean | null | undefined;
  plages?: Array<PlageDisponibiliteInput> | null | undefined;
  precisions?: string | null | undefined;
  /** La fiche que la personne rejoint. */
  rattachement?: string | number | null | undefined;
  /** L’identifiant de la ligne dans l’outil d’origine : rend l’import rejouable. */
  refExterne?: string | null | undefined;
  sequenceIds?: Array<string | number> | null | undefined;
  telephone?: string | null | undefined;
};

export type PhaseInput = {
  cle: string;
  jusquA?: string | null | undefined;
  libelle: string;
};

export type PlaceSequenceInput = {
  /** Ou une fiche bénévole de l’activité. */
  benevoleId?: string | number | null | undefined;
  /** Une personne de l’équipe. */
  personneId?: string | number | null | undefined;
  role: RolePlace;
};

export type PlageDisponibiliteInput = {
  heureDebut: string;
  heureFin: string;
  jour: string;
  /** Pour une plage qui passe minuit. Sans valeur : le jour. */
  jourFin?: string | null | undefined;
};

export type PorteeAppel =
  | 'PERIMETRE'
  | 'PERIODE'
  | 'SEQUENCE';

/** Ce que la connexion permet en plus des fichiers : lire l’annuaire et les droits, puis appliquer les propositions d’accès (ADR 0044). */
export type PorteeConnexionFichiers =
  | 'ANNUAIRE'
  | 'FICHIERS'
  | 'GESTION';

export type ReponseConvocation =
  | 'ABSENT'
  | 'PEUT_ETRE'
  | 'PRESENT';

export type ReponseSondageInput = {
  choix: ChoixSondage;
  creneauId: string | number;
};

export type RoleFournisseur =
  | 'ECRITURE'
  | 'LECTURE';

/** Le rôle le moins étendu qu’une note concerne. Une personne lit les notes de son rôle et des rôles moins étendus. */
export type RoleNoteDeVersion =
  | 'ADMIN_ACTIVITE'
  | 'ADMIN_ORGANISATION'
  | 'REFERENT';

export type RolePlace =
  | 'RENFORT'
  | 'RESPONSABLE';

export type SorteElementAgenda =
  /** Une date clé placée par un admin de l’activité. */
  | 'DATE_CLE'
  /** Le premier jour de la période. */
  | 'DEBUT_PERIODE'
  /** L’échéance d’une tâche. */
  | 'ECHEANCE'
  /** Le dernier jour de la période. */
  | 'FIN_PERIODE'
  /** Une phase de l’activité, de son premier à son dernier jour. */
  | 'PHASE';

export type SourceFiche =
  | 'APP'
  | 'DEPOT'
  | 'ESPACE_FICHIERS'
  | 'GIT';

/** Dossier source des fiches d’un périmètre, ou des fiches communes quand le périmètre est nul. */
export type SourceImportFiches = {
  chemin: Array<string>;
  emplacement: string;
  perimetreId?: string | number | null | undefined;
};

export type StatutCandidature =
  | 'EN_ATTENTE'
  | 'RETIREE'
  | 'TRAITEE';

export type StatutChoix =
  | 'ACCEPTE'
  | 'EN_ATTENTE'
  | 'LISTE_ATTENTE'
  | 'REFUSE';

export type StatutDemande =
  | 'ACCEPTEE'
  | 'EN_ATTENTE'
  | 'REFUSEE';

export type StatutEdition =
  | 'ARCHIVEE'
  | 'EN_COURS'
  | 'PREPARATION';

export type StatutMessage =
  | 'ANNULE'
  | 'ENVOYE'
  | 'EN_COURS';

export type StatutReunion =
  | 'ANNULEE'
  | 'PREVUE';

export type StatutSondage =
  | 'CLOS'
  | 'OUVERT';

export type StatutTache =
  | 'ABANDONNEE'
  | 'A_FAIRE'
  | 'EN_COURS'
  | 'FAITE';

/** Un événement du journal d’une tâche, repris dans son fil. STATUT : le champ `statut` porte le nouveau statut. */
export type TypeEvenementTache =
  | 'ASSIGNEE'
  | 'CREEE'
  | 'MODIFIEE'
  | 'RETIREE'
  | 'STATUT';

export type TypeNoteDeVersion =
  | 'CORRECTIF'
  | 'FONCTIONNALITE'
  | 'PERFORMANCE'
  | 'RUPTURE'
  | 'SECURITE';

export type TypeNotification =
  | 'ACCES_FOURNISSEUR_A_VALIDER'
  | 'ADMIN_ACTIVITE_NOMME'
  | 'ADMIN_ACTIVITE_RETIRE'
  | 'ADMIN_ORGANISATION_NOMME'
  | 'ADMIN_ORGANISATION_RETIRE'
  | 'AFFECTATION_AJOUTEE'
  | 'AFFECTATION_RETIREE'
  | 'BENEVOLE_RETIRE'
  | 'CANDIDATURE_RECUE'
  | 'DECLINAISON_ACCEPTEE'
  | 'DECLINAISON_PROPOSEE'
  | 'DECLINAISON_REFUSEE'
  | 'DEMANDE_ACCEPTEE'
  | 'DEMANDE_RECUE'
  | 'DEMANDE_REFUSEE'
  | 'ECHEANCE_PROCHE'
  | 'FICHE_CONNEXE'
  | 'FICHE_CREEE'
  | 'FICHE_MODIFIEE'
  | 'INVITATION_ACCEPTEE'
  | 'PERSONNE_ARCHIVEE'
  | 'PERSONNE_RETABLIE'
  | 'PLACE_MODIFIEE'
  | 'REUNION_ANNULEE'
  | 'REUNION_CONVOQUEE'
  | 'REUNION_MODIFIEE'
  | 'SONDAGE_OUVERT'
  | 'SOUHAIT_FORMULE'
  | 'TACHE_ASSIGNEE'
  | 'TACHE_COMMENTEE'
  | 'TACHE_CREEE'
  | 'TACHE_DESASSIGNEE'
  | 'TACHE_EN_RETARD'
  | 'TACHE_MODIFIEE'
  | 'TACHE_STATUT';

export type TypePerimetre =
  | 'POLE'
  | 'SPORT';

export type TypeRessource =
  | 'DOSSIER'
  | 'FICHIER';

export type PerimetresAbonnablesQueryVariables = Exact<{ [key: string]: never; }>;


export type PerimetresAbonnablesQuery = { perimetres: Array<{ id: string, nom: string, archive: boolean, acces: AccesPerimetre }> };

export type MonAbonnementAgendaQueryVariables = Exact<{ [key: string]: never; }>;


export type MonAbonnementAgendaQuery = { monAbonnementAgenda: { id: string, fin: string, perimetreIds: Array<string> | null, inclurePhases: boolean, inclureDatesCles: boolean, inclureReunions: boolean, inclureEcheances: boolean, creeLe: string, dernierAccesLe: string | null } | null };

export type CreerMonAbonnementAgendaMutationVariables = Exact<{
  perimetreIds?: Array<string | number> | string | number | null | undefined;
  inclurePhases?: boolean | null | undefined;
  inclureDatesCles?: boolean | null | undefined;
  inclureReunions?: boolean | null | undefined;
  inclureEcheances?: boolean | null | undefined;
}>;


export type CreerMonAbonnementAgendaMutation = { creerMonAbonnementAgenda: { adresse: string, abonnement: { id: string } } };

export type ReglerMonAbonnementAgendaMutationVariables = Exact<{
  perimetreIds?: Array<string | number> | string | number | null | undefined;
  inclurePhases: boolean;
  inclureDatesCles: boolean;
  inclureReunions: boolean;
  inclureEcheances: boolean;
}>;


export type ReglerMonAbonnementAgendaMutation = { reglerMonAbonnementAgenda: { id: string, perimetreIds: Array<string> | null, inclurePhases: boolean, inclureDatesCles: boolean, inclureReunions: boolean, inclureEcheances: boolean } };

export type RevoquerMonAbonnementAgendaMutationVariables = Exact<{ [key: string]: never; }>;


export type RevoquerMonAbonnementAgendaMutation = { revoquerMonAbonnementAgenda: boolean };

export type AbonnementAgendaActiviteQueryVariables = Exact<{
  activiteId: string | number;
}>;


export type AbonnementAgendaActiviteQuery = { abonnementAgendaActivite: { id: string, fin: string, inclurePhases: boolean, inclureDatesCles: boolean, inclureReunions: boolean, creeLe: string, dernierAccesLe: string | null } | null };

export type CreerAbonnementAgendaActiviteMutationVariables = Exact<{
  activiteId: string | number;
  inclurePhases?: boolean | null | undefined;
  inclureDatesCles?: boolean | null | undefined;
  inclureReunions?: boolean | null | undefined;
}>;


export type CreerAbonnementAgendaActiviteMutation = { creerAbonnementAgendaActivite: { adresse: string } };

export type ReglerAbonnementAgendaActiviteMutationVariables = Exact<{
  activiteId: string | number;
  inclurePhases: boolean;
  inclureDatesCles: boolean;
  inclureReunions: boolean;
}>;


export type ReglerAbonnementAgendaActiviteMutation = { reglerAbonnementAgendaActivite: { id: string, inclurePhases: boolean, inclureDatesCles: boolean, inclureReunions: boolean } };

export type RevoquerAbonnementAgendaActiviteMutationVariables = Exact<{
  activiteId: string | number;
}>;


export type RevoquerAbonnementAgendaActiviteMutation = { revoquerAbonnementAgendaActivite: boolean };

export type SequencesPourAppelQueryVariables = Exact<{
  editionId: string | number;
}>;


export type SequencesPourAppelQuery = { programme: Array<{ id: string, titre: string, jour: string, heureDebut: string, besoinBenevoles: number | null, perimetre: { id: string } | null }> };

export type CreerAppelBenevolesMutationVariables = Exact<{
  editionId: string | number;
  portee: PorteeAppel;
  perimetreId?: string | number | null | undefined;
  sequenceId?: string | number | null | undefined;
  nom: string;
  introduction?: string | null | undefined;
  ouvertLe: string;
  fermeLe: string;
}>;


export type CreerAppelBenevolesMutation = { creerAppelBenevoles: { adresse: string } };

export type ModifierAppelBenevolesMutationVariables = Exact<{
  id: string | number;
  nom: string;
  introduction?: string | null | undefined;
  ouvertLe: string;
  fermeLe: string;
  versionAttendue: number;
}>;


export type ModifierAppelBenevolesMutation = { modifierAppelBenevoles: { id: string } };

export type FermerAppelBenevolesMutationVariables = Exact<{
  id: string | number;
}>;


export type FermerAppelBenevolesMutation = { fermerAppelBenevoles: { id: string } };

export type RouvrirAppelBenevolesMutationVariables = Exact<{
  id: string | number;
}>;


export type RouvrirAppelBenevolesMutation = { rouvrirAppelBenevoles: { id: string } };

export type RenouvelerAdresseAppelBenevolesMutationVariables = Exact<{
  id: string | number;
}>;


export type RenouvelerAdresseAppelBenevolesMutation = { renouvelerAdresseAppelBenevoles: { adresse: string } };

export type AccepterChoixCandidatureMutationVariables = Exact<{
  id: string | number;
}>;


export type AccepterChoixCandidatureMutation = { accepterChoixCandidature: { id: string } };

export type RefuserChoixCandidatureMutationVariables = Exact<{
  id: string | number;
}>;


export type RefuserChoixCandidatureMutation = { refuserChoixCandidature: { id: string } };

export type RefuserCandidatureMutationVariables = Exact<{
  id: string | number;
}>;


export type RefuserCandidatureMutation = { refuserCandidature: { id: string } };

export type MonScoreQueryVariables = Exact<{
  editionId: string | number;
}>;


export type MonScoreQuery = { monScore: { points: number, tachesRealisees: number, tachesATemps: number, tachesCreees: number, fichesCreees: number, fichesModifiees: number }, baremeScore: { tacheRealisee: number, bonusATemps: number, tacheCreee: number, ficheCreee: number, ficheModifiee: number } };

export type MenuPerimetresQueryVariables = Exact<{ [key: string]: never; }>;


export type MenuPerimetresQuery = { moi: { id: string, affectations: Array<{ id: string, edition: { id: string, statut: StatutEdition }, perimetre: { id: string, slug: string, nom: string, couleur: string | null, archive: boolean, activite: { id: string } } }> } | null };

export type CreerDateCleMutationVariables = Exact<{
  editionId: string | number;
  titre: string;
  jour: string;
  jourFin?: string | null | undefined;
  description?: string | null | undefined;
}>;


export type CreerDateCleMutation = { creerDateCle: { id: string } };

export type ModifierDateCleMutationVariables = Exact<{
  id: string | number;
  titre: string;
  jour: string;
  jourFin?: string | null | undefined;
  description?: string | null | undefined;
  versionAttendue: number;
}>;


export type ModifierDateCleMutation = { modifierDateCle: { id: string } };

export type DemandesQueryVariables = Exact<{
  editionId: string | number;
  statut?: StatutDemande | null | undefined;
}>;


export type DemandesQuery = { demandes: Array<{ id: string, nom: string, adresse: string, origine: OrigineDemande, statut: StatutDemande, creeLe: string, dejaMembre: boolean, disponibilite: string | null, question: string | null, reponse: string | null, texte: string | null, traiteePar: { id: string, nom: string } | null, perimetres: Array<{ id: string, mot: string | null, perimetre: { id: string, nom: string, couleur: string | null }, proposePar: { id: string, nom: string } | null }> }> };

export type SouhaitsEnAttenteQueryVariables = Exact<{
  editionId: string | number;
}>;


export type SouhaitsEnAttenteQuery = { postesAPourvoir: Array<{ perimetre: { id: string }, souhaits: Array<{ id: string }> }> };

export type AccepterDemandeMutationVariables = Exact<{
  id: string | number;
  affecter: Array<string | number> | string | number;
}>;


export type AccepterDemandeMutation = { accepterDemande: { id: string, statut: StatutDemande } };

export type RefuserDemandeMutationVariables = Exact<{
  id: string | number;
}>;


export type RefuserDemandeMutation = { refuserDemande: { id: string, statut: StatutDemande } };

export type DecrireActiviteMutationVariables = Exact<{
  id: string | number;
  nom: string;
  sigle?: string | null | undefined;
  nature: NatureActivite;
  groupes: Array<GroupePerimetresInput> | GroupePerimetresInput;
  ordre: number;
  modules?: Array<ModuleActivite> | ModuleActivite | null | undefined;
}>;


export type DecrireActiviteMutation = { modifierActivite: { id: string } };

export type ConfirmerActiviteMutationVariables = Exact<{
  activiteId?: string | number | null | undefined;
}>;


export type ConfirmerActiviteMutation = { confirmerActivite: { masques: boolean } };

export type MasquerFicheConnexeMutationVariables = Exact<{
  ficheId: string | number;
  perimetreId: string | number;
}>;


export type MasquerFicheConnexeMutation = { masquerFicheConnexe: { id: string } };

export type AfficherFicheConnexeMutationVariables = Exact<{
  ficheId: string | number;
  perimetreId: string | number;
}>;


export type AfficherFicheConnexeMutation = { afficherFicheConnexe: { id: string } };

export type InviterDansLActiviteMutationVariables = Exact<{
  email: string;
  nom: string;
  activiteId?: string | number | null | undefined;
  editionId?: string | number | null | undefined;
  perimetresAffectes?: Array<string | number> | string | number | null | undefined;
}>;


export type InviterDansLActiviteMutation = { inviterPersonne: { enAttente: boolean } };

export type RelancerInvitationMutationVariables = Exact<{
  id: string | number;
}>;


export type RelancerInvitationMutation = { relancerInvitation: boolean };

export type RetirerInvitationMutationVariables = Exact<{
  id: string | number;
}>;


export type RetirerInvitationMutation = { retirerInvitation: boolean };

export type LienEspaceBenevoleMutationVariables = Exact<{
  benevoleId: string | number;
  nouveau?: boolean | null | undefined;
}>;


export type LienEspaceBenevoleMutation = { lienEspaceBenevole: string };

export type RenvoyerLienBenevoleMutationVariables = Exact<{
  benevoleId: string | number;
}>;


export type RenvoyerLienBenevoleMutation = { renvoyerLienBenevole: boolean };

export type LieuxTousQueryVariables = Exact<{
  activiteId: string | number;
}>;


export type LieuxTousQuery = { lieux: Array<{ id: string, nom: string, description: string | null, ordre: number, archive: boolean }> };

export type CreerLieuMutationVariables = Exact<{
  activiteId: string | number;
  nom: string;
  ordre?: number | null | undefined;
}>;


export type CreerLieuMutation = { creerLieu: { id: string } };

export type ModifierLieuMutationVariables = Exact<{
  id: string | number;
  nom: string;
  description?: string | null | undefined;
  ordre: number;
  archive: boolean;
}>;


export type ModifierLieuMutation = { modifierLieu: { id: string, nom: string, ordre: number, archive: boolean } };

export type AfficherPremiersPasMutationVariables = Exact<{ [key: string]: never; }>;


export type AfficherPremiersPasMutation = { afficherPremiersPas: { masques: boolean } };

export type AccepterInvitationMutationVariables = Exact<{
  id: string | number;
}>;


export type AccepterInvitationMutation = { accepterInvitation: string };

export type RefuserInvitationMutationVariables = Exact<{
  id: string | number;
}>;


export type RefuserInvitationMutation = { refuserInvitation: boolean };

export type SimulerModeleDeDepartQueryVariables = Exact<{ [key: string]: never; }>;


export type SimulerModeleDeDepartQuery = { simulerModeleDeDepart: { fiches: Array<string>, groupesAjoutes: Array<string>, fichesEnConflit: Array<string>, periode: string | null, tachesCreees: Array<string>, perimetres: Array<{ slug: string, nom: string, groupe: string, tachesTypes: number }> } };

export type AppliquerModeleDeDepartMutationVariables = Exact<{ [key: string]: never; }>;


export type AppliquerModeleDeDepartMutation = { appliquerModeleDeDepart: { tachesCreees: Array<string>, perimetres: Array<{ slug: string }> } };

export type CreerEditionMutationVariables = Exact<{
  annee: number;
  nom: string;
  debut: string;
  fin: string;
}>;


export type CreerEditionMutation = { creerEdition: { id: string } };

export type ModifierMaLangueMutationVariables = Exact<{
  langue?: string | null | undefined;
}>;


export type ModifierMaLangueMutation = { modifierMaLangue: { id: string, langue: string | null } };

export type MonAdresseVisibleQueryVariables = Exact<{ [key: string]: never; }>;


export type MonAdresseVisibleQuery = { moi: { id: string, adresseVisible: boolean | null } | null };

export type ModifierMonAdresseVisibleMutationVariables = Exact<{
  visible: boolean;
}>;


export type ModifierMonAdresseVisibleMutation = { modifierMonAdresseVisible: boolean };

export type ClePubliquePushQueryVariables = Exact<{ [key: string]: never; }>;


export type ClePubliquePushQuery = { clePubliquePush: string | null };

export type AbonnePushQueryVariables = Exact<{
  adresse: string;
}>;


export type AbonnePushQuery = { abonnePush: boolean };

export type AbonnerPushMutationVariables = Exact<{
  adresse: string;
  p256dh: string;
  auth: string;
  agent?: string | null | undefined;
}>;


export type AbonnerPushMutation = { abonnerPush: boolean };

export type ModifierPreferencesPushMutationVariables = Exact<{
  frequenceResume: FrequenceResume;
  mailModification: boolean;
  mailEcheance: boolean;
  pushTaches?: boolean | null | undefined;
  pushEcheances?: boolean | null | undefined;
  pushDemandes?: boolean | null | undefined;
  pushEquipe?: boolean | null | undefined;
  pushAgenda?: boolean | null | undefined;
}>;


export type ModifierPreferencesPushMutation = { modifierPreferencesNotification: { pushTaches: boolean, pushEcheances: boolean, pushDemandes: boolean, pushEquipe: boolean, pushAgenda: boolean } };

export type MasquerPremiersPasMutationVariables = Exact<{ [key: string]: never; }>;


export type MasquerPremiersPasMutation = { masquerPremiersPas: { masques: boolean } };

export type MesPropositionsQueryVariables = Exact<{
  perimetreId: string | number;
  editionId: string | number;
}>;


export type MesPropositionsQuery = { mesPropositions: Array<{ id: string, nom: string, statut: StatutDemande }> };

export type ProposerPersonneMutationVariables = Exact<{
  perimetreId: string | number;
  editionId: string | number;
  nom: string;
  email: string;
  mot?: string | null | undefined;
}>;


export type ProposerPersonneMutation = { proposerPersonne: boolean };

export type RetirerPropositionMutationVariables = Exact<{
  id: string | number;
}>;


export type RetirerPropositionMutation = { retirerProposition: boolean };

export type RechercheGlobaleQueryVariables = Exact<{
  texte: string;
  editionId?: string | number | null | undefined;
}>;


export type RechercheGlobaleQuery = { recherche: { taches: Array<{ id: string, titre: string, edition: { id: string }, perimetre: { id: string, slug: string, nom: string, couleur: string | null } }>, fiches: Array<{ id: string, slug: string, titre: string, activite: { id: string, slug: string }, perimetre: { id: string, nom: string, couleur: string | null } | null }>, personnes: Array<{ id: string, nom: string, perimetres: Array<{ id: string, slug: string, nom: string, activite: { id: string, slug: string } }> }> } };

export type SimulerReconductionQueryVariables = Exact<{
  sourceId: string | number;
  cibleId: string | number;
}>;


export type SimulerReconductionQuery = { simulerReconduction: { effectifsCrees: Array<string>, lignes: Array<{ tacheId: string, perimetre: string, titre: string, statutSource: StatutTache, echeance: string | null, declinaisons: number, retenue: boolean, etat: EtatReconduction, raison: string | null }> } };

export type ReconduireEditionMutationVariables = Exact<{
  sourceId: string | number;
  cibleId: string | number;
  tacheIds?: Array<string | number> | string | number | null | undefined;
}>;


export type ReconduireEditionMutation = { reconduireEdition: { lignes: Array<{ tacheId: string, etat: EtatReconduction }> } };

export type CreerPerimetreMutationVariables = Exact<{
  slug: string;
  nom: string;
  groupe: string;
  couleur?: string | null | undefined;
  description?: string | null | undefined;
  ordre?: number | null | undefined;
}>;


export type CreerPerimetreMutation = { creerPerimetre: { id: string } };

export type ModifierPerimetreMutationVariables = Exact<{
  id: string | number;
  nom: string;
  groupe: string;
  couleur?: string | null | undefined;
  description?: string | null | undefined;
  ordre: number;
  archive: boolean;
  versionAttendue?: number | null | undefined;
}>;


export type ModifierPerimetreMutation = { modifierPerimetre: { id: string, nom: string, groupe: string, couleur: string | null, description: string | null, ordre: number, archive: boolean, version: number } };

export type BenevolesARepartirQueryVariables = Exact<{
  editionId: string | number;
  sequenceId?: string | number | null | undefined;
}>;


export type BenevolesARepartirQuery = { benevolesARepartir: Array<{ cle: string, candidatureId: string | null, benevoleId: string | null, nom: string, precisionsDisponibilite: string | null, message: string | null, origine: string | null, ouAilleurs: boolean, adequation: Adequation | null, note: string | null, plages: Array<{ jour: string, heureDebut: string, jourFin: string, heureFin: string }>, choix: Array<{ sequenceId: string, statut: string }>, places: Array<{ sequenceId: string }> }> };

export type CouvertureProgrammeQueryVariables = Exact<{
  editionId: string | number;
  perimetreIds?: Array<string | number> | string | number | null | undefined;
  sansPerimetre?: boolean | null | undefined;
}>;


export type CouvertureProgrammeQuery = { couvertureProgramme: Array<{ jour: string, heure: string, besoin: number, confirmees: number, aConfirmer: number, disponibles: number }> };

export type PlacerBenevoleMutationVariables = Exact<{
  sequenceId: string | number;
  candidatureId?: string | number | null | undefined;
  benevoleId?: string | number | null | undefined;
}>;


export type PlacerBenevoleMutation = { placerBenevole: { id: string } };

export type RetirerPlaceSequenceMutationVariables = Exact<{
  id: string | number;
}>;


export type RetirerPlaceSequenceMutation = { retirerPlaceSequence: { id: string } };

export type MonAdresseDeRoleQueryVariables = Exact<{ [key: string]: never; }>;


export type MonAdresseDeRoleQuery = { moi: { id: string, email: string, adresseDeRole: boolean | null } | null };

export type ReunionQueryVariables = Exact<{
  id: string | number;
}>;


export type ReunionQuery = { reunion: { id: string, editionId: string, titre: string, jour: string, jourFin: string, heureDebut: string, heureFin: string, statut: StatutReunion, cible: CibleConvocation | null, version: number, detailMasque: boolean, lieu: string | null, lienVisio: string | null, description: string | null, peutModifier: boolean, estConvoquee: boolean, maReponse: ReponseConvocation | null, perimetre: { id: string, nom: string, couleur: string | null } | null, taches: Array<{ id: string, titre: string, perimetreId: string }>, reponses: { presentes: number, absentes: number, peutEtre: number, sansReponse: number } | null, convocations: Array<{ personneId: string, nom: string, reponse: ReponseConvocation | null, envoyee: boolean }> | null } };

export type RepondreConvocationMutationVariables = Exact<{
  id: string | number;
  reponse: ReponseConvocation;
}>;


export type RepondreConvocationMutation = { repondreConvocation: { id: string, maReponse: ReponseConvocation | null } };

export type AnnulerReunionMutationVariables = Exact<{
  id: string | number;
}>;


export type AnnulerReunionMutation = { annulerReunion: { id: string, statut: StatutReunion } };

export type ReponsesDesMembresQueryVariables = Exact<{ [key: string]: never; }>;


export type ReponsesDesMembresQuery = { activites: Array<{ id: string, reponsesRecues: boolean }> };

export type CreerReunionMutationVariables = Exact<{
  editionId: string | number;
  perimetreId?: string | number | null | undefined;
  sondageId?: string | number | null | undefined;
  titre: string;
  jour: string;
  jourFin?: string | null | undefined;
  heureDebut: string;
  heureFin: string;
  lieu?: string | null | undefined;
  lienVisio?: string | null | undefined;
  description?: string | null | undefined;
  tacheIds?: Array<string | number> | string | number | null | undefined;
  cible?: CibleConvocation | null | undefined;
  personneIds?: Array<string | number> | string | number | null | undefined;
}>;


export type CreerReunionMutation = { creerReunion: { id: string } };

export type ModifierReunionMutationVariables = Exact<{
  id: string | number;
  titre: string;
  jour: string;
  jourFin?: string | null | undefined;
  heureDebut: string;
  heureFin: string;
  lieu?: string | null | undefined;
  lienVisio?: string | null | undefined;
  description?: string | null | undefined;
  tacheIds?: Array<string | number> | string | number | null | undefined;
  cible?: CibleConvocation | null | undefined;
  personneIds?: Array<string | number> | string | number | null | undefined;
  versionAttendue: number;
}>;


export type ModifierReunionMutation = { modifierReunion: { id: string } };

export type TachesPourReunionQueryVariables = Exact<{
  editionId: string | number;
}>;


export type TachesPourReunionQuery = { retroplanning: Array<{ id: string, titre: string, perimetre: { id: string, nom: string } }> };

export type ReunionsDuPerimetreQueryVariables = Exact<{
  editionId: string | number;
  perimetreId: string | number;
}>;


export type ReunionsDuPerimetreQuery = { reunions: Array<{ id: string, titre: string, jour: string, heureDebut: string, fin: string, statut: StatutReunion, lieu: string | null }> };

export type SupprimerSequenceMutationVariables = Exact<{
  id: string | number;
}>;


export type SupprimerSequenceMutation = { supprimerSequence: boolean };

export type CreerSequenceMutationVariables = Exact<{
  editionId: string | number;
  perimetreId?: string | number | null | undefined;
  lieuId?: string | number | null | undefined;
  titre: string;
  jour: string;
  jourFin?: string | null | undefined;
  heureDebut: string;
  heureFin: string;
  description?: string | null | undefined;
  places?: Array<PlaceSequenceInput> | PlaceSequenceInput | null | undefined;
  besoinBenevoles?: number | null | undefined;
  consignesBenevoles?: string | null | undefined;
}>;


export type CreerSequenceMutation = { creerSequence: { id: string } };

export type ModifierSequenceMutationVariables = Exact<{
  id: string | number;
  lieuId?: string | number | null | undefined;
  titre: string;
  jour: string;
  jourFin?: string | null | undefined;
  heureDebut: string;
  heureFin: string;
  description?: string | null | undefined;
  places?: Array<PlaceSequenceInput> | PlaceSequenceInput | null | undefined;
  besoinBenevoles?: number | null | undefined;
  consignesBenevoles?: string | null | undefined;
  versionAttendue: number;
}>;


export type ModifierSequenceMutation = { modifierSequence: { id: string } };

export type ProgrammePerimetreQueryVariables = Exact<{
  editionId: string | number;
  perimetreId: string | number;
}>;


export type ProgrammePerimetreQuery = { programme: Array<{ id: string, titre: string, jour: string, heureDebut: string, heureFin: string, lieu: { id: string, nom: string } | null, places: Array<{ id: string, role: RolePlace, nom: string }> }> };

export type SondageQueryVariables = Exact<{
  id: string | number;
}>;


export type SondageQuery = { sondage: { id: string, editionId: string, titre: string, description: string | null, statut: StatutSondage, cible: CibleConvocation, version: number, reunionId: string | null, peutModifier: boolean, estParticipant: boolean, participants: number, participantIds: Array<string> | null, repondants: number, perimetre: { id: string, nom: string, couleur: string | null } | null, creneaux: Array<{ id: string, jour: string, heureDebut: string | null, heureFin: string | null, retenu: boolean, oui: number, siBesoin: number, non: number, monChoix: ChoixSondage | null, reponses: Array<{ personneId: string, nom: string, choix: ChoixSondage }> }> } };

export type RepondreSondageMutationVariables = Exact<{
  id: string | number;
  reponses: Array<ReponseSondageInput> | ReponseSondageInput;
}>;


export type RepondreSondageMutation = { repondreSondage: { id: string } };

export type CloreSondageMutationVariables = Exact<{
  id: string | number;
  creneauId: string | number;
}>;


export type CloreSondageMutation = { cloreSondage: { id: string } };

export type SupprimerSondageMutationVariables = Exact<{
  id: string | number;
}>;


export type SupprimerSondageMutation = { supprimerSondage: boolean };

export type CreerSondageMutationVariables = Exact<{
  editionId: string | number;
  perimetreId?: string | number | null | undefined;
  titre: string;
  description?: string | null | undefined;
  creneaux: Array<CreneauSondageInput> | CreneauSondageInput;
  cible: CibleConvocation;
  personneIds?: Array<string | number> | string | number | null | undefined;
}>;


export type CreerSondageMutation = { creerSondage: { id: string } };

export type ModifierSondageMutationVariables = Exact<{
  id: string | number;
  titre: string;
  description?: string | null | undefined;
  creneaux: Array<CreneauSondageInput> | CreneauSondageInput;
  versionAttendue: number;
}>;


export type ModifierSondageMutation = { modifierSondage: { id: string } };

export type SimulerTachesTypesQueryVariables = Exact<{
  editionId: string | number;
}>;


export type SimulerTachesTypesQuery = { simulerTachesTypes: { tachesCreees: Array<string>, tachesDejaPresentes: Array<string>, effectifsCrees: Array<string>, conflits: Array<string>, illisibles: Array<string> } };

export type AppliquerTachesTypesMutationVariables = Exact<{
  editionId: string | number;
}>;


export type AppliquerTachesTypesMutation = { appliquerTachesTypes: { tachesCreees: Array<string> } };

export type AgendasEcritsQueryVariables = Exact<{
  editionId: string | number;
}>;


export type AgendasEcritsQuery = { moi: { id: string, affectations: Array<{ id: string, perimetre: { id: string } }> } | null };

export type FilChampsFragment = { tacheId: string, nombreCommentaires: number, peutCommenter: boolean, commentaires: Array<{ id: string, texte: string, creeLe: string, modifieLe: string | null, peutModifier: boolean, peutSupprimer: boolean, auteur: { id: string, nom: string } | null }>, evenements: Array<{ id: string, type: TypeEvenementTache, le: string, statut: StatutTache | null, acteur: { id: string, nom: string } | null, personne: { id: string, nom: string } | null }> };

export type FilTacheQueryVariables = Exact<{
  id: string | number;
}>;


export type FilTacheQuery = { filTache: { tacheId: string, nombreCommentaires: number, peutCommenter: boolean, commentaires: Array<{ id: string, texte: string, creeLe: string, modifieLe: string | null, peutModifier: boolean, peutSupprimer: boolean, auteur: { id: string, nom: string } | null }>, evenements: Array<{ id: string, type: TypeEvenementTache, le: string, statut: StatutTache | null, acteur: { id: string, nom: string } | null, personne: { id: string, nom: string } | null }> } };

export type CommentairesDeLaPeriodeQueryVariables = Exact<{
  editionId: string | number;
}>;


export type CommentairesDeLaPeriodeQuery = { commentairesDeLaPeriode: { perimetresLus: Array<string>, nombres: Array<{ tacheId: string, nombre: number }> } };

export type CommenterTacheMutationVariables = Exact<{
  id: string | number;
  texte: string;
}>;


export type CommenterTacheMutation = { commenterTache: { tacheId: string, nombreCommentaires: number, peutCommenter: boolean, commentaires: Array<{ id: string, texte: string, creeLe: string, modifieLe: string | null, peutModifier: boolean, peutSupprimer: boolean, auteur: { id: string, nom: string } | null }>, evenements: Array<{ id: string, type: TypeEvenementTache, le: string, statut: StatutTache | null, acteur: { id: string, nom: string } | null, personne: { id: string, nom: string } | null }> } };

export type ModifierCommentaireMutationVariables = Exact<{
  id: string | number;
  texte: string;
}>;


export type ModifierCommentaireMutation = { modifierCommentaire: { tacheId: string, nombreCommentaires: number, peutCommenter: boolean, commentaires: Array<{ id: string, texte: string, creeLe: string, modifieLe: string | null, peutModifier: boolean, peutSupprimer: boolean, auteur: { id: string, nom: string } | null }>, evenements: Array<{ id: string, type: TypeEvenementTache, le: string, statut: StatutTache | null, acteur: { id: string, nom: string } | null, personne: { id: string, nom: string } | null }> } };

export type SupprimerCommentaireMutationVariables = Exact<{
  id: string | number;
}>;


export type SupprimerCommentaireMutation = { supprimerCommentaire: { tacheId: string, nombreCommentaires: number, peutCommenter: boolean, commentaires: Array<{ id: string, texte: string, creeLe: string, modifieLe: string | null, peutModifier: boolean, peutSupprimer: boolean, auteur: { id: string, nom: string } | null }>, evenements: Array<{ id: string, type: TypeEvenementTache, le: string, statut: StatutTache | null, acteur: { id: string, nom: string } | null, personne: { id: string, nom: string } | null }> } };

export type EspaceFichiersQueryVariables = Exact<{ [key: string]: never; }>;


export type EspaceFichiersQuery = { espaceFichiers: { connexionsPossibles: Array<{ fournisseur: FournisseurFichiers, methode: MethodeConnexionFichiers }>, connexion: { fournisseur: FournisseurFichiers, methode: MethodeConnexionFichiers, compte: string, etat: EtatConnexionFichiers, connecteeLe: string, connecteePar: string | null, portee: PorteeConnexionFichiers, accesVerifieLe: string | null, accesErreur: string | null, exportDossier: string | null, exportRapport: { exporteLe: string, ecrites: number, inchangees: number, supprimees: number, modifieesALaMain: Array<string>, erreur: string | null, refusees: Array<{ fiche: string, raison: string }> } | null } | null } };

export type CommencerConnexionEspaceFichiersMutationVariables = Exact<{
  fournisseur: FournisseurFichiers;
  portee?: PorteeConnexionFichiers | null | undefined;
}>;


export type CommencerConnexionEspaceFichiersMutation = { commencerConnexionEspaceFichiers: string };

export type ConnecterCompteServiceGoogleMutationVariables = Exact<{
  cle: string;
}>;


export type ConnecterCompteServiceGoogleMutation = { connecterCompteServiceGoogle: { compte: string } };

export type CommencerConnexionNextcloudMutationVariables = Exact<{
  adresse: string;
}>;


export type CommencerConnexionNextcloudMutation = { commencerConnexionNextcloud: { connexion: string, etat: string } };

export type TerminerConnexionNextcloudMutationVariables = Exact<{
  etat: string;
}>;


export type TerminerConnexionNextcloudMutation = { terminerConnexionNextcloud: boolean };

export type DeconnecterEspaceFichiersMutationVariables = Exact<{ [key: string]: never; }>;


export type DeconnecterEspaceFichiersMutation = { deconnecterEspaceFichiers: boolean };

export type ChoisirDossierExportMutationVariables = Exact<{
  emplacement: string;
  chemin: Array<string> | string;
}>;


export type ChoisirDossierExportMutation = { choisirDossierExport: { exportDossier: string | null } };

export type RetirerDossierExportMutationVariables = Exact<{ [key: string]: never; }>;


export type RetirerDossierExportMutation = { retirerDossierExport: boolean };

export type ExporterFichesMaintenantMutationVariables = Exact<{ [key: string]: never; }>;


export type ExporterFichesMaintenantMutation = { exporterFichesMaintenant: boolean };

export type SimulerImportFichesQueryVariables = Exact<{
  activiteId: string | number;
  sources: Array<SourceImportFiches> | SourceImportFiches;
}>;


export type SimulerImportFichesQuery = { simulerImportFiches: { creees: Array<string>, nouvellesVersions: Array<string>, inchangees: Array<string>, incomplet: boolean, conflits: Array<{ fiche: string, raison: string }>, nonImportes: Array<{ fichier: string, raison: string }>, refusees: Array<{ fichier: string, raison: string }>, converties: Array<{ fichier: string, raison: string }> } };

export type ImporterFichesEspaceMutationVariables = Exact<{
  activiteId: string | number;
  sources: Array<SourceImportFiches> | SourceImportFiches;
}>;


export type ImporterFichesEspaceMutation = { importerFichesEspace: { creees: Array<string>, nouvellesVersions: Array<string>, inchangees: Array<string>, incomplet: boolean, conflits: Array<{ fiche: string, raison: string }>, nonImportes: Array<{ fichier: string, raison: string }>, refusees: Array<{ fichier: string, raison: string }>, converties: Array<{ fichier: string, raison: string }> } };

export type DossiersLiesQueryVariables = Exact<{
  activiteId?: string | number | null | undefined;
  perimetreId?: string | number | null | undefined;
}>;


export type DossiersLiesQuery = { dossiersLies: Array<{ id: string, nom: string, disponible: boolean, fournisseur: FournisseurFichiers, touteActivite: boolean, attendus: AttendusDossier, accesCrees: number, groupes: Array<string>, perimetres: Array<{ id: string, slug: string, nom: string, couleur: string | null, archive: boolean }>, lecteursLus: { touteActivite: boolean, groupes: Array<string>, perimetres: Array<{ id: string, slug: string, nom: string, couleur: string | null }> } }> };

export type EffetsLecteursDossierQueryVariables = Exact<{
  id: string | number;
  lecteurs: LecteursDossierInput;
}>;


export type EffetsLecteursDossierQuery = { effetsLecteursDossier: { documentsMasques: number, fiches: Array<{ id: string, titre: string }> } };

export type ContenuDossierLieQueryVariables = Exact<{
  id: string | number;
  chemin: Array<string> | string;
  ressource?: string | number | null | undefined;
}>;


export type ContenuDossierLieQuery = { contenuDossierLie: { complet: boolean, elements: Array<{ elementId: string, nom: string, dossier: boolean, taille: number | null, modifieLe: string | null, lienWeb: string | null, apercu: FormatApercu }> } };

export type PerimetresALierQueryVariables = Exact<{
  activiteId?: string | number | null | undefined;
}>;


export type PerimetresALierQuery = { perimetres: Array<{ id: string, slug: string, nom: string, couleur: string | null }> };

export type EmplacementsFichiersQueryVariables = Exact<{ [key: string]: never; }>;


export type EmplacementsFichiersQuery = { emplacementsFichiers: Array<{ id: string, nom: string, site: string | null }> };

export type ParcourirEspaceFichiersQueryVariables = Exact<{
  emplacement: string;
  chemin: Array<string> | string;
}>;


export type ParcourirEspaceFichiersQuery = { parcourirEspaceFichiers: { complet: boolean, elements: Array<{ elementId: string, nom: string }> } };

export type LierDossierMutationVariables = Exact<{
  activiteId: string | number;
  lecteurs: LecteursDossierInput;
  emplacement: string;
  chemin: Array<string> | string;
}>;


export type LierDossierMutation = { lierDossier: { id: string } };

export type ModifierDossierLieMutationVariables = Exact<{
  id: string | number;
  lecteurs: LecteursDossierInput;
  nom?: string | null | undefined;
  attendus?: AttendusDossier | null | undefined;
}>;


export type ModifierDossierLieMutation = { modifierDossierLie: { id: string, nom: string, touteActivite: boolean, groupes: Array<string>, perimetres: Array<{ id: string }> } };

export type DelierDossierMutationVariables = Exact<{
  id: string | number;
  oublierAcces?: boolean | null | undefined;
}>;


export type DelierDossierMutation = { delierDossier: boolean };

export type RessourcesFicheQueryVariables = Exact<{
  slug: string;
}>;


export type RessourcesFicheQuery = { fiche: { id: string, concerneGroupes: Array<string>, ressources: Array<{ id: string, nom: string, type: TypeRessource, chemin: Array<string>, ouvrable: boolean, ouverteAuxLecteurs: boolean, apercu: FormatApercu, existe: boolean | null, lienWeb: string | null, perimetresSansAcces: Array<{ id: string, nom: string, couleur: string | null }>, dossierLie: { id: string, nom: string, disponible: boolean, fournisseur: FournisseurFichiers, touteActivite: boolean, groupes: Array<string>, perimetres: Array<{ id: string }> } }> } | null };

export type OuvrirDocumentLieMutationVariables = Exact<{
  id: string | number;
  ouvert: boolean;
}>;


export type OuvrirDocumentLieMutation = { ouvrirDocumentLie: { id: string, ouverteAuxLecteurs: boolean } };

export type LierRessourceFicheMutationVariables = Exact<{
  ficheId: string | number;
  dossierLieId: string | number;
  chemin: Array<string> | string;
}>;


export type LierRessourceFicheMutation = { lierRessourceFiche: { id: string } };

export type DelierRessourceFicheMutationVariables = Exact<{
  id: string | number;
}>;


export type DelierRessourceFicheMutation = { delierRessourceFiche: boolean };

export type VerificationAccesQueryVariables = Exact<{
  activiteId: string | number;
}>;


export type VerificationAccesQuery = { verificationAcces: Array<{ verifieLe: string | null, dossier: { id: string, nom: string, touteActivite: boolean, attendus: AttendusDossier, accesFournisseur: AccesFournisseurDossier, groupeFournisseurId: string | null, groupeFournisseurNom: string | null, roleFournisseur: RoleFournisseur, fournisseur: FournisseurFichiers, ajoutsAutomatiques: boolean, invitationFournisseur: boolean, groupes: Array<string>, perimetres: Array<{ id: string, nom: string, couleur: string | null }> }, perimetres: Array<{ id: string, nom: string, couleur: string | null }>, propositions: Array<{ id: string, action: ActionProposition, etat: EtatProposition, erreur: string | null, cible: string, parGroupe: boolean, personne: { id: string, nom: string, email: string } }>, lignes: Array<{ nom: string, etat: EtatAccesFournisseur, via: string | null, perimetreIds: Array<string>, personne: { id: string, email: string } | null }> }> };

export type ComptesFournisseurQueryVariables = Exact<{ [key: string]: never; }>;


export type ComptesFournisseurQuery = { comptesFournisseur: Array<{ etat: EtatCompteFournisseur | null, adresseSaisie: string | null, verifieLe: string | null, personne: { id: string, nom: string, email: string } }> };

export type VerifierAccesFournisseurMutationVariables = Exact<{ [key: string]: never; }>;


export type VerifierAccesFournisseurMutation = { verifierAccesFournisseur: boolean };

export type SaisirAdresseFournisseurMutationVariables = Exact<{
  userId: string | number;
  adresse?: string | null | undefined;
}>;


export type SaisirAdresseFournisseurMutation = { saisirAdresseFournisseur: { adresseSaisie: string | null } };

export type ReglerPorteeConnexionMutationVariables = Exact<{
  portee: PorteeConnexionFichiers;
}>;


export type ReglerPorteeConnexionMutation = { reglerPorteeConnexion: { portee: PorteeConnexionFichiers } };

export type GroupesDuDossierQueryVariables = Exact<{
  id: string | number;
}>;


export type GroupesDuDossierQuery = { groupesDuDossier: Array<{ identifiant: string, nom: string }> };

export type ReglerAccesFournisseurMutationVariables = Exact<{
  id: string | number;
  mode: AccesFournisseurDossier;
  groupeId?: string | number | null | undefined;
  role: RoleFournisseur;
  ajoutsAutomatiques: boolean;
  invitation: boolean;
}>;


export type ReglerAccesFournisseurMutation = { reglerAccesFournisseur: { id: string, accesFournisseur: AccesFournisseurDossier } };

export type AppliquerPropositionAccesMutationVariables = Exact<{
  id: string | number;
}>;


export type AppliquerPropositionAccesMutation = { appliquerPropositionAcces: EtatProposition };

export type AppliquerPropositionsDossierMutationVariables = Exact<{
  dossierId: string | number;
}>;


export type AppliquerPropositionsDossierMutation = { appliquerPropositionsDossier: number };

export type EcarterPropositionAccesMutationVariables = Exact<{
  id: string | number;
}>;


export type EcarterPropositionAccesMutation = { ecarterPropositionAcces: boolean };

export type FicheQueryVariables = Exact<{
  slug: string;
}>;


export type FicheQuery = { moi: { id: string, estAdmin: boolean | null } | null, fiche: { id: string, slug: string, titre: string, contenu: string, source: SourceFiche | null, archive: boolean, modifieeLe: string, modifieePar: string | null, peutModifier: boolean, donneesPersonnelles: Array<string>, nombreVersions: number | null, versionCouranteId: string | null, concerneGroupes: Array<string>, perimetre: { id: string, slug: string, nom: string, couleur: string | null } | null, connexions: Array<{ par: OrigineConnexe, groupe: string | null, tacheId: string | null, masquee: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null } }> } | null };

export type TachesFicheQueryVariables = Exact<{
  slug: string;
  editionId: string | number;
}>;


export type TachesFicheQuery = { fiche: { id: string, taches: Array<{ id: string, titre: string, echeance: string | null, statut: StatutTache, enRetard: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null } }> } | null };

export type VersionsFicheQueryVariables = Exact<{
  slug: string;
}>;


export type VersionsFicheQuery = { fiche: { id: string, versionCouranteId: string | null, versions: Array<{ id: string, titre: string, contenu: string, source: SourceFiche, resume: string | null, creeLe: string, auteur: { id: string, nom: string } | null }> } | null };

export type ListeFichesQueryVariables = Exact<{ [key: string]: never; }>;


export type ListeFichesQuery = { peutRedigerFichesCommunes: boolean, fiches: Array<{ id: string, slug: string, titre: string, modifieeLe: string, modifieePar: string | null, source: SourceFiche | null, perimetre: { id: string, slug: string, nom: string, couleur: string | null } | null }> };

export type CreerFicheMutationVariables = Exact<{
  slug: string;
  titre: string;
  contenu: string;
  perimetreId?: string | number | null | undefined;
}>;


export type CreerFicheMutation = { creerFiche: { id: string, slug: string } };

export type ModifierFicheMutationVariables = Exact<{
  id: string | number;
  titre: string;
  contenu: string;
  resume?: string | null | undefined;
  versionDeDepart?: string | number | null | undefined;
}>;


export type ModifierFicheMutation = { modifierFiche: { id: string, slug: string, titre: string, contenu: string, modifieeLe: string, modifieePar: string | null, source: SourceFiche | null, donneesPersonnelles: Array<string>, versionCouranteId: string | null } };

export type RestaurerVersionFicheMutationVariables = Exact<{
  versionId: string | number;
  versionDeDepart?: string | number | null | undefined;
}>;


export type RestaurerVersionFicheMutation = { restaurerVersionFiche: { id: string, titre: string, contenu: string, modifieeLe: string, modifieePar: string | null, source: SourceFiche | null, versionCouranteId: string | null } };

export type ReglerConcerneAussiMutationVariables = Exact<{
  ficheId: string | number;
  perimetreIds: Array<string | number> | string | number;
  groupes: Array<string> | string;
}>;


export type ReglerConcerneAussiMutation = { reglerConcerneAussi: { id: string } };

export type InvitationsEnAttenteQueryVariables = Exact<{
  activiteId?: string | number | null | undefined;
}>;


export type InvitationsEnAttenteQuery = { invitationsEnAttente: Array<{ id: string, nom: string, email: string, estAdmin: boolean, expireLe: string, activitesRattachees: Array<string>, perimetresAffectes: Array<{ id: string, nom: string, couleur: string | null }>, perimetresSouhaites: Array<{ id: string, nom: string, couleur: string | null }> }> };

export type MesInvitationsQueryVariables = Exact<{ [key: string]: never; }>;


export type MesInvitationsQuery = { mesInvitations: Array<{ id: string, organisationNom: string, estAdmin: boolean, perimetres: Array<string>, expireLe: string }> };

export type TeleverserMediaMutationVariables = Exact<{
  format: FormatMedia;
  donnees: string;
}>;


export type TeleverserMediaMutation = { televerserMedia: { empreinte: string, url: string } };

export type VersionInstallationQueryVariables = Exact<{ [key: string]: never; }>;


export type VersionInstallationQuery = { versionInstallation: string };

export type NotesDeVersionQueryVariables = Exact<{ [key: string]: never; }>;


export type NotesDeVersionQuery = { notesDeVersion: Array<{ numero: string, date: string, notes: Array<{ id: string, type: TypeNoteDeVersion, role: RoleNoteDeVersion, titre: string, texte: string }> }> };

export type ThemeChampsFragment = { couleurs: { encre: string, primaire: string, primaireClair: string, accent: string, accentClair: string, accentTexte: string, succes: string, succesClair: string, alerte: string, alerteClair: string, erreur: string, erreurClair: string, sol1: string, sol2: string, sol3: string }, fond: { transition: string, halo1: { couleur: string, intensite: number }, halo2: { couleur: string, intensite: number } }, polices: { texte: string, titre: string, mono: string }, typographie: { graisseTitre: number, graisseCorps: number, espacementTitre: string, echelleTitre: number } };

export type OrganisationQueryVariables = Exact<{
  slug?: string | null | undefined;
}>;


export type OrganisationQuery = { organisation: { slug: string, nom: string, sigle: string | null, logoUrl: string | null, faviconUrl: string | null, iconeApplicationUrl: string | null, manifestUrl: string, pageEquipe: string | null, langue: string | null, codeSource: string, modesDEmploi: string, support: string | null, theme: { couleurs: { encre: string, primaire: string, primaireClair: string, accent: string, accentClair: string, accentTexte: string, succes: string, succesClair: string, alerte: string, alerteClair: string, erreur: string, erreurClair: string, sol1: string, sol2: string, sol3: string }, fond: { transition: string, halo1: { couleur: string, intensite: number }, halo2: { couleur: string, intensite: number } }, polices: { texte: string, titre: string, mono: string }, typographie: { graisseTitre: number, graisseCorps: number, espacementTitre: string, echelleTitre: number } } } };

export type DesabonnerPushMutationVariables = Exact<{
  adresse: string;
}>;


export type DesabonnerPushMutation = { desabonnerPush: boolean };

export type CandidaturesQueryVariables = Exact<{
  editionId: string | number;
  statut?: StatutCandidature | null | undefined;
}>;


export type CandidaturesQuery = { candidatures: Array<{ id: string, statut: StatutCandidature, nom: string, courriel: string | null, telephone: string | null, message: string | null, precisionsDisponibilite: string | null, ouAilleurs: boolean, deposeeLe: string, origine: string, appelNom: string, benevoleId: string | null, peutEcarter: boolean, plages: Array<{ jour: string, heureDebut: string, jourFin: string, heureFin: string }>, choix: Array<{ id: string, statut: StatutChoix, sequenceId: string, titre: string, jour: string, heureDebut: string, jourFin: string, heureFin: string, lieu: string | null, peutTraiter: boolean, perimetre: { id: string, nom: string, couleur: string | null } | null }> }> };

export type AppelsBenevolesQueryVariables = Exact<{
  editionId: string | number;
}>;


export type AppelsBenevolesQuery = { appelsBenevoles: Array<{ id: string, nom: string, portee: PorteeAppel, sequenceId: string | null, sequenceTitre: string | null, introduction: string | null, ouvertLe: string, fermeLe: string, etat: EtatAppel, finAdresse: string, adresse: string | null, candidaturesEnAttente: number, version: number, peutModifier: boolean, perimetre: { id: string, nom: string } | null }> };

export type SequencesPourImportQueryVariables = Exact<{
  editionId: string | number;
}>;


export type SequencesPourImportQuery = { programme: Array<{ id: string, titre: string, jour: string, heureDebut: string, heureFin: string, besoinBenevoles: number | null, perimetre: { id: string, nom: string } | null }> };

export type SimulerImportBenevolesQueryVariables = Exact<{
  editionId: string | number;
  perimetreId?: string | number | null | undefined;
  source: string;
  mode: ModeImport;
  prevenirParMail?: boolean | null | undefined;
  accepterTout?: boolean | null | undefined;
  accord: boolean;
  personnes: Array<PersonneImportInput> | PersonneImportInput;
}>;


export type SimulerImportBenevolesQuery = { simulerImportBenevoles: { aImporter: number, dejaImportees: number, ecartees: number, fichesCreees: number, fichesRattachees: number, places: number, fichesRestantes: number, depassements: Array<{ sequenceId: string, titre: string, besoin: number, renforts: number }>, lignes: Array<{ cle: string, etat: EtatLigneImport, motif: string | null, rattacheeA: string | null, compte: boolean, rapprochement: { benevoleId: string, nom: string, niveau: NiveauRapprochement } | null }> } };

export type ImporterBenevolesMutationVariables = Exact<{
  editionId: string | number;
  perimetreId?: string | number | null | undefined;
  source: string;
  mode: ModeImport;
  prevenirParMail?: boolean | null | undefined;
  accepterTout?: boolean | null | undefined;
  accord: boolean;
  personnes: Array<PersonneImportInput> | PersonneImportInput;
}>;


export type ImporterBenevolesMutation = { importerBenevoles: { aImporter: number, dejaImportees: number, ecartees: number, fichesCreees: number, fichesRattachees: number, places: number, lignes: Array<{ cle: string, etat: EtatLigneImport, motif: string | null }> } };

export type CorrespondancesImportQueryVariables = Exact<{
  activiteId: string | number;
}>;


export type CorrespondancesImportQuery = { correspondancesImport: Array<{ id: string, nom: string, entetes: Array<string>, associations: unknown, reglages: unknown, peutSupprimer: boolean }> };

export type EnregistrerCorrespondanceImportMutationVariables = Exact<{
  activiteId: string | number;
  nom: string;
  entetes: Array<string> | string;
  associations: unknown;
  reglages: unknown;
}>;


export type EnregistrerCorrespondanceImportMutation = { enregistrerCorrespondanceImport: { id: string } };

export type DoublonsBenevolesQueryVariables = Exact<{
  activiteId: string | number;
}>;


export type DoublonsBenevolesQuery = { doublonsBenevoles: Array<{ niveau: NiveauRapprochement, a: { id: string, nom: string, courriel: string | null, telephone: string | null, places: number, origine: string, sourceImport: string | null }, b: { id: string, nom: string, courriel: string | null, telephone: string | null, places: number, origine: string, sourceImport: string | null } }> };

export type FusionnerBenevolesMutationVariables = Exact<{
  gardeeId: string | number;
  autreId: string | number;
  nomDe: CoteFusion;
  courrielDe: CoteFusion;
  telephoneDe: CoteFusion;
}>;


export type FusionnerBenevolesMutation = { fusionnerBenevoles: { id: string } };

export type MarquerBenevolesDistinctsMutationVariables = Exact<{
  aId: string | number;
  bId: string | number;
}>;


export type MarquerBenevolesDistinctsMutation = { marquerBenevolesDistincts: boolean };

export type MessagesQueryVariables = Exact<{
  activiteId?: string | number | null | undefined;
}>;


export type MessagesQuery = { messages: Array<{ id: string, modele: string, objet: string, corps: string, champ: ChampDestinataires, statut: StatutMessage, statutLe: string | null, creeLe: string, activiteId: string | null, perimetreId: string | null, estLeMien: boolean, auteur: { id: string, nom: string } | null, destinataires: Array<{ id: string, enCopie: boolean, personne: { id: string, nom: string } }> }> };

export type CreerMessageMutationVariables = Exact<{
  message: MessageInput;
}>;


export type CreerMessageMutation = { creerMessage: { id: string, statut: StatutMessage } };

export type DefinirStatutMessageMutationVariables = Exact<{
  id: string | number;
  statut: StatutMessage;
}>;


export type DefinirStatutMessageMutation = { definirStatutMessage: { id: string, statut: StatutMessage, statutLe: string | null } };

export type InformationsMessageQueryVariables = Exact<{
  editionId: string | number;
}>;


export type InformationsMessageQuery = { retroplanning: Array<{ id: string, titre: string, echeance: string | null, statut: StatutTache, enRetard: boolean, perimetre: { id: string, nom: string } }>, postesAPourvoir: Array<{ aPourvoir: number, perimetre: { id: string, nom: string, groupe: string } }> };

export type AdressesEquipeQueryVariables = Exact<{ [key: string]: never; }>;


export type AdressesEquipeQuery = { equipe: Array<{ id: string, nom: string, email: string }> };

export type NotificationAfficheeFragment = { id: string, type: TypeNotification, niveau: NiveauNotification, message: string, lien: string, lue: boolean, creeLe: string, periode: string | null, activite: { id: string, slug: string, nom: string } | null, perimetre: { id: string, slug: string, nom: string, couleur: string | null } | null };

export type NombreNotificationsNonLuesQueryVariables = Exact<{ [key: string]: never; }>;


export type NombreNotificationsNonLuesQuery = { nombreNotificationsNonLues: number };

export type NombreNotificationsAdminQueryVariables = Exact<{ [key: string]: never; }>;


export type NombreNotificationsAdminQuery = { nombreNotificationsNonLues: number };

export type ListeNotificationsQueryVariables = Exact<{ [key: string]: never; }>;


export type ListeNotificationsQuery = { notifications: Array<{ id: string, type: TypeNotification, niveau: NiveauNotification, message: string, lien: string, lue: boolean, creeLe: string, periode: string | null, activite: { id: string, slug: string, nom: string } | null, perimetre: { id: string, slug: string, nom: string, couleur: string | null } | null }> };

export type ListeNotificationsAdminQueryVariables = Exact<{ [key: string]: never; }>;


export type ListeNotificationsAdminQuery = { notifications: Array<{ id: string, type: TypeNotification, niveau: NiveauNotification, message: string, lien: string, lue: boolean, creeLe: string, periode: string | null, activite: { id: string, slug: string, nom: string } | null, perimetre: { id: string, slug: string, nom: string, couleur: string | null } | null }> };

export type NotificationsAutresOrganisationsQueryVariables = Exact<{ [key: string]: never; }>;


export type NotificationsAutresOrganisationsQuery = { notificationsAutresOrganisations: Array<{ slug: string, nom: string, nonLues: number }> };

export type MarquerNotificationsLuesMutationVariables = Exact<{
  ids?: Array<string | number> | string | number | null | undefined;
  admin?: boolean | null | undefined;
  activiteId?: string | number | null | undefined;
  perimetreId?: string | number | null | undefined;
}>;


export type MarquerNotificationsLuesMutation = { marquerNotificationsLues: number };

export type MoiQueryVariables = Exact<{ [key: string]: never; }>;


export type MoiQuery = { moi: { id: string, nom: string, email: string, estAdmin: boolean | null } | null };

export type LangueDeMoiQueryVariables = Exact<{ [key: string]: never; }>;


export type LangueDeMoiQuery = { moi: { id: string, langue: string | null } | null };

export type EditionCouranteQueryVariables = Exact<{ [key: string]: never; }>;


export type EditionCouranteQuery = { editionCourante: { id: string, annee: number, nom: string, debut: string, fin: string, statut: StatutEdition } | null };

export type EditionsQueryVariables = Exact<{ [key: string]: never; }>;


export type EditionsQuery = { editions: Array<{ id: string, annee: number, nom: string, debut: string, fin: string, statut: StatutEdition }> };

export type PerimetresQueryVariables = Exact<{
  inclureArchives?: boolean | null | undefined;
}>;


export type PerimetresQuery = { perimetres: Array<{ id: string, slug: string, nom: string, description: string | null, type: TypePerimetre, groupe: string, couleur: string | null, ordre: number, archive: boolean, version: number }> };

export type ActivitesQueryVariables = Exact<{ [key: string]: never; }>;


export type ActivitesQuery = { activites: Array<{ id: string, slug: string, nom: string, sigle: string | null, nature: NatureActivite, ordre: number, archive: boolean, estAdministree: boolean, souhaitsOuverts: boolean, adressesOrganigramme: AdressesOrganigramme, formulaireOuvert: boolean, modules: Array<ModuleActivite>, modulesAutorises: Array<ModuleActivite>, acces: AccesActivite, logoUrl: string | null, contactRecrutement: string | null, pageEquipe: string | null, formulaire: { introduction: string | null, question: string | null, paliers: Array<string> }, groupes: Array<{ cle: string, libelle: string, libellePluriel: string }>, phases: Array<{ cle: string, libelle: string, jusquA: string | null }>, theme: { couleurs: { encre: string, primaire: string, primaireClair: string, accent: string, accentClair: string, accentTexte: string, succes: string, succesClair: string, alerte: string, alerteClair: string, erreur: string, erreurClair: string, sol1: string, sol2: string, sol3: string }, fond: { transition: string, halo1: { couleur: string, intensite: number }, halo2: { couleur: string, intensite: number } }, polices: { texte: string, titre: string, mono: string }, typographie: { graisseTitre: number, graisseCorps: number, espacementTitre: string, echelleTitre: number } }, identite: { contactRecrutement: string | null, pageEquipe: string | null, logoPng: string | null, logoSvg: string | null, logoUrl: string | null, theme: unknown } }> };

export type MesOrganisationsQueryVariables = Exact<{ [key: string]: never; }>;


export type MesOrganisationsQuery = { mesOrganisations: Array<{ slug: string, nom: string, sigle: string | null, estAdmin: boolean, statut: string, active: boolean }> };

export type AffecterMutationVariables = Exact<{
  personneId: string | number;
  perimetreId: string | number;
  editionId: string | number;
}>;


export type AffecterMutation = { affecter: { id: string } };

export type RetirerAffectationMutationVariables = Exact<{
  id: string | number;
}>;


export type RetirerAffectationMutation = { retirerAffectation: boolean };

export type DefinirAdminActiviteMutationVariables = Exact<{
  personneId: string | number;
  activiteId: string | number;
  admin: boolean;
}>;


export type DefinirAdminActiviteMutation = { definirAdminActivite: boolean };

export type AvancementGlobalQueryVariables = Exact<{
  editionId: string | number;
}>;


export type AvancementGlobalQuery = { avancementGlobal: Array<{ perimetre: { id: string }, avancement: { total: number, aFaire: number, enCours: number, faites: number, abandonnees: number, enRetard: number, sansPersonne: number } }> };

export type PersonnesConvocablesQueryVariables = Exact<{
  editionId: string | number;
  perimetreId?: string | number | null | undefined;
}>;


export type PersonnesConvocablesQuery = { personnesConvocables: Array<{ personneId: string, nom: string, duPerimetre: boolean }> };

export type LieuxQueryVariables = Exact<{
  activiteId: string | number;
}>;


export type LieuxQuery = { lieux: Array<{ id: string, nom: string, description: string | null, ordre: number, archive: boolean }> };

export type BenevolesQueryVariables = Exact<{
  activiteId: string | number;
}>;


export type BenevolesQuery = { benevoles: Array<{ id: string, nom: string, courriel: string | null, telephone: string | null, note: string | null, coordonneesVisibles: boolean, peutModifier: boolean, places: number, accordLe: string, origine: string, prevenirParMail: boolean, confirmeeLe: string | null, lienEnvoyeLe: string | null, lienRenvoyable: boolean, lienEspace: string | null }> };

export type PremiersPasQueryVariables = Exact<{ [key: string]: never; }>;


export type PremiersPasQuery = { premiersPas: { masques: boolean, termines: boolean, etapes: Array<{ etape: EtapePremiersPas, faite: boolean }> } };

export type TacheChampsFragment = { id: string, titre: string, description: string | null, echeance: string | null, statut: StatutTache, version: number, enRetard: boolean, termineeLe: string | null, peutModifier: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, assignes: Array<{ id: string, nom: string }>, clotureePar: { id: string, nom: string } | null, realiseePar: { id: string, nom: string } | null, fiche: { id: string, slug: string, titre: string } | null };

export type DeclinaisonsProposeesQueryVariables = Exact<{
  slug: string;
  editionId: string | number;
}>;


export type DeclinaisonsProposeesQuery = { perimetre: { id: string, declinaisonsProposees: Array<{ id: string, titre: string, description: string | null, echeance: string | null, origine: { id: string, perimetre: { slug: string, nom: string, couleur: string | null } } | null }> } | null };

export type DeclinaisonsTacheQueryVariables = Exact<{
  id: string | number;
}>;


export type DeclinaisonsTacheQuery = { tache: { id: string, declinaisons: Array<{ id: string, titre: string, echeance: string | null, statut: StatutTache, enRetard: boolean, accord: AccordDeclinaison | null, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, historiqueAccord: Array<{ etape: EtapeAccord, le: string, par: { id: string, nom: string } }> }> } };

export type DeclinerTacheMutationVariables = Exact<{
  id: string | number;
  perimetreIds: Array<string | number> | string | number;
  titre?: string | null | undefined;
  description?: string | null | undefined;
  echeance?: string | null | undefined;
}>;


export type DeclinerTacheMutation = { declinerTache: { id: string, titre: string, description: string | null, echeance: string | null, statut: StatutTache, version: number, enRetard: boolean, termineeLe: string | null, peutModifier: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, assignes: Array<{ id: string, nom: string }>, clotureePar: { id: string, nom: string } | null, realiseePar: { id: string, nom: string } | null, fiche: { id: string, slug: string, titre: string } | null } };

export type AccorderDeclinaisonMutationVariables = Exact<{
  id: string | number;
  accepter: boolean;
}>;


export type AccorderDeclinaisonMutation = { accorderDeclinaison: { id: string, accord: AccordDeclinaison | null } };

export type ImposerDeclinaisonMutationVariables = Exact<{
  id: string | number;
}>;


export type ImposerDeclinaisonMutation = { imposerDeclinaison: { id: string, accord: AccordDeclinaison | null } };

export type CreerTacheMutationVariables = Exact<{
  perimetreId: string | number;
  editionId: string | number;
  titre: string;
  description?: string | null | undefined;
  echeance?: string | null | undefined;
  ficheId?: string | number | null | undefined;
  mAssigner?: boolean | null | undefined;
  declinaison?: DeclinaisonInput | null | undefined;
}>;


export type CreerTacheMutation = { creerTache: { id: string, titre: string, description: string | null, echeance: string | null, statut: StatutTache, version: number, enRetard: boolean, termineeLe: string | null, peutModifier: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, assignes: Array<{ id: string, nom: string }>, clotureePar: { id: string, nom: string } | null, realiseePar: { id: string, nom: string } | null, fiche: { id: string, slug: string, titre: string } | null } };

export type ModifierTacheMutationVariables = Exact<{
  id: string | number;
  titre: string;
  description?: string | null | undefined;
  echeance?: string | null | undefined;
  ficheId?: string | number | null | undefined;
  versionAttendue?: number | null | undefined;
  confirmer?: boolean | null | undefined;
}>;


export type ModifierTacheMutation = { modifierTache: { id: string, titre: string, description: string | null, echeance: string | null, statut: StatutTache, version: number, enRetard: boolean, termineeLe: string | null, peutModifier: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, assignes: Array<{ id: string, nom: string }>, clotureePar: { id: string, nom: string } | null, realiseePar: { id: string, nom: string } | null, fiche: { id: string, slug: string, titre: string } | null } };

export type ChangerStatutTacheMutationVariables = Exact<{
  id: string | number;
  statut: StatutTache;
  realiseeParId?: string | number | null | undefined;
  statutAttendu?: StatutTache | null | undefined;
  confirmer?: boolean | null | undefined;
}>;


export type ChangerStatutTacheMutation = { changerStatutTache: { id: string, titre: string, description: string | null, echeance: string | null, statut: StatutTache, version: number, enRetard: boolean, termineeLe: string | null, peutModifier: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, assignes: Array<{ id: string, nom: string }>, clotureePar: { id: string, nom: string } | null, realiseePar: { id: string, nom: string } | null, fiche: { id: string, slug: string, titre: string } | null } };

export type AssignerTacheMutationVariables = Exact<{
  id: string | number;
  assigne: boolean;
  personneId?: string | number | null | undefined;
}>;


export type AssignerTacheMutation = { assignerTache: { id: string, titre: string, description: string | null, echeance: string | null, statut: StatutTache, version: number, enRetard: boolean, termineeLe: string | null, peutModifier: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, assignes: Array<{ id: string, nom: string }>, clotureePar: { id: string, nom: string } | null, realiseePar: { id: string, nom: string } | null, fiche: { id: string, slug: string, titre: string } | null } };

export type AgendaQueryVariables = Exact<{
  editionId: string | number;
  echeances?: boolean | null | undefined;
}>;


export type AgendaQuery = { agenda: { peutGerer: boolean, edition: { id: string, nom: string, statut: StatutEdition }, elements: Array<{ cle: string, sorte: SorteElementAgenda, titre: string, jour: string, jourFin: string | null, description: string | null, dateCleId: string | null, version: number | null, tacheId: string | null, perimetreId: string | null, faite: boolean }> } };

export type ReunionsQueryVariables = Exact<{
  editionId: string | number;
}>;


export type ReunionsQuery = { reunions: Array<{ id: string, titre: string, jour: string, jourFin: string, heureDebut: string, heureFin: string, statut: StatutReunion, lieu: string | null, detailMasque: boolean, estConvoquee: boolean, maReponse: ReponseConvocation | null, perimetre: { id: string } | null }> };

export type SondagesQueryVariables = Exact<{
  editionId: string | number;
}>;


export type SondagesQuery = { sondages: Array<{ id: string, titre: string, statut: StatutSondage, estParticipant: boolean, aRepondu: boolean, participants: number, repondants: number, perimetre: { id: string } | null }> };

export type AffectationsPourAgendaQueryVariables = Exact<{
  editionId: string | number;
}>;


export type AffectationsPourAgendaQuery = { moi: { id: string, affectations: Array<{ id: string, perimetre: { id: string } }> } | null };

export type SupprimerDateCleMutationVariables = Exact<{
  id: string | number;
}>;


export type SupprimerDateCleMutation = { supprimerDateCle: boolean };

export type AppelBenevolesPublicQueryVariables = Exact<{
  jeton: string;
}>;


export type AppelBenevolesPublicQuery = { appelBenevolesPublic: { organisation: string, activite: string, periode: string, introduction: string | null, contact: string, ouAilleurs: boolean, jours: Array<string>, sequences: Array<{ ref: string, titre: string, jour: string, jourFin: string, heureDebut: string, heureFin: string, lieu: string | null, lieuDescription: string | null, perimetre: string | null, couleur: string | null, consignes: string | null, placesRecherchees: number, complete: boolean }> } | null };

export type DeposerCandidatureMutationVariables = Exact<{
  jeton: string;
  nom: string;
  email: string;
  telephone?: string | null | undefined;
  sequences: Array<string> | string;
  ouAilleurs?: boolean | null | undefined;
  plages?: Array<PlageDisponibiliteInput> | PlageDisponibiliteInput | null | undefined;
  precisions?: string | null | undefined;
  message?: string | null | undefined;
  accord: boolean;
  siteWeb?: string | null | undefined;
}>;


export type DeposerCandidatureMutation = { deposerCandidature: boolean };

export type CreerBenevoleMutationVariables = Exact<{
  activiteId: string | number;
  nom: string;
  courriel?: string | null | undefined;
  telephone?: string | null | undefined;
  note?: string | null | undefined;
  prevenirParMail?: boolean | null | undefined;
  accord: boolean;
}>;


export type CreerBenevoleMutation = { creerBenevole: { id: string } };

export type ModifierBenevoleMutationVariables = Exact<{
  id: string | number;
  nom: string;
  courriel?: string | null | undefined;
  telephone?: string | null | undefined;
  note?: string | null | undefined;
  prevenirParMail?: boolean | null | undefined;
}>;


export type ModifierBenevoleMutation = { modifierBenevole: { id: string } };

export type SupprimerBenevoleMutationVariables = Exact<{
  id: string | number;
}>;


export type SupprimerBenevoleMutation = { supprimerBenevole: boolean };

export type EspaceBenevoleQueryVariables = Exact<{
  jeton: string;
}>;


export type EspaceBenevoleQuery = { espaceBenevole: { organisation: string, activite: string, nom: string, confirme: boolean, contact: string | null, ics: string, places: Array<{ ref: string, titre: string, jour: string, jourFin: string, heureDebut: string, heureFin: string, lieu: string | null, perimetre: string | null, consignes: string | null, confirmee: boolean }>, plages: Array<{ jour: string, jourFin: string, heureDebut: string, heureFin: string }> } | null };

export type ConfirmerParticipationMutationVariables = Exact<{
  jeton: string;
}>;


export type ConfirmerParticipationMutation = { confirmerParticipation: boolean };

export type QuitterPlaceMutationVariables = Exact<{
  jeton: string;
  ref: string;
}>;


export type QuitterPlaceMutation = { quitterPlace: boolean };

export type SupprimerMaFicheMutationVariables = Exact<{
  jeton: string;
}>;


export type SupprimerMaFicheMutation = { supprimerMaFiche: boolean };

export type PerimetreCibleFicheQueryVariables = Exact<{
  slug: string;
}>;


export type PerimetreCibleFicheQuery = { perimetre: { id: string, nom: string, peutRedigerFiches: boolean } | null };

export type DroitFichesCommunesQueryVariables = Exact<{ [key: string]: never; }>;


export type DroitFichesCommunesQuery = { peutRedigerFichesCommunes: boolean };

export type MesTachesQueryVariables = Exact<{
  editionId: string | number;
}>;


export type MesTachesQuery = { moi: { id: string, affectations: Array<{ id: string, perimetre: { id: string, slug: string, nom: string, groupe: string, couleur: string | null, referents: Array<{ id: string, nom: string }>, avancement: { total: number, faites: number, abandonnees: number, enRetard: number, sansPersonne: number } } }> } | null, mesTaches: Array<{ id: string, titre: string, description: string | null, echeance: string | null, statut: StatutTache, version: number, enRetard: boolean, termineeLe: string | null, peutModifier: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, assignes: Array<{ id: string, nom: string }>, clotureePar: { id: string, nom: string } | null, realiseePar: { id: string, nom: string } | null, fiche: { id: string, slug: string, titre: string } | null }>, tachesAPrendre: Array<{ id: string, titre: string, description: string | null, echeance: string | null, statut: StatutTache, version: number, enRetard: boolean, termineeLe: string | null, peutModifier: boolean, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, assignes: Array<{ id: string, nom: string }>, clotureePar: { id: string, nom: string } | null, realiseePar: { id: string, nom: string } | null, fiche: { id: string, slug: string, titre: string } | null }> };

export type OrganigrammeQueryVariables = Exact<{ [key: string]: never; }>;


export type OrganigrammeQuery = { organigramme: { complet: boolean, adresses: AdressesOrganigramme, contactActivite: string | null, edition: { id: string, nom: string } | null, admins: Array<{ personneId: string, nom: string, adresse: string | null, moi: boolean }>, perimetres: Array<{ perimetre: { id: string, slug: string, nom: string, groupe: string, couleur: string | null }, referents: Array<{ personneId: string, nom: string, adresse: string | null, contactPrincipal: boolean, moi: boolean }> }> } };

export type PagePerimetreQueryVariables = Exact<{
  slug: string;
  editionId: string | number;
}>;


export type PagePerimetreQuery = { moi: { id: string } | null, perimetre: { id: string, nom: string, description: string | null, groupe: string, couleur: string | null, acces: AccesPerimetre, peutModifier: boolean, referents: Array<{ id: string, nom: string }>, contactPrincipal: { id: string } | null, avancement: { total: number, aFaire: number, enCours: number, faites: number, abandonnees: number, enRetard: number, sansPersonne: number }, taches: Array<{ id: string, titre: string, description: string | null, echeance: string | null, statut: StatutTache, version: number, enRetard: boolean, termineeLe: string | null, peutModifier: boolean, origine: { id: string, perimetre: { slug: string, nom: string, couleur: string | null } } | null, resumeDeclinaisons: { total: number, enAttente: number, refusees: number, acceptees: number, faites: number, abandonnees: number }, perimetre: { id: string, slug: string, nom: string, couleur: string | null }, assignes: Array<{ id: string, nom: string }>, clotureePar: { id: string, nom: string } | null, realiseePar: { id: string, nom: string } | null, fiche: { id: string, slug: string, titre: string } | null }> } | null, fichesCommunes: Array<{ id: string, titre: string, perimetre: { id: string } | null }> };

export type FichesDuPerimetreQueryVariables = Exact<{
  slug: string;
}>;


export type FichesDuPerimetreQuery = { perimetre: { id: string, peutRedigerFiches: boolean, peutMasquerFichesConnexes: boolean, fiches: Array<{ id: string, slug: string, titre: string }>, fichesConnexes: Array<{ id: string, slug: string, titre: string, perimetre: { id: string, nom: string, couleur: string | null } | null, connexions: Array<{ masquee: boolean, perimetre: { id: string } }> }> } | null };

export type MesPreferencesNotificationQueryVariables = Exact<{ [key: string]: never; }>;


export type MesPreferencesNotificationQuery = { mesPreferencesNotification: { frequenceResume: FrequenceResume, mailModification: boolean, mailEcheance: boolean, mailDemandes: boolean, applicationPerimetre: boolean, pushTaches: boolean, pushEcheances: boolean, pushDemandes: boolean, pushEquipe: boolean, pushAgenda: boolean, applicationEquipe: boolean, resumeAdmin: boolean } };

export type ModifierPreferencesNotificationMutationVariables = Exact<{
  frequenceResume: FrequenceResume;
  mailModification: boolean;
  mailEcheance: boolean;
  mailDemandes?: boolean | null | undefined;
  applicationPerimetre?: boolean | null | undefined;
  applicationEquipe?: boolean | null | undefined;
  resumeAdmin?: boolean | null | undefined;
}>;


export type ModifierPreferencesNotificationMutation = { modifierPreferencesNotification: { frequenceResume: FrequenceResume, mailModification: boolean, mailEcheance: boolean, mailDemandes: boolean, applicationPerimetre: boolean, applicationEquipe: boolean, resumeAdmin: boolean } };

export type ModifierMonNomMutationVariables = Exact<{
  nom: string;
}>;


export type ModifierMonNomMutation = { modifierMonNom: { id: string, nom: string } };

export type ProgrammeQueryVariables = Exact<{
  editionId: string | number;
  mesSequences?: boolean | null | undefined;
}>;


export type ProgrammeQuery = { programme: Array<{ id: string, editionId: string, titre: string, description: string | null, besoinBenevoles: number | null, consignesBenevoles: string | null, renforts: number, jour: string, jourFin: string, heureDebut: string, heureFin: string, version: number, peutModifier: boolean, perimetre: { id: string, nom: string, couleur: string | null } | null, lieu: { id: string, nom: string } | null, places: Array<{ id: string, role: RolePlace, personneId: string | null, benevoleId: string | null, nom: string, estMoi: boolean, etat: EtatPlace }> }> };

export type FormulaireRejoindreQueryVariables = Exact<{
  organisation?: string | null | undefined;
  activite: string;
}>;


export type FormulaireRejoindreQuery = { formulaireRejoindre: { organisation: string, activite: string, periode: string, introduction: string | null, question: string | null, paliers: Array<string>, contact: string, appelBenevoles: string | null, groupes: Array<{ libelle: string, perimetres: Array<{ slug: string, nom: string, description: string | null, couleur: string | null }> }> } | null };

export type EnvoyerDemandeMutationVariables = Exact<{
  organisation?: string | null | undefined;
  activite: string;
  nom: string;
  email: string;
  perimetres: Array<string> | string;
  disponibilite?: string | null | undefined;
  reponse?: string | null | undefined;
  texte?: string | null | undefined;
  siteWeb?: string | null | undefined;
}>;


export type EnvoyerDemandeMutation = { envoyerDemande: boolean };

export type RetroplanningQueryVariables = Exact<{
  editionId: string | number;
}>;


export type RetroplanningQuery = { moi: { id: string, estAdmin: boolean | null, affectations: Array<{ id: string, perimetre: { id: string } }> } | null, retroplanning: Array<{ id: string, titre: string, echeance: string | null, statut: StatutTache, enRetard: boolean, perimetre: { id: string, slug: string, nom: string, groupe: string, couleur: string | null, ordre: number }, assignes: Array<{ id: string, nom: string }>, origine: { id: string } | null }> };

export type TousLesPerimetresQueryVariables = Exact<{ [key: string]: never; }>;


export type TousLesPerimetresQuery = { tousLesPerimetres: { edition: { id: string, nom: string } | null, perimetres: Array<{ affecte: boolean, souhaite: boolean, personnesRecherchees: number | null, perimetre: { id: string, slug: string, nom: string, description: string | null, groupe: string, couleur: string | null } }> } };

export type FormulerSouhaitMutationVariables = Exact<{
  perimetreId: string | number;
  editionId: string | number;
}>;


export type FormulerSouhaitMutation = { formulerSouhait: boolean };

export type RetirerMonSouhaitMutationVariables = Exact<{
  perimetreId: string | number;
  editionId: string | number;
}>;


export type RetirerMonSouhaitMutation = { retirerMonSouhait: boolean };

export type CreerActiviteMutationVariables = Exact<{
  slug: string;
  nom: string;
  sigle?: string | null | undefined;
  nature: NatureActivite;
  groupes?: Array<GroupePerimetresInput> | GroupePerimetresInput | null | undefined;
  ordre?: number | null | undefined;
}>;


export type CreerActiviteMutation = { creerActivite: { id: string, slug: string } };

export type ModifierActiviteMutationVariables = Exact<{
  id: string | number;
  nom: string;
  sigle?: string | null | undefined;
  nature: NatureActivite;
  groupes: Array<GroupePerimetresInput> | GroupePerimetresInput;
  phases?: Array<PhaseInput> | PhaseInput | null | undefined;
  ordre: number;
  archive?: boolean | null | undefined;
  souhaitsOuverts?: boolean | null | undefined;
  formulaire?: FormulaireInput | null | undefined;
  formulaireOuvert?: boolean | null | undefined;
  adressesOrganigramme?: AdressesOrganigramme | null | undefined;
  modules?: Array<ModuleActivite> | ModuleActivite | null | undefined;
}>;


export type ModifierActiviteMutation = { modifierActivite: { id: string } };

export type ModifierIdentiteActiviteMutationVariables = Exact<{
  id: string | number;
  contactRecrutement?: string | null | undefined;
  pageEquipe?: string | null | undefined;
  logoPng?: string | null | undefined;
  logoSvg?: string | null | undefined;
  theme?: unknown;
}>;


export type ModifierIdentiteActiviteMutation = { modifierIdentiteActivite: { id: string } };

export type AdminsOrganisationQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminsOrganisationQuery = { adminsOrganisation: Array<{ id: string, nom: string }> };

export type AnnuaireAdminsQueryVariables = Exact<{ [key: string]: never; }>;


export type AnnuaireAdminsQuery = { personnes: Array<{ id: string, nom: string, estAdmin: boolean | null }> };

export type AdminsActiviteQueryVariables = Exact<{
  activiteId: string | number;
}>;


export type AdminsActiviteQuery = { equipe: Array<{ id: string, nom: string, activitesAdministrees: Array<string> }> };

export type DefinirAdminOrganisationMutationVariables = Exact<{
  id: string | number;
  nom: string;
  estAdmin: boolean;
}>;


export type DefinirAdminOrganisationMutation = { modifierPersonne: { id: string, estAdmin: boolean | null } };

export type ClassementQueryVariables = Exact<{
  editionId: string | number;
}>;


export type ClassementQuery = { classement: Array<{ rang: number, personne: { id: string, nom: string }, score: { points: number, tachesRealisees: number, tachesATemps: number, tachesCreees: number, fichesCreees: number, fichesModifiees: number } }> };

export type ModifierEditionMutationVariables = Exact<{
  id: string | number;
  nom: string;
  debut: string;
  fin: string;
  statut: StatutEdition;
}>;


export type ModifierEditionMutation = { modifierEdition: { id: string, nom: string, debut: string, fin: string, statut: StatutEdition } };

export type PostesAPourvoirQueryVariables = Exact<{
  editionId: string | number;
  annuaire: boolean;
}>;


export type PostesAPourvoirQuery = { appelPostes: string | null, postesAPourvoir: Array<{ effectif: number | null, aPourvoir: number, etat: EtatPostes, demandesEnAttente: number, perimetre: { id: string, slug: string, nom: string, groupe: string, couleur: string | null, description: string | null, ordre: number, archive: boolean, version: number }, affectations: Array<{ id: string, contactPrincipal: boolean, personne: { id: string, nom: string } }>, souhaits: Array<{ id: string, personne: { id: string, nom: string } }> }>, equipe: Array<{ id: string, nom: string, estAdmin: boolean | null }>, personnes?: Array<{ id: string, nom: string, attributions: Array<{ activiteId: string }> }> };

export type DefinirEffectifMutationVariables = Exact<{
  perimetreId: string | number;
  editionId: string | number;
  effectif: number;
}>;


export type DefinirEffectifMutation = { definirEffectif: number };

export type DefinirContactPrincipalMutationVariables = Exact<{
  id: string | number;
  contactPrincipal: boolean;
}>;


export type DefinirContactPrincipalMutation = { definirContactPrincipal: boolean };

export type RetirerSouhaitMutationVariables = Exact<{
  id: string | number;
}>;


export type RetirerSouhaitMutation = { retirerSouhait: boolean };

export type SimulerImportEquipeQueryVariables = Exact<{
  editionId: string | number;
  lignes: Array<LigneEquipeImport> | LigneEquipeImport;
}>;


export type SimulerImportEquipeQuery = { simulerImportEquipe: { personnes: number, lignes: Array<{ ligne: number, etat: EtatLigneImport, raison: string | null, avertissements: Array<string> }> } };

export type ImporterEquipeMutationVariables = Exact<{
  editionId: string | number;
  lignes: Array<LigneEquipeImport> | LigneEquipeImport;
  envoyerMails?: boolean | null | undefined;
}>;


export type ImporterEquipeMutation = { importerEquipe: { personnes: number, invitationsEnAttente: number, affectationsCreees: number, contactsPrincipaux: number, mailsInvitations: number, mailsEquipe: number, lignes: Array<{ ligne: number, etat: EtatLigneImport, raison: string | null, avertissements: Array<string> }> } };

export type SimulerImportTachesQueryVariables = Exact<{
  editionId: string | number;
  lignes: Array<LigneTacheImport> | LigneTacheImport;
  groupeNouveaux?: string | null | undefined;
  enregistrerTachesTypes?: boolean | null | undefined;
}>;


export type SimulerImportTachesQuery = { simulerImportTaches: { perimetresCrees: Array<string>, tachesTypesAjoutees: number, lignes: Array<{ ligne: number, etat: EtatLigneImport, raison: string | null, avertissements: Array<string> }> } };

export type ImporterTachesMutationVariables = Exact<{
  editionId: string | number;
  lignes: Array<LigneTacheImport> | LigneTacheImport;
  groupeNouveaux?: string | null | undefined;
  enregistrerTachesTypes?: boolean | null | undefined;
}>;


export type ImporterTachesMutation = { importerTaches: { perimetresCrees: Array<string>, tachesTypesAjoutees: number, lignes: Array<{ ligne: number, etat: EtatLigneImport, raison: string | null, avertissements: Array<string> }> } };

export type IdentiteOrganisationQueryVariables = Exact<{ [key: string]: never; }>;


export type IdentiteOrganisationQuery = { identiteOrganisation: { slug: string, nom: string, sigle: string | null, contactRecrutement: string | null, contactSupport: string | null, pageEquipe: string | null, langue: string | null, domainesCourrielAutorises: Array<string>, adressesRoleAutorisees: Array<string>, expediteurRecoitReponses: boolean, logoPng: string | null, logoSvg: string | null, favicon: string | null, iconeApplication: string | null, theme: unknown, contenuModifieLe: string | null, contenuSynchroniseLe: string | null } };

export type ModifierIdentiteOrganisationMutationVariables = Exact<{
  nom: string;
  sigle?: string | null | undefined;
  contactRecrutement?: string | null | undefined;
  contactSupport?: string | null | undefined;
  pageEquipe?: string | null | undefined;
  langue?: string | null | undefined;
  domainesCourrielAutorises: Array<string> | string;
  adressesRoleAutorisees: Array<string> | string;
  logoPng?: string | null | undefined;
  logoSvg?: string | null | undefined;
  favicon?: string | null | undefined;
  iconeApplication?: string | null | undefined;
  theme?: unknown;
}>;


export type ModifierIdentiteOrganisationMutation = { modifierIdentiteOrganisation: { nom: string } };

export type ExportContenuQueryVariables = Exact<{ [key: string]: never; }>;


export type ExportContenuQuery = { exportContenu: { nomFichier: string, donnees: string } };

export type PersonnesQueryVariables = Exact<{
  inclureArchives?: boolean | null | undefined;
  editionId?: string | number | null | undefined;
}>;


export type PersonnesQuery = { personnes: Array<{ id: string, nom: string, email: string, estAdmin: boolean | null, activitesAdministrees: Array<string>, archive: boolean, nomModifiable: boolean, affectations: Array<{ id: string, contactPrincipal: boolean, perimetre: { id: string, nom: string, couleur: string | null } }>, souhaits: Array<{ id: string, satisfait: boolean, perimetre: { id: string, nom: string, couleur: string | null } }>, attributions: Array<{ activiteId: string, rattachee: boolean, affectee: boolean, interessee: boolean, admin: boolean }> }> };

export type PersonnesEquipeQueryVariables = Exact<{
  editionId?: string | number | null | undefined;
  gereOrganisation: boolean;
}>;


export type PersonnesEquipeQuery = { equipe: Array<{ id: string, nom: string, email: string, estAdmin: boolean | null, activitesAdministrees: Array<string>, archive: boolean, nomModifiable?: boolean, affectations: Array<{ id: string, contactPrincipal: boolean, perimetre: { id: string, nom: string, couleur: string | null } }>, souhaits: Array<{ id: string, satisfait: boolean, perimetre: { id: string, nom: string, couleur: string | null } }> }> };

export type DemandesEnAttenteQueryVariables = Exact<{
  editionId: string | number;
}>;


export type DemandesEnAttenteQuery = { demandes: Array<{ id: string }> };

export type SouhaitsActiviteQueryVariables = Exact<{
  activiteId: string | number;
}>;


export type SouhaitsActiviteQuery = { editionCourante: { id: string, nom: string } | null, perimetres: Array<{ id: string, nom: string, groupe: string }> };

export type SouhaitsEditionQueryVariables = Exact<{
  activiteId: string | number;
  editionId: string | number;
}>;


export type SouhaitsEditionQuery = { equipe: Array<{ id: string, affectations: Array<{ id: string, perimetre: { id: string } }>, souhaits: Array<{ id: string, perimetre: { id: string } }> }> };

export type InviterPersonneMutationVariables = Exact<{
  email: string;
  nom: string;
  activiteId?: string | number | null | undefined;
  editionId?: string | number | null | undefined;
  perimetresSouhaites?: Array<string | number> | string | number | null | undefined;
  perimetresAffectes?: Array<string | number> | string | number | null | undefined;
}>;


export type InviterPersonneMutation = { inviterPersonne: { enAttente: boolean, personne: { id: string } | null } };

export type ModifierPersonneMutationVariables = Exact<{
  id: string | number;
  nom: string;
  estAdmin: boolean;
}>;


export type ModifierPersonneMutation = { modifierPersonne: { id: string, nom: string, estAdmin: boolean | null } };

export type ArchiverPersonneMutationVariables = Exact<{
  id: string | number;
  archive: boolean;
}>;


export type ArchiverPersonneMutation = { archiverPersonne: { id: string, archive: boolean } };

export type DefinirSouhaitsMutationVariables = Exact<{
  personneId: string | number;
  editionId: string | number;
  perimetreIds: Array<string | number> | string | number;
}>;


export type DefinirSouhaitsMutation = { definirSouhaits: Array<{ id: string }> };

export type RattacherAlActiviteMutationVariables = Exact<{
  userId: string | number;
  activiteId: string | number;
}>;


export type RattacherAlActiviteMutation = { rattacherALActivite: boolean };

export type RetirerDeLActiviteMutationVariables = Exact<{
  userId: string | number;
  activiteId: string | number;
}>;


export type RetirerDeLActiviteMutation = { retirerDeLActivite: boolean };

export type RenvoyerInvitationMutationVariables = Exact<{
  id: string | number;
}>;


export type RenvoyerInvitationMutation = { renvoyerInvitation: boolean };

export type DroitsRedactionQueryVariables = Exact<{
  annuaire: boolean;
}>;


export type DroitsRedactionQuery = { droitsRedaction: Array<{ id: string, accordeLe: string, personne: { id: string, nom: string }, perimetre: { id: string, nom: string, activite: { id: string } } | null }>, adminsOrganisation: Array<{ id: string, nom: string }>, equipe: Array<{ id: string, nom: string, estAdmin: boolean | null, activitesAdministrees: Array<string> }>, personnes?: Array<{ id: string, nom: string, estAdmin: boolean | null, activitesAdministrees: Array<string> }> };

export type AccorderDroitRedactionMutationVariables = Exact<{
  personneId: string | number;
  perimetreId?: string | number | null | undefined;
}>;


export type AccorderDroitRedactionMutation = { accorderDroitRedaction: { id: string } };

export type RetirerDroitRedactionMutationVariables = Exact<{
  id: string | number;
}>;


export type RetirerDroitRedactionMutation = { retirerDroitRedaction: boolean };

export const FilChampsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FilChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FilTache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"nombreCommentaires"}},{"kind":"Field","name":{"kind":"Name","value":"peutCommenter"}},{"kind":"Field","name":{"kind":"Name","value":"commentaires"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"texte"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"modifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"peutSupprimer"}},{"kind":"Field","name":{"kind":"Name","value":"auteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"evenements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"le"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"acteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<FilChampsFragment, unknown>;
export const ThemeChampsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ThemeChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Theme"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couleurs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encre"}},{"kind":"Field","name":{"kind":"Name","value":"primaire"}},{"kind":"Field","name":{"kind":"Name","value":"primaireClair"}},{"kind":"Field","name":{"kind":"Name","value":"accent"}},{"kind":"Field","name":{"kind":"Name","value":"accentClair"}},{"kind":"Field","name":{"kind":"Name","value":"accentTexte"}},{"kind":"Field","name":{"kind":"Name","value":"succes"}},{"kind":"Field","name":{"kind":"Name","value":"succesClair"}},{"kind":"Field","name":{"kind":"Name","value":"alerte"}},{"kind":"Field","name":{"kind":"Name","value":"alerteClair"}},{"kind":"Field","name":{"kind":"Name","value":"erreur"}},{"kind":"Field","name":{"kind":"Name","value":"erreurClair"}},{"kind":"Field","name":{"kind":"Name","value":"sol1"}},{"kind":"Field","name":{"kind":"Name","value":"sol2"}},{"kind":"Field","name":{"kind":"Name","value":"sol3"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fond"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transition"}},{"kind":"Field","name":{"kind":"Name","value":"halo1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"intensite"}}]}},{"kind":"Field","name":{"kind":"Name","value":"halo2"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"intensite"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"polices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"texte"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"mono"}}]}},{"kind":"Field","name":{"kind":"Name","value":"typographie"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"graisseTitre"}},{"kind":"Field","name":{"kind":"Name","value":"graisseCorps"}},{"kind":"Field","name":{"kind":"Name","value":"espacementTitre"}},{"kind":"Field","name":{"kind":"Name","value":"echelleTitre"}}]}}]}}]} as unknown as DocumentNode<ThemeChampsFragment, unknown>;
export const NotificationAfficheeFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NotificationAffichee"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Notification"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"niveau"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"lien"}},{"kind":"Field","name":{"kind":"Name","value":"lue"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"periode"}},{"kind":"Field","name":{"kind":"Name","value":"activite"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]} as unknown as DocumentNode<NotificationAfficheeFragment, unknown>;
export const TacheChampsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TacheChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Tache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"termineeLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"clotureePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realiseePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiche"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}}]}}]} as unknown as DocumentNode<TacheChampsFragment, unknown>;
export const PerimetresAbonnablesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PerimetresAbonnables"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}},{"kind":"Field","name":{"kind":"Name","value":"acces"}}]}}]}}]} as unknown as DocumentNode<PerimetresAbonnablesQuery, PerimetresAbonnablesQueryVariables>;
export const MonAbonnementAgendaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MonAbonnementAgenda"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"monAbonnementAgenda"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fin"}},{"kind":"Field","name":{"kind":"Name","value":"perimetreIds"}},{"kind":"Field","name":{"kind":"Name","value":"inclurePhases"}},{"kind":"Field","name":{"kind":"Name","value":"inclureDatesCles"}},{"kind":"Field","name":{"kind":"Name","value":"inclureReunions"}},{"kind":"Field","name":{"kind":"Name","value":"inclureEcheances"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"dernierAccesLe"}}]}}]}}]} as unknown as DocumentNode<MonAbonnementAgendaQuery, MonAbonnementAgendaQueryVariables>;
export const CreerMonAbonnementAgendaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerMonAbonnementAgenda"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclurePhases"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureDatesCles"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureReunions"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureEcheances"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerMonAbonnementAgenda"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perimetreIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclurePhases"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclurePhases"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureDatesCles"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureDatesCles"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureReunions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureReunions"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureEcheances"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureEcheances"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adresse"}},{"kind":"Field","name":{"kind":"Name","value":"abonnement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<CreerMonAbonnementAgendaMutation, CreerMonAbonnementAgendaMutationVariables>;
export const ReglerMonAbonnementAgendaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReglerMonAbonnementAgenda"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclurePhases"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureDatesCles"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureReunions"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureEcheances"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reglerMonAbonnementAgenda"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perimetreIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclurePhases"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclurePhases"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureDatesCles"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureDatesCles"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureReunions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureReunions"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureEcheances"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureEcheances"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"perimetreIds"}},{"kind":"Field","name":{"kind":"Name","value":"inclurePhases"}},{"kind":"Field","name":{"kind":"Name","value":"inclureDatesCles"}},{"kind":"Field","name":{"kind":"Name","value":"inclureReunions"}},{"kind":"Field","name":{"kind":"Name","value":"inclureEcheances"}}]}}]}}]} as unknown as DocumentNode<ReglerMonAbonnementAgendaMutation, ReglerMonAbonnementAgendaMutationVariables>;
export const RevoquerMonAbonnementAgendaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevoquerMonAbonnementAgenda"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revoquerMonAbonnementAgenda"}}]}}]} as unknown as DocumentNode<RevoquerMonAbonnementAgendaMutation, RevoquerMonAbonnementAgendaMutationVariables>;
export const AbonnementAgendaActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AbonnementAgendaActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"abonnementAgendaActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fin"}},{"kind":"Field","name":{"kind":"Name","value":"inclurePhases"}},{"kind":"Field","name":{"kind":"Name","value":"inclureDatesCles"}},{"kind":"Field","name":{"kind":"Name","value":"inclureReunions"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"dernierAccesLe"}}]}}]}}]} as unknown as DocumentNode<AbonnementAgendaActiviteQuery, AbonnementAgendaActiviteQueryVariables>;
export const CreerAbonnementAgendaActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerAbonnementAgendaActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclurePhases"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureDatesCles"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureReunions"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerAbonnementAgendaActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclurePhases"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclurePhases"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureDatesCles"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureDatesCles"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureReunions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureReunions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adresse"}}]}}]}}]} as unknown as DocumentNode<CreerAbonnementAgendaActiviteMutation, CreerAbonnementAgendaActiviteMutationVariables>;
export const ReglerAbonnementAgendaActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReglerAbonnementAgendaActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclurePhases"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureDatesCles"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureReunions"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reglerAbonnementAgendaActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclurePhases"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclurePhases"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureDatesCles"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureDatesCles"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureReunions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureReunions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"inclurePhases"}},{"kind":"Field","name":{"kind":"Name","value":"inclureDatesCles"}},{"kind":"Field","name":{"kind":"Name","value":"inclureReunions"}}]}}]}}]} as unknown as DocumentNode<ReglerAbonnementAgendaActiviteMutation, ReglerAbonnementAgendaActiviteMutationVariables>;
export const RevoquerAbonnementAgendaActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevoquerAbonnementAgendaActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revoquerAbonnementAgendaActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}]}]}}]} as unknown as DocumentNode<RevoquerAbonnementAgendaActiviteMutation, RevoquerAbonnementAgendaActiviteMutationVariables>;
export const SequencesPourAppelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SequencesPourAppel"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"programme"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"besoinBenevoles"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<SequencesPourAppelQuery, SequencesPourAppelQueryVariables>;
export const CreerAppelBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerAppelBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portee"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PorteeAppel"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sequenceId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"introduction"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ouvertLe"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fermeLe"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerAppelBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"portee"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portee"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sequenceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sequenceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"introduction"},"value":{"kind":"Variable","name":{"kind":"Name","value":"introduction"}}},{"kind":"Argument","name":{"kind":"Name","value":"ouvertLe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ouvertLe"}}},{"kind":"Argument","name":{"kind":"Name","value":"fermeLe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fermeLe"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adresse"}}]}}]}}]} as unknown as DocumentNode<CreerAppelBenevolesMutation, CreerAppelBenevolesMutationVariables>;
export const ModifierAppelBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierAppelBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"introduction"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ouvertLe"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fermeLe"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierAppelBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"introduction"},"value":{"kind":"Variable","name":{"kind":"Name","value":"introduction"}}},{"kind":"Argument","name":{"kind":"Name","value":"ouvertLe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ouvertLe"}}},{"kind":"Argument","name":{"kind":"Name","value":"fermeLe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fermeLe"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionAttendue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ModifierAppelBenevolesMutation, ModifierAppelBenevolesMutationVariables>;
export const FermerAppelBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FermerAppelBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fermerAppelBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<FermerAppelBenevolesMutation, FermerAppelBenevolesMutationVariables>;
export const RouvrirAppelBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RouvrirAppelBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rouvrirAppelBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RouvrirAppelBenevolesMutation, RouvrirAppelBenevolesMutationVariables>;
export const RenouvelerAdresseAppelBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RenouvelerAdresseAppelBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"renouvelerAdresseAppelBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adresse"}}]}}]}}]} as unknown as DocumentNode<RenouvelerAdresseAppelBenevolesMutation, RenouvelerAdresseAppelBenevolesMutationVariables>;
export const AccepterChoixCandidatureDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AccepterChoixCandidature"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accepterChoixCandidature"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AccepterChoixCandidatureMutation, AccepterChoixCandidatureMutationVariables>;
export const RefuserChoixCandidatureDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefuserChoixCandidature"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refuserChoixCandidature"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RefuserChoixCandidatureMutation, RefuserChoixCandidatureMutationVariables>;
export const RefuserCandidatureDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefuserCandidature"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refuserCandidature"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RefuserCandidatureMutation, RefuserCandidatureMutationVariables>;
export const MonScoreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MonScore"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"monScore"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"tachesRealisees"}},{"kind":"Field","name":{"kind":"Name","value":"tachesATemps"}},{"kind":"Field","name":{"kind":"Name","value":"tachesCreees"}},{"kind":"Field","name":{"kind":"Name","value":"fichesCreees"}},{"kind":"Field","name":{"kind":"Name","value":"fichesModifiees"}}]}},{"kind":"Field","name":{"kind":"Name","value":"baremeScore"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tacheRealisee"}},{"kind":"Field","name":{"kind":"Name","value":"bonusATemps"}},{"kind":"Field","name":{"kind":"Name","value":"tacheCreee"}},{"kind":"Field","name":{"kind":"Name","value":"ficheCreee"}},{"kind":"Field","name":{"kind":"Name","value":"ficheModifiee"}}]}}]}}]} as unknown as DocumentNode<MonScoreQuery, MonScoreQueryVariables>;
export const MenuPerimetresDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MenuPerimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"affectations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"edition"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}},{"kind":"Field","name":{"kind":"Name","value":"activite"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<MenuPerimetresQuery, MenuPerimetresQueryVariables>;
export const CreerDateCleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerDateCle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jour"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerDateCle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"jour"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jour"}}},{"kind":"Argument","name":{"kind":"Name","value":"jourFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreerDateCleMutation, CreerDateCleMutationVariables>;
export const ModifierDateCleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierDateCle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jour"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierDateCle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"jour"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jour"}}},{"kind":"Argument","name":{"kind":"Name","value":"jourFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionAttendue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ModifierDateCleMutation, ModifierDateCleMutationVariables>;
export const DemandesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Demandes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"statut"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"StatutDemande"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"demandes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"statut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"statut"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"adresse"}},{"kind":"Field","name":{"kind":"Name","value":"origine"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"dejaMembre"}},{"kind":"Field","name":{"kind":"Name","value":"disponibilite"}},{"kind":"Field","name":{"kind":"Name","value":"question"}},{"kind":"Field","name":{"kind":"Name","value":"reponse"}},{"kind":"Field","name":{"kind":"Name","value":"texte"}},{"kind":"Field","name":{"kind":"Name","value":"traiteePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"mot"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"proposePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]}}]} as unknown as DocumentNode<DemandesQuery, DemandesQueryVariables>;
export const SouhaitsEnAttenteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SouhaitsEnAttente"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"postesAPourvoir"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"souhaits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<SouhaitsEnAttenteQuery, SouhaitsEnAttenteQueryVariables>;
export const AccepterDemandeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AccepterDemande"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"affecter"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accepterDemande"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"affecter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"affecter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}}]}}]} as unknown as DocumentNode<AccepterDemandeMutation, AccepterDemandeMutationVariables>;
export const RefuserDemandeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefuserDemande"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refuserDemande"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}}]}}]} as unknown as DocumentNode<RefuserDemandeMutation, RefuserDemandeMutationVariables>;
export const DecrireActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DecrireActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sigle"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nature"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"NatureActivite"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GroupePerimetresInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"modules"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ModuleActivite"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"sigle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sigle"}}},{"kind":"Argument","name":{"kind":"Name","value":"nature"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nature"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupes"}}},{"kind":"Argument","name":{"kind":"Name","value":"ordre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}}},{"kind":"Argument","name":{"kind":"Name","value":"modules"},"value":{"kind":"Variable","name":{"kind":"Name","value":"modules"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DecrireActiviteMutation, DecrireActiviteMutationVariables>;
export const ConfirmerActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmerActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmerActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"masques"}}]}}]}}]} as unknown as DocumentNode<ConfirmerActiviteMutation, ConfirmerActiviteMutationVariables>;
export const MasquerFicheConnexeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MasquerFicheConnexe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"masquerFicheConnexe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ficheId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<MasquerFicheConnexeMutation, MasquerFicheConnexeMutationVariables>;
export const AfficherFicheConnexeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AfficherFicheConnexe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"afficherFicheConnexe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ficheId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AfficherFicheConnexeMutation, AfficherFicheConnexeMutationVariables>;
export const InviterDansLActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InviterDansLActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetresAffectes"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inviterPersonne"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetresAffectes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetresAffectes"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enAttente"}}]}}]}}]} as unknown as DocumentNode<InviterDansLActiviteMutation, InviterDansLActiviteMutationVariables>;
export const RelancerInvitationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RelancerInvitation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"relancerInvitation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RelancerInvitationMutation, RelancerInvitationMutationVariables>;
export const RetirerInvitationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetirerInvitation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retirerInvitation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RetirerInvitationMutation, RetirerInvitationMutationVariables>;
export const LienEspaceBenevoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LienEspaceBenevole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"benevoleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nouveau"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lienEspaceBenevole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"benevoleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"benevoleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"nouveau"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nouveau"}}}]}]}}]} as unknown as DocumentNode<LienEspaceBenevoleMutation, LienEspaceBenevoleMutationVariables>;
export const RenvoyerLienBenevoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RenvoyerLienBenevole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"benevoleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"renvoyerLienBenevole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"benevoleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"benevoleId"}}}]}]}}]} as unknown as DocumentNode<RenvoyerLienBenevoleMutation, RenvoyerLienBenevoleMutationVariables>;
export const LieuxTousDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LieuxTous"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lieux"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"inclureArchives"},"value":{"kind":"BooleanValue","value":true}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"ordre"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}}]}}]}}]} as unknown as DocumentNode<LieuxTousQuery, LieuxTousQueryVariables>;
export const CreerLieuDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerLieu"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerLieu"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"ordre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreerLieuMutation, CreerLieuMutationVariables>;
export const ModifierLieuDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierLieu"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"archive"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierLieu"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"ordre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}}},{"kind":"Argument","name":{"kind":"Name","value":"archive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"archive"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"ordre"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}}]}}]}}]} as unknown as DocumentNode<ModifierLieuMutation, ModifierLieuMutationVariables>;
export const AfficherPremiersPasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AfficherPremiersPas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"afficherPremiersPas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"masques"}}]}}]}}]} as unknown as DocumentNode<AfficherPremiersPasMutation, AfficherPremiersPasMutationVariables>;
export const AccepterInvitationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AccepterInvitation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accepterInvitation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<AccepterInvitationMutation, AccepterInvitationMutationVariables>;
export const RefuserInvitationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefuserInvitation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refuserInvitation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RefuserInvitationMutation, RefuserInvitationMutationVariables>;
export const SimulerModeleDeDepartDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SimulerModeleDeDepart"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"simulerModeleDeDepart"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"modele"},"value":{"kind":"EnumValue","value":"EVENEMENT_MULTISPORTS"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"tachesTypes"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiches"}},{"kind":"Field","name":{"kind":"Name","value":"groupesAjoutes"}},{"kind":"Field","name":{"kind":"Name","value":"fichesEnConflit"}},{"kind":"Field","name":{"kind":"Name","value":"periode"}},{"kind":"Field","name":{"kind":"Name","value":"tachesCreees"}}]}}]}}]} as unknown as DocumentNode<SimulerModeleDeDepartQuery, SimulerModeleDeDepartQueryVariables>;
export const AppliquerModeleDeDepartDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AppliquerModeleDeDepart"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appliquerModeleDeDepart"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"modele"},"value":{"kind":"EnumValue","value":"EVENEMENT_MULTISPORTS"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"tachesCreees"}}]}}]}}]} as unknown as DocumentNode<AppliquerModeleDeDepartMutation, AppliquerModeleDeDepartMutationVariables>;
export const CreerEditionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerEdition"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"annee"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"debut"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerEdition"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"annee"},"value":{"kind":"Variable","name":{"kind":"Name","value":"annee"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"debut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"debut"}}},{"kind":"Argument","name":{"kind":"Name","value":"fin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreerEditionMutation, CreerEditionMutationVariables>;
export const ModifierMaLangueDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierMaLangue"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"langue"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierMaLangue"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"langue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"langue"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"langue"}}]}}]}}]} as unknown as DocumentNode<ModifierMaLangueMutation, ModifierMaLangueMutationVariables>;
export const MonAdresseVisibleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MonAdresseVisible"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"adresseVisible"}}]}}]}}]} as unknown as DocumentNode<MonAdresseVisibleQuery, MonAdresseVisibleQueryVariables>;
export const ModifierMonAdresseVisibleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierMonAdresseVisible"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"visible"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierMonAdresseVisible"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"visible"},"value":{"kind":"Variable","name":{"kind":"Name","value":"visible"}}}]}]}}]} as unknown as DocumentNode<ModifierMonAdresseVisibleMutation, ModifierMonAdresseVisibleMutationVariables>;
export const ClePubliquePushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ClePubliquePush"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clePubliquePush"}}]}}]} as unknown as DocumentNode<ClePubliquePushQuery, ClePubliquePushQueryVariables>;
export const AbonnePushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AbonnePush"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"abonnePush"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"adresse"},"value":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}}}]}]}}]} as unknown as DocumentNode<AbonnePushQuery, AbonnePushQueryVariables>;
export const AbonnerPushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AbonnerPush"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"p256dh"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"auth"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"agent"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"abonnerPush"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"adresse"},"value":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}}},{"kind":"Argument","name":{"kind":"Name","value":"p256dh"},"value":{"kind":"Variable","name":{"kind":"Name","value":"p256dh"}}},{"kind":"Argument","name":{"kind":"Name","value":"auth"},"value":{"kind":"Variable","name":{"kind":"Name","value":"auth"}}},{"kind":"Argument","name":{"kind":"Name","value":"agent"},"value":{"kind":"Variable","name":{"kind":"Name","value":"agent"}}}]}]}}]} as unknown as DocumentNode<AbonnerPushMutation, AbonnerPushMutationVariables>;
export const ModifierPreferencesPushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierPreferencesPush"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"frequenceResume"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FrequenceResume"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mailModification"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mailEcheance"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pushTaches"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pushEcheances"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pushDemandes"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pushEquipe"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pushAgenda"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierPreferencesNotification"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"frequenceResume"},"value":{"kind":"Variable","name":{"kind":"Name","value":"frequenceResume"}}},{"kind":"Argument","name":{"kind":"Name","value":"mailModification"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mailModification"}}},{"kind":"Argument","name":{"kind":"Name","value":"mailEcheance"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mailEcheance"}}},{"kind":"Argument","name":{"kind":"Name","value":"pushTaches"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pushTaches"}}},{"kind":"Argument","name":{"kind":"Name","value":"pushEcheances"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pushEcheances"}}},{"kind":"Argument","name":{"kind":"Name","value":"pushDemandes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pushDemandes"}}},{"kind":"Argument","name":{"kind":"Name","value":"pushEquipe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pushEquipe"}}},{"kind":"Argument","name":{"kind":"Name","value":"pushAgenda"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pushAgenda"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pushTaches"}},{"kind":"Field","name":{"kind":"Name","value":"pushEcheances"}},{"kind":"Field","name":{"kind":"Name","value":"pushDemandes"}},{"kind":"Field","name":{"kind":"Name","value":"pushEquipe"}},{"kind":"Field","name":{"kind":"Name","value":"pushAgenda"}}]}}]}}]} as unknown as DocumentNode<ModifierPreferencesPushMutation, ModifierPreferencesPushMutationVariables>;
export const MasquerPremiersPasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MasquerPremiersPas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"masquerPremiersPas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"masques"}}]}}]}}]} as unknown as DocumentNode<MasquerPremiersPasMutation, MasquerPremiersPasMutationVariables>;
export const MesPropositionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MesPropositions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mesPropositions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}}]}}]} as unknown as DocumentNode<MesPropositionsQuery, MesPropositionsQueryVariables>;
export const ProposerPersonneDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ProposerPersonne"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mot"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proposerPersonne"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"mot"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mot"}}}]}]}}]} as unknown as DocumentNode<ProposerPersonneMutation, ProposerPersonneMutationVariables>;
export const RetirerPropositionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetirerProposition"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retirerProposition"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RetirerPropositionMutation, RetirerPropositionMutationVariables>;
export const RechercheGlobaleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RechercheGlobale"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"texte"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recherche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"texte"},"value":{"kind":"Variable","name":{"kind":"Name","value":"texte"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"edition"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"activite"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"personnes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"activite"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<RechercheGlobaleQuery, RechercheGlobaleQueryVariables>;
export const SimulerReconductionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SimulerReconduction"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sourceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cibleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"simulerReconduction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sourceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sourceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"cibleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cibleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"statutSource"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"declinaisons"}},{"kind":"Field","name":{"kind":"Name","value":"retenue"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"effectifsCrees"}}]}}]}}]} as unknown as DocumentNode<SimulerReconductionQuery, SimulerReconductionQueryVariables>;
export const ReconduireEditionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReconduireEdition"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sourceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cibleId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tacheIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reconduireEdition"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sourceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sourceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"cibleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cibleId"}}},{"kind":"Argument","name":{"kind":"Name","value":"tacheIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tacheIds"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}}]}}]}}]}}]} as unknown as DocumentNode<ReconduireEditionMutation, ReconduireEditionMutationVariables>;
export const CreerPerimetreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerPerimetre"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupe"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"couleur"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerPerimetre"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupe"}}},{"kind":"Argument","name":{"kind":"Name","value":"couleur"},"value":{"kind":"Variable","name":{"kind":"Name","value":"couleur"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"ordre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreerPerimetreMutation, CreerPerimetreMutationVariables>;
export const ModifierPerimetreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierPerimetre"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupe"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"couleur"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"archive"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierPerimetre"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupe"}}},{"kind":"Argument","name":{"kind":"Name","value":"couleur"},"value":{"kind":"Variable","name":{"kind":"Name","value":"couleur"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"ordre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}}},{"kind":"Argument","name":{"kind":"Name","value":"archive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"archive"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionAttendue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"ordre"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<ModifierPerimetreMutation, ModifierPerimetreMutationVariables>;
export const BenevolesARepartirDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BenevolesARepartir"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sequenceId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"benevolesARepartir"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sequenceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sequenceId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cle"}},{"kind":"Field","name":{"kind":"Name","value":"candidatureId"}},{"kind":"Field","name":{"kind":"Name","value":"benevoleId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"precisionsDisponibilite"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"origine"}},{"kind":"Field","name":{"kind":"Name","value":"ouAilleurs"}},{"kind":"Field","name":{"kind":"Name","value":"adequation"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"plages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choix"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sequenceId"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}},{"kind":"Field","name":{"kind":"Name","value":"places"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sequenceId"}}]}}]}}]}}]} as unknown as DocumentNode<BenevolesARepartirQuery, BenevolesARepartirQueryVariables>;
export const CouvertureProgrammeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CouvertureProgramme"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sansPerimetre"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couvertureProgramme"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"sansPerimetre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sansPerimetre"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"heure"}},{"kind":"Field","name":{"kind":"Name","value":"besoin"}},{"kind":"Field","name":{"kind":"Name","value":"confirmees"}},{"kind":"Field","name":{"kind":"Name","value":"aConfirmer"}},{"kind":"Field","name":{"kind":"Name","value":"disponibles"}}]}}]}}]} as unknown as DocumentNode<CouvertureProgrammeQuery, CouvertureProgrammeQueryVariables>;
export const PlacerBenevoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PlacerBenevole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sequenceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"candidatureId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"benevoleId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"placerBenevole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sequenceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sequenceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"candidatureId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"candidatureId"}}},{"kind":"Argument","name":{"kind":"Name","value":"benevoleId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"benevoleId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<PlacerBenevoleMutation, PlacerBenevoleMutationVariables>;
export const RetirerPlaceSequenceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetirerPlaceSequence"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retirerPlaceSequence"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RetirerPlaceSequenceMutation, RetirerPlaceSequenceMutationVariables>;
export const MonAdresseDeRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MonAdresseDeRole"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"adresseDeRole"}}]}}]}}]} as unknown as DocumentNode<MonAdresseDeRoleQuery, MonAdresseDeRoleQueryVariables>;
export const ReunionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Reunion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reunion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"editionId"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"cible"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"detailMasque"}},{"kind":"Field","name":{"kind":"Name","value":"lieu"}},{"kind":"Field","name":{"kind":"Name","value":"lienVisio"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"taches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"perimetreId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"estConvoquee"}},{"kind":"Field","name":{"kind":"Name","value":"maReponse"}},{"kind":"Field","name":{"kind":"Name","value":"reponses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"presentes"}},{"kind":"Field","name":{"kind":"Name","value":"absentes"}},{"kind":"Field","name":{"kind":"Name","value":"peutEtre"}},{"kind":"Field","name":{"kind":"Name","value":"sansReponse"}}]}},{"kind":"Field","name":{"kind":"Name","value":"convocations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personneId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"reponse"}},{"kind":"Field","name":{"kind":"Name","value":"envoyee"}}]}}]}}]}}]} as unknown as DocumentNode<ReunionQuery, ReunionQueryVariables>;
export const RepondreConvocationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RepondreConvocation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reponse"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReponseConvocation"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repondreConvocation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"reunionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"reponse"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reponse"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"maReponse"}}]}}]}}]} as unknown as DocumentNode<RepondreConvocationMutation, RepondreConvocationMutationVariables>;
export const AnnulerReunionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AnnulerReunion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"annulerReunion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}}]}}]} as unknown as DocumentNode<AnnulerReunionMutation, AnnulerReunionMutationVariables>;
export const ReponsesDesMembresDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ReponsesDesMembres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activites"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"reponsesRecues"}}]}}]}}]} as unknown as DocumentNode<ReponsesDesMembresQuery, ReponsesDesMembresQueryVariables>;
export const CreerReunionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerReunion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sondageId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jour"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"heureDebut"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"heureFin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lieu"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lienVisio"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tacheIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cible"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CibleConvocation"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personneIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerReunion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sondageId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sondageId"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"jour"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jour"}}},{"kind":"Argument","name":{"kind":"Name","value":"jourFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"heureDebut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"heureDebut"}}},{"kind":"Argument","name":{"kind":"Name","value":"heureFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"heureFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"lieu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lieu"}}},{"kind":"Argument","name":{"kind":"Name","value":"lienVisio"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lienVisio"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"tacheIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tacheIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"cible"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cible"}}},{"kind":"Argument","name":{"kind":"Name","value":"personneIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personneIds"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreerReunionMutation, CreerReunionMutationVariables>;
export const ModifierReunionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierReunion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jour"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"heureDebut"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"heureFin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lieu"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lienVisio"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tacheIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cible"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CibleConvocation"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personneIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierReunion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"jour"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jour"}}},{"kind":"Argument","name":{"kind":"Name","value":"jourFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"heureDebut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"heureDebut"}}},{"kind":"Argument","name":{"kind":"Name","value":"heureFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"heureFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"lieu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lieu"}}},{"kind":"Argument","name":{"kind":"Name","value":"lienVisio"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lienVisio"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"tacheIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tacheIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"cible"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cible"}}},{"kind":"Argument","name":{"kind":"Name","value":"personneIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personneIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionAttendue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ModifierReunionMutation, ModifierReunionMutationVariables>;
export const TachesPourReunionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TachesPourReunion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retroplanning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<TachesPourReunionQuery, TachesPourReunionQueryVariables>;
export const ReunionsDuPerimetreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ReunionsDuPerimetre"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reunions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"fin"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"lieu"}}]}}]}}]} as unknown as DocumentNode<ReunionsDuPerimetreQuery, ReunionsDuPerimetreQueryVariables>;
export const SupprimerSequenceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SupprimerSequence"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supprimerSequence"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<SupprimerSequenceMutation, SupprimerSequenceMutationVariables>;
export const CreerSequenceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerSequence"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lieuId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jour"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"heureDebut"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"heureFin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"places"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PlaceSequenceInput"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"besoinBenevoles"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"consignesBenevoles"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerSequence"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"lieuId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lieuId"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"jour"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jour"}}},{"kind":"Argument","name":{"kind":"Name","value":"jourFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"heureDebut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"heureDebut"}}},{"kind":"Argument","name":{"kind":"Name","value":"heureFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"heureFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"places"},"value":{"kind":"Variable","name":{"kind":"Name","value":"places"}}},{"kind":"Argument","name":{"kind":"Name","value":"besoinBenevoles"},"value":{"kind":"Variable","name":{"kind":"Name","value":"besoinBenevoles"}}},{"kind":"Argument","name":{"kind":"Name","value":"consignesBenevoles"},"value":{"kind":"Variable","name":{"kind":"Name","value":"consignesBenevoles"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreerSequenceMutation, CreerSequenceMutationVariables>;
export const ModifierSequenceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierSequence"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lieuId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jour"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"heureDebut"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"heureFin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"places"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PlaceSequenceInput"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"besoinBenevoles"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"consignesBenevoles"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierSequence"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"lieuId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lieuId"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"jour"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jour"}}},{"kind":"Argument","name":{"kind":"Name","value":"jourFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jourFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"heureDebut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"heureDebut"}}},{"kind":"Argument","name":{"kind":"Name","value":"heureFin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"heureFin"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"places"},"value":{"kind":"Variable","name":{"kind":"Name","value":"places"}}},{"kind":"Argument","name":{"kind":"Name","value":"besoinBenevoles"},"value":{"kind":"Variable","name":{"kind":"Name","value":"besoinBenevoles"}}},{"kind":"Argument","name":{"kind":"Name","value":"consignesBenevoles"},"value":{"kind":"Variable","name":{"kind":"Name","value":"consignesBenevoles"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionAttendue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ModifierSequenceMutation, ModifierSequenceMutationVariables>;
export const ProgrammePerimetreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProgrammePerimetre"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"programme"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}},{"kind":"Field","name":{"kind":"Name","value":"lieu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"places"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<ProgrammePerimetreQuery, ProgrammePerimetreQueryVariables>;
export const SondageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Sondage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sondage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"editionId"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"cible"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"reunionId"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"estParticipant"}},{"kind":"Field","name":{"kind":"Name","value":"participants"}},{"kind":"Field","name":{"kind":"Name","value":"participantIds"}},{"kind":"Field","name":{"kind":"Name","value":"repondants"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"creneaux"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}},{"kind":"Field","name":{"kind":"Name","value":"retenu"}},{"kind":"Field","name":{"kind":"Name","value":"oui"}},{"kind":"Field","name":{"kind":"Name","value":"siBesoin"}},{"kind":"Field","name":{"kind":"Name","value":"non"}},{"kind":"Field","name":{"kind":"Name","value":"monChoix"}},{"kind":"Field","name":{"kind":"Name","value":"reponses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personneId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"choix"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SondageQuery, SondageQueryVariables>;
export const RepondreSondageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RepondreSondage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reponses"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReponseSondageInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repondreSondage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"reponses"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reponses"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RepondreSondageMutation, RepondreSondageMutationVariables>;
export const CloreSondageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CloreSondage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"creneauId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cloreSondage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"creneauId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"creneauId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CloreSondageMutation, CloreSondageMutationVariables>;
export const SupprimerSondageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SupprimerSondage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supprimerSondage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<SupprimerSondageMutation, SupprimerSondageMutationVariables>;
export const CreerSondageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerSondage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"creneaux"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreneauSondageInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cible"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CibleConvocation"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personneIds"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerSondage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"creneaux"},"value":{"kind":"Variable","name":{"kind":"Name","value":"creneaux"}}},{"kind":"Argument","name":{"kind":"Name","value":"cible"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cible"}}},{"kind":"Argument","name":{"kind":"Name","value":"personneIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personneIds"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreerSondageMutation, CreerSondageMutationVariables>;
export const ModifierSondageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierSondage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"creneaux"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreneauSondageInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierSondage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"creneaux"},"value":{"kind":"Variable","name":{"kind":"Name","value":"creneaux"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionAttendue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ModifierSondageMutation, ModifierSondageMutationVariables>;
export const SimulerTachesTypesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SimulerTachesTypes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"simulerTachesTypes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tachesCreees"}},{"kind":"Field","name":{"kind":"Name","value":"tachesDejaPresentes"}},{"kind":"Field","name":{"kind":"Name","value":"effectifsCrees"}},{"kind":"Field","name":{"kind":"Name","value":"conflits"}},{"kind":"Field","name":{"kind":"Name","value":"illisibles"}}]}}]}}]} as unknown as DocumentNode<SimulerTachesTypesQuery, SimulerTachesTypesQueryVariables>;
export const AppliquerTachesTypesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AppliquerTachesTypes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appliquerTachesTypes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tachesCreees"}}]}}]}}]} as unknown as DocumentNode<AppliquerTachesTypesMutation, AppliquerTachesTypesMutationVariables>;
export const AgendasEcritsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AgendasEcrits"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"affectations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<AgendasEcritsQuery, AgendasEcritsQueryVariables>;
export const FilTacheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FilTache"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filTache"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FilChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FilChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FilTache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"nombreCommentaires"}},{"kind":"Field","name":{"kind":"Name","value":"peutCommenter"}},{"kind":"Field","name":{"kind":"Name","value":"commentaires"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"texte"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"modifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"peutSupprimer"}},{"kind":"Field","name":{"kind":"Name","value":"auteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"evenements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"le"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"acteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<FilTacheQuery, FilTacheQueryVariables>;
export const CommentairesDeLaPeriodeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CommentairesDeLaPeriode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commentairesDeLaPeriode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetresLus"}},{"kind":"Field","name":{"kind":"Name","value":"nombres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"nombre"}}]}}]}}]}}]} as unknown as DocumentNode<CommentairesDeLaPeriodeQuery, CommentairesDeLaPeriodeQueryVariables>;
export const CommenterTacheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CommenterTache"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"texte"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commenterTache"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"texte"},"value":{"kind":"Variable","name":{"kind":"Name","value":"texte"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FilChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FilChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FilTache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"nombreCommentaires"}},{"kind":"Field","name":{"kind":"Name","value":"peutCommenter"}},{"kind":"Field","name":{"kind":"Name","value":"commentaires"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"texte"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"modifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"peutSupprimer"}},{"kind":"Field","name":{"kind":"Name","value":"auteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"evenements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"le"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"acteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<CommenterTacheMutation, CommenterTacheMutationVariables>;
export const ModifierCommentaireDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierCommentaire"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"texte"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierCommentaire"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"texte"},"value":{"kind":"Variable","name":{"kind":"Name","value":"texte"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FilChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FilChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FilTache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"nombreCommentaires"}},{"kind":"Field","name":{"kind":"Name","value":"peutCommenter"}},{"kind":"Field","name":{"kind":"Name","value":"commentaires"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"texte"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"modifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"peutSupprimer"}},{"kind":"Field","name":{"kind":"Name","value":"auteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"evenements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"le"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"acteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<ModifierCommentaireMutation, ModifierCommentaireMutationVariables>;
export const SupprimerCommentaireDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SupprimerCommentaire"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supprimerCommentaire"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FilChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FilChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FilTache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"nombreCommentaires"}},{"kind":"Field","name":{"kind":"Name","value":"peutCommenter"}},{"kind":"Field","name":{"kind":"Name","value":"commentaires"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"texte"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"modifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"peutSupprimer"}},{"kind":"Field","name":{"kind":"Name","value":"auteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"evenements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"le"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"acteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<SupprimerCommentaireMutation, SupprimerCommentaireMutationVariables>;
export const EspaceFichiersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EspaceFichiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"espaceFichiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connexionsPossibles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fournisseur"}},{"kind":"Field","name":{"kind":"Name","value":"methode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"connexion"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fournisseur"}},{"kind":"Field","name":{"kind":"Name","value":"methode"}},{"kind":"Field","name":{"kind":"Name","value":"compte"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"connecteeLe"}},{"kind":"Field","name":{"kind":"Name","value":"connecteePar"}},{"kind":"Field","name":{"kind":"Name","value":"portee"}},{"kind":"Field","name":{"kind":"Name","value":"accesVerifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"accesErreur"}},{"kind":"Field","name":{"kind":"Name","value":"exportDossier"}},{"kind":"Field","name":{"kind":"Name","value":"exportRapport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exporteLe"}},{"kind":"Field","name":{"kind":"Name","value":"ecrites"}},{"kind":"Field","name":{"kind":"Name","value":"inchangees"}},{"kind":"Field","name":{"kind":"Name","value":"supprimees"}},{"kind":"Field","name":{"kind":"Name","value":"refusees"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fiche"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"modifieesALaMain"}},{"kind":"Field","name":{"kind":"Name","value":"erreur"}}]}}]}}]}}]}}]} as unknown as DocumentNode<EspaceFichiersQuery, EspaceFichiersQueryVariables>;
export const CommencerConnexionEspaceFichiersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CommencerConnexionEspaceFichiers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fournisseur"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FournisseurFichiers"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portee"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PorteeConnexionFichiers"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commencerConnexionEspaceFichiers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"fournisseur"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fournisseur"}}},{"kind":"Argument","name":{"kind":"Name","value":"portee"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portee"}}}]}]}}]} as unknown as DocumentNode<CommencerConnexionEspaceFichiersMutation, CommencerConnexionEspaceFichiersMutationVariables>;
export const ConnecterCompteServiceGoogleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConnecterCompteServiceGoogle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cle"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connecterCompteServiceGoogle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cle"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"compte"}}]}}]}}]} as unknown as DocumentNode<ConnecterCompteServiceGoogleMutation, ConnecterCompteServiceGoogleMutationVariables>;
export const CommencerConnexionNextcloudDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CommencerConnexionNextcloud"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commencerConnexionNextcloud"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"adresse"},"value":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connexion"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}}]}}]}}]} as unknown as DocumentNode<CommencerConnexionNextcloudMutation, CommencerConnexionNextcloudMutationVariables>;
export const TerminerConnexionNextcloudDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TerminerConnexionNextcloud"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"etat"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"terminerConnexionNextcloud"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"etat"},"value":{"kind":"Variable","name":{"kind":"Name","value":"etat"}}}]}]}}]} as unknown as DocumentNode<TerminerConnexionNextcloudMutation, TerminerConnexionNextcloudMutationVariables>;
export const DeconnecterEspaceFichiersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeconnecterEspaceFichiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deconnecterEspaceFichiers"}}]}}]} as unknown as DocumentNode<DeconnecterEspaceFichiersMutation, DeconnecterEspaceFichiersMutationVariables>;
export const ChoisirDossierExportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChoisirDossierExport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"emplacement"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choisirDossierExport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"emplacement"},"value":{"kind":"Variable","name":{"kind":"Name","value":"emplacement"}}},{"kind":"Argument","name":{"kind":"Name","value":"chemin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportDossier"}}]}}]}}]} as unknown as DocumentNode<ChoisirDossierExportMutation, ChoisirDossierExportMutationVariables>;
export const RetirerDossierExportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetirerDossierExport"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retirerDossierExport"}}]}}]} as unknown as DocumentNode<RetirerDossierExportMutation, RetirerDossierExportMutationVariables>;
export const ExporterFichesMaintenantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExporterFichesMaintenant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exporterFichesMaintenant"}}]}}]} as unknown as DocumentNode<ExporterFichesMaintenantMutation, ExporterFichesMaintenantMutationVariables>;
export const SimulerImportFichesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SimulerImportFiches"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sources"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SourceImportFiches"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"simulerImportFiches"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sources"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sources"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creees"}},{"kind":"Field","name":{"kind":"Name","value":"nouvellesVersions"}},{"kind":"Field","name":{"kind":"Name","value":"inchangees"}},{"kind":"Field","name":{"kind":"Name","value":"conflits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fiche"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nonImportes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fichier"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"refusees"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fichier"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"converties"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fichier"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"incomplet"}}]}}]}}]} as unknown as DocumentNode<SimulerImportFichesQuery, SimulerImportFichesQueryVariables>;
export const ImporterFichesEspaceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImporterFichesEspace"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sources"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SourceImportFiches"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importerFichesEspace"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sources"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sources"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creees"}},{"kind":"Field","name":{"kind":"Name","value":"nouvellesVersions"}},{"kind":"Field","name":{"kind":"Name","value":"inchangees"}},{"kind":"Field","name":{"kind":"Name","value":"conflits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fiche"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nonImportes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fichier"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"refusees"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fichier"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"converties"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fichier"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}}]}},{"kind":"Field","name":{"kind":"Name","value":"incomplet"}}]}}]}}]} as unknown as DocumentNode<ImporterFichesEspaceMutation, ImporterFichesEspaceMutationVariables>;
export const DossiersLiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DossiersLies"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dossiersLies"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"disponible"}},{"kind":"Field","name":{"kind":"Name","value":"fournisseur"}},{"kind":"Field","name":{"kind":"Name","value":"touteActivite"}},{"kind":"Field","name":{"kind":"Name","value":"attendus"}},{"kind":"Field","name":{"kind":"Name","value":"accesCrees"}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupes"}},{"kind":"Field","name":{"kind":"Name","value":"lecteursLus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"touteActivite"}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupes"}}]}}]}}]}}]} as unknown as DocumentNode<DossiersLiesQuery, DossiersLiesQueryVariables>;
export const EffetsLecteursDossierDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EffetsLecteursDossier"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lecteurs"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LecteursDossierInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"effetsLecteursDossier"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"lecteurs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lecteurs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"documentsMasques"}},{"kind":"Field","name":{"kind":"Name","value":"fiches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}}]}}]}}]} as unknown as DocumentNode<EffetsLecteursDossierQuery, EffetsLecteursDossierQueryVariables>;
export const ContenuDossierLieDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ContenuDossierLie"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ressource"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"contenuDossierLie"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"chemin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}}},{"kind":"Argument","name":{"kind":"Name","value":"ressource"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ressource"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"complet"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"dossier"}},{"kind":"Field","name":{"kind":"Name","value":"taille"}},{"kind":"Field","name":{"kind":"Name","value":"modifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"lienWeb"}},{"kind":"Field","name":{"kind":"Name","value":"apercu"}}]}}]}}]}}]} as unknown as DocumentNode<ContenuDossierLieQuery, ContenuDossierLieQueryVariables>;
export const PerimetresALierDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PerimetresALier"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]} as unknown as DocumentNode<PerimetresALierQuery, PerimetresALierQueryVariables>;
export const EmplacementsFichiersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EmplacementsFichiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"emplacementsFichiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"site"}}]}}]}}]} as unknown as DocumentNode<EmplacementsFichiersQuery, EmplacementsFichiersQueryVariables>;
export const ParcourirEspaceFichiersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ParcourirEspaceFichiers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"emplacement"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"parcourirEspaceFichiers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"emplacement"},"value":{"kind":"Variable","name":{"kind":"Name","value":"emplacement"}}},{"kind":"Argument","name":{"kind":"Name","value":"chemin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"complet"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<ParcourirEspaceFichiersQuery, ParcourirEspaceFichiersQueryVariables>;
export const LierDossierDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LierDossier"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lecteurs"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LecteursDossierInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"emplacement"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lierDossier"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"lecteurs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lecteurs"}}},{"kind":"Argument","name":{"kind":"Name","value":"emplacement"},"value":{"kind":"Variable","name":{"kind":"Name","value":"emplacement"}}},{"kind":"Argument","name":{"kind":"Name","value":"chemin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<LierDossierMutation, LierDossierMutationVariables>;
export const ModifierDossierLieDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierDossierLie"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lecteurs"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LecteursDossierInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attendus"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AttendusDossier"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierDossierLie"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"lecteurs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lecteurs"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"attendus"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attendus"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"touteActivite"}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupes"}}]}}]}}]} as unknown as DocumentNode<ModifierDossierLieMutation, ModifierDossierLieMutationVariables>;
export const DelierDossierDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DelierDossier"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"oublierAcces"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delierDossier"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"oublierAcces"},"value":{"kind":"Variable","name":{"kind":"Name","value":"oublierAcces"}}}]}]}}]} as unknown as DocumentNode<DelierDossierMutation, DelierDossierMutationVariables>;
export const RessourcesFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RessourcesFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"concerneGroupes"}},{"kind":"Field","name":{"kind":"Name","value":"ressources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"chemin"}},{"kind":"Field","name":{"kind":"Name","value":"ouvrable"}},{"kind":"Field","name":{"kind":"Name","value":"ouverteAuxLecteurs"}},{"kind":"Field","name":{"kind":"Name","value":"apercu"}},{"kind":"Field","name":{"kind":"Name","value":"existe"}},{"kind":"Field","name":{"kind":"Name","value":"lienWeb"}},{"kind":"Field","name":{"kind":"Name","value":"perimetresSansAcces"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"dossierLie"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"disponible"}},{"kind":"Field","name":{"kind":"Name","value":"fournisseur"}},{"kind":"Field","name":{"kind":"Name","value":"touteActivite"}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupes"}}]}}]}}]}}]}}]} as unknown as DocumentNode<RessourcesFicheQuery, RessourcesFicheQueryVariables>;
export const OuvrirDocumentLieDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"OuvrirDocumentLie"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ouvert"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ouvrirDocumentLie"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"ouvert"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ouvert"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"ouverteAuxLecteurs"}}]}}]}}]} as unknown as DocumentNode<OuvrirDocumentLieMutation, OuvrirDocumentLieMutationVariables>;
export const LierRessourceFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LierRessourceFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dossierLieId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lierRessourceFiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ficheId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}}},{"kind":"Argument","name":{"kind":"Name","value":"dossierLieId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dossierLieId"}}},{"kind":"Argument","name":{"kind":"Name","value":"chemin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chemin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<LierRessourceFicheMutation, LierRessourceFicheMutationVariables>;
export const DelierRessourceFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DelierRessourceFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delierRessourceFiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DelierRessourceFicheMutation, DelierRessourceFicheMutationVariables>;
export const VerificationAccesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"VerificationAcces"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verificationAcces"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"dossier"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"touteActivite"}},{"kind":"Field","name":{"kind":"Name","value":"attendus"}},{"kind":"Field","name":{"kind":"Name","value":"accesFournisseur"}},{"kind":"Field","name":{"kind":"Name","value":"groupeFournisseurId"}},{"kind":"Field","name":{"kind":"Name","value":"groupeFournisseurNom"}},{"kind":"Field","name":{"kind":"Name","value":"roleFournisseur"}},{"kind":"Field","name":{"kind":"Name","value":"fournisseur"}},{"kind":"Field","name":{"kind":"Name","value":"ajoutsAutomatiques"}},{"kind":"Field","name":{"kind":"Name","value":"invitationFournisseur"}},{"kind":"Field","name":{"kind":"Name","value":"groupes"}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"propositions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"action"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"erreur"}},{"kind":"Field","name":{"kind":"Name","value":"cible"}},{"kind":"Field","name":{"kind":"Name","value":"parGroupe"}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"lignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"via"}},{"kind":"Field","name":{"kind":"Name","value":"perimetreIds"}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}}]}}]}}]}}]} as unknown as DocumentNode<VerificationAccesQuery, VerificationAccesQueryVariables>;
export const ComptesFournisseurDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ComptesFournisseur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"comptesFournisseur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"adresseSaisie"}},{"kind":"Field","name":{"kind":"Name","value":"verifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}}]}}]}}]} as unknown as DocumentNode<ComptesFournisseurQuery, ComptesFournisseurQueryVariables>;
export const VerifierAccesFournisseurDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifierAccesFournisseur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifierAccesFournisseur"}}]}}]} as unknown as DocumentNode<VerifierAccesFournisseurMutation, VerifierAccesFournisseurMutationVariables>;
export const SaisirAdresseFournisseurDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaisirAdresseFournisseur"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saisirAdresseFournisseur"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"adresse"},"value":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adresseSaisie"}}]}}]}}]} as unknown as DocumentNode<SaisirAdresseFournisseurMutation, SaisirAdresseFournisseurMutationVariables>;
export const ReglerPorteeConnexionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReglerPorteeConnexion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portee"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PorteeConnexionFichiers"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reglerPorteeConnexion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portee"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portee"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portee"}}]}}]}}]} as unknown as DocumentNode<ReglerPorteeConnexionMutation, ReglerPorteeConnexionMutationVariables>;
export const GroupesDuDossierDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GroupesDuDossier"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupesDuDossier"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"identifiant"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]} as unknown as DocumentNode<GroupesDuDossierQuery, GroupesDuDossierQueryVariables>;
export const ReglerAccesFournisseurDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReglerAccesFournisseur"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AccesFournisseurDossier"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupeId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"role"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RoleFournisseur"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ajoutsAutomatiques"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"invitation"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reglerAccesFournisseur"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"mode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mode"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"role"},"value":{"kind":"Variable","name":{"kind":"Name","value":"role"}}},{"kind":"Argument","name":{"kind":"Name","value":"ajoutsAutomatiques"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ajoutsAutomatiques"}}},{"kind":"Argument","name":{"kind":"Name","value":"invitation"},"value":{"kind":"Variable","name":{"kind":"Name","value":"invitation"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"accesFournisseur"}}]}}]}}]} as unknown as DocumentNode<ReglerAccesFournisseurMutation, ReglerAccesFournisseurMutationVariables>;
export const AppliquerPropositionAccesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AppliquerPropositionAcces"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appliquerPropositionAcces"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<AppliquerPropositionAccesMutation, AppliquerPropositionAccesMutationVariables>;
export const AppliquerPropositionsDossierDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AppliquerPropositionsDossier"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dossierId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appliquerPropositionsDossier"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"dossierId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dossierId"}}}]}]}}]} as unknown as DocumentNode<AppliquerPropositionsDossierMutation, AppliquerPropositionsDossierMutationVariables>;
export const EcarterPropositionAccesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EcarterPropositionAcces"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ecarterPropositionAcces"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<EcarterPropositionAccesMutation, EcarterPropositionAccesMutationVariables>;
export const FicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Fiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"contenu"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}},{"kind":"Field","name":{"kind":"Name","value":"modifieeLe"}},{"kind":"Field","name":{"kind":"Name","value":"modifieePar"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"donneesPersonnelles"}},{"kind":"Field","name":{"kind":"Name","value":"nombreVersions"}},{"kind":"Field","name":{"kind":"Name","value":"versionCouranteId"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"concerneGroupes"}},{"kind":"Field","name":{"kind":"Name","value":"connexions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"par"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"masquee"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FicheQuery, FicheQueryVariables>;
export const TachesFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TachesFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taches"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]}}]}}]} as unknown as DocumentNode<TachesFicheQuery, TachesFicheQueryVariables>;
export const VersionsFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"VersionsFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"versionCouranteId"}},{"kind":"Field","name":{"kind":"Name","value":"versions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"contenu"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"resume"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"auteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]}}]} as unknown as DocumentNode<VersionsFicheQuery, VersionsFicheQueryVariables>;
export const ListeFichesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ListeFiches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fiches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"modifieeLe"}},{"kind":"Field","name":{"kind":"Name","value":"modifieePar"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"peutRedigerFichesCommunes"}}]}}]} as unknown as DocumentNode<ListeFichesQuery, ListeFichesQueryVariables>;
export const CreerFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"contenu"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerFiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"contenu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"contenu"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}}]} as unknown as DocumentNode<CreerFicheMutation, CreerFicheMutationVariables>;
export const ModifierFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"contenu"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"resume"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionDeDepart"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierFiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"contenu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"contenu"}}},{"kind":"Argument","name":{"kind":"Name","value":"resume"},"value":{"kind":"Variable","name":{"kind":"Name","value":"resume"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionDeDepart"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionDeDepart"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"contenu"}},{"kind":"Field","name":{"kind":"Name","value":"modifieeLe"}},{"kind":"Field","name":{"kind":"Name","value":"modifieePar"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"donneesPersonnelles"}},{"kind":"Field","name":{"kind":"Name","value":"versionCouranteId"}}]}}]}}]} as unknown as DocumentNode<ModifierFicheMutation, ModifierFicheMutationVariables>;
export const RestaurerVersionFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RestaurerVersionFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionDeDepart"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restaurerVersionFiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"versionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionDeDepart"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionDeDepart"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"contenu"}},{"kind":"Field","name":{"kind":"Name","value":"modifieeLe"}},{"kind":"Field","name":{"kind":"Name","value":"modifieePar"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"versionCouranteId"}}]}}]}}]} as unknown as DocumentNode<RestaurerVersionFicheMutation, RestaurerVersionFicheMutationVariables>;
export const ReglerConcerneAussiDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReglerConcerneAussi"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reglerConcerneAussi"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ficheId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupes"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ReglerConcerneAussiMutation, ReglerConcerneAussiMutationVariables>;
export const InvitationsEnAttenteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InvitationsEnAttente"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"invitationsEnAttente"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}},{"kind":"Field","name":{"kind":"Name","value":"expireLe"}},{"kind":"Field","name":{"kind":"Name","value":"perimetresAffectes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetresSouhaites"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"activitesRattachees"}}]}}]}}]} as unknown as DocumentNode<InvitationsEnAttenteQuery, InvitationsEnAttenteQueryVariables>;
export const MesInvitationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MesInvitations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mesInvitations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"organisationNom"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"}},{"kind":"Field","name":{"kind":"Name","value":"expireLe"}}]}}]}}]} as unknown as DocumentNode<MesInvitationsQuery, MesInvitationsQueryVariables>;
export const TeleverserMediaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TeleverserMedia"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"format"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FormatMedia"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"donnees"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"televerserMedia"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"format"},"value":{"kind":"Variable","name":{"kind":"Name","value":"format"}}},{"kind":"Argument","name":{"kind":"Name","value":"donnees"},"value":{"kind":"Variable","name":{"kind":"Name","value":"donnees"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"empreinte"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<TeleverserMediaMutation, TeleverserMediaMutationVariables>;
export const VersionInstallationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"VersionInstallation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"versionInstallation"}}]}}]} as unknown as DocumentNode<VersionInstallationQuery, VersionInstallationQueryVariables>;
export const NotesDeVersionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NotesDeVersion"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"notesDeVersion"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numero"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"notes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"texte"}}]}}]}}]}}]} as unknown as DocumentNode<NotesDeVersionQuery, NotesDeVersionQueryVariables>;
export const OrganisationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Organisation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"organisation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"sigle"}},{"kind":"Field","name":{"kind":"Name","value":"logoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"faviconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"iconeApplicationUrl"}},{"kind":"Field","name":{"kind":"Name","value":"manifestUrl"}},{"kind":"Field","name":{"kind":"Name","value":"pageEquipe"}},{"kind":"Field","name":{"kind":"Name","value":"langue"}},{"kind":"Field","name":{"kind":"Name","value":"theme"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ThemeChamps"}}]}},{"kind":"Field","name":{"kind":"Name","value":"codeSource"}},{"kind":"Field","name":{"kind":"Name","value":"modesDEmploi"}},{"kind":"Field","name":{"kind":"Name","value":"support"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ThemeChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Theme"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couleurs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encre"}},{"kind":"Field","name":{"kind":"Name","value":"primaire"}},{"kind":"Field","name":{"kind":"Name","value":"primaireClair"}},{"kind":"Field","name":{"kind":"Name","value":"accent"}},{"kind":"Field","name":{"kind":"Name","value":"accentClair"}},{"kind":"Field","name":{"kind":"Name","value":"accentTexte"}},{"kind":"Field","name":{"kind":"Name","value":"succes"}},{"kind":"Field","name":{"kind":"Name","value":"succesClair"}},{"kind":"Field","name":{"kind":"Name","value":"alerte"}},{"kind":"Field","name":{"kind":"Name","value":"alerteClair"}},{"kind":"Field","name":{"kind":"Name","value":"erreur"}},{"kind":"Field","name":{"kind":"Name","value":"erreurClair"}},{"kind":"Field","name":{"kind":"Name","value":"sol1"}},{"kind":"Field","name":{"kind":"Name","value":"sol2"}},{"kind":"Field","name":{"kind":"Name","value":"sol3"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fond"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transition"}},{"kind":"Field","name":{"kind":"Name","value":"halo1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"intensite"}}]}},{"kind":"Field","name":{"kind":"Name","value":"halo2"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"intensite"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"polices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"texte"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"mono"}}]}},{"kind":"Field","name":{"kind":"Name","value":"typographie"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"graisseTitre"}},{"kind":"Field","name":{"kind":"Name","value":"graisseCorps"}},{"kind":"Field","name":{"kind":"Name","value":"espacementTitre"}},{"kind":"Field","name":{"kind":"Name","value":"echelleTitre"}}]}}]}}]} as unknown as DocumentNode<OrganisationQuery, OrganisationQueryVariables>;
export const DesabonnerPushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DesabonnerPush"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"desabonnerPush"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"adresse"},"value":{"kind":"Variable","name":{"kind":"Name","value":"adresse"}}}]}]}}]} as unknown as DocumentNode<DesabonnerPushMutation, DesabonnerPushMutationVariables>;
export const CandidaturesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Candidatures"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"statut"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"StatutCandidature"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"candidatures"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"statut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"statut"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"courriel"}},{"kind":"Field","name":{"kind":"Name","value":"telephone"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"precisionsDisponibilite"}},{"kind":"Field","name":{"kind":"Name","value":"ouAilleurs"}},{"kind":"Field","name":{"kind":"Name","value":"deposeeLe"}},{"kind":"Field","name":{"kind":"Name","value":"origine"}},{"kind":"Field","name":{"kind":"Name","value":"appelNom"}},{"kind":"Field","name":{"kind":"Name","value":"benevoleId"}},{"kind":"Field","name":{"kind":"Name","value":"peutEcarter"}},{"kind":"Field","name":{"kind":"Name","value":"plages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choix"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"sequenceId"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}},{"kind":"Field","name":{"kind":"Name","value":"lieu"}},{"kind":"Field","name":{"kind":"Name","value":"peutTraiter"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CandidaturesQuery, CandidaturesQueryVariables>;
export const AppelsBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AppelsBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appelsBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"portee"}},{"kind":"Field","name":{"kind":"Name","value":"sequenceId"}},{"kind":"Field","name":{"kind":"Name","value":"sequenceTitre"}},{"kind":"Field","name":{"kind":"Name","value":"introduction"}},{"kind":"Field","name":{"kind":"Name","value":"ouvertLe"}},{"kind":"Field","name":{"kind":"Name","value":"fermeLe"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"finAdresse"}},{"kind":"Field","name":{"kind":"Name","value":"adresse"}},{"kind":"Field","name":{"kind":"Name","value":"candidaturesEnAttente"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<AppelsBenevolesQuery, AppelsBenevolesQueryVariables>;
export const SequencesPourImportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SequencesPourImport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"programme"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}},{"kind":"Field","name":{"kind":"Name","value":"besoinBenevoles"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]} as unknown as DocumentNode<SequencesPourImportQuery, SequencesPourImportQueryVariables>;
export const SimulerImportBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SimulerImportBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"source"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ModeImport"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prevenirParMail"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accepterTout"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accord"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personnes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PersonneImportInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"simulerImportBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"source"},"value":{"kind":"Variable","name":{"kind":"Name","value":"source"}}},{"kind":"Argument","name":{"kind":"Name","value":"mode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mode"}}},{"kind":"Argument","name":{"kind":"Name","value":"prevenirParMail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prevenirParMail"}}},{"kind":"Argument","name":{"kind":"Name","value":"accepterTout"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accepterTout"}}},{"kind":"Argument","name":{"kind":"Name","value":"accord"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accord"}}},{"kind":"Argument","name":{"kind":"Name","value":"personnes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personnes"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aImporter"}},{"kind":"Field","name":{"kind":"Name","value":"dejaImportees"}},{"kind":"Field","name":{"kind":"Name","value":"ecartees"}},{"kind":"Field","name":{"kind":"Name","value":"fichesCreees"}},{"kind":"Field","name":{"kind":"Name","value":"fichesRattachees"}},{"kind":"Field","name":{"kind":"Name","value":"places"}},{"kind":"Field","name":{"kind":"Name","value":"fichesRestantes"}},{"kind":"Field","name":{"kind":"Name","value":"depassements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sequenceId"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"besoin"}},{"kind":"Field","name":{"kind":"Name","value":"renforts"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cle"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"motif"}},{"kind":"Field","name":{"kind":"Name","value":"rattacheeA"}},{"kind":"Field","name":{"kind":"Name","value":"compte"}},{"kind":"Field","name":{"kind":"Name","value":"rapprochement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"benevoleId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"niveau"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SimulerImportBenevolesQuery, SimulerImportBenevolesQueryVariables>;
export const ImporterBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImporterBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"source"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ModeImport"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prevenirParMail"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accepterTout"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accord"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personnes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PersonneImportInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importerBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"source"},"value":{"kind":"Variable","name":{"kind":"Name","value":"source"}}},{"kind":"Argument","name":{"kind":"Name","value":"mode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mode"}}},{"kind":"Argument","name":{"kind":"Name","value":"prevenirParMail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prevenirParMail"}}},{"kind":"Argument","name":{"kind":"Name","value":"accepterTout"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accepterTout"}}},{"kind":"Argument","name":{"kind":"Name","value":"accord"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accord"}}},{"kind":"Argument","name":{"kind":"Name","value":"personnes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personnes"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aImporter"}},{"kind":"Field","name":{"kind":"Name","value":"dejaImportees"}},{"kind":"Field","name":{"kind":"Name","value":"ecartees"}},{"kind":"Field","name":{"kind":"Name","value":"fichesCreees"}},{"kind":"Field","name":{"kind":"Name","value":"fichesRattachees"}},{"kind":"Field","name":{"kind":"Name","value":"places"}},{"kind":"Field","name":{"kind":"Name","value":"lignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cle"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"motif"}}]}}]}}]}}]} as unknown as DocumentNode<ImporterBenevolesMutation, ImporterBenevolesMutationVariables>;
export const CorrespondancesImportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CorrespondancesImport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"correspondancesImport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"entetes"}},{"kind":"Field","name":{"kind":"Name","value":"associations"}},{"kind":"Field","name":{"kind":"Name","value":"reglages"}},{"kind":"Field","name":{"kind":"Name","value":"peutSupprimer"}}]}}]}}]} as unknown as DocumentNode<CorrespondancesImportQuery, CorrespondancesImportQueryVariables>;
export const EnregistrerCorrespondanceImportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EnregistrerCorrespondanceImport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"entetes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"associations"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSONObject"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reglages"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSONObject"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enregistrerCorrespondanceImport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"entetes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"entetes"}}},{"kind":"Argument","name":{"kind":"Name","value":"associations"},"value":{"kind":"Variable","name":{"kind":"Name","value":"associations"}}},{"kind":"Argument","name":{"kind":"Name","value":"reglages"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reglages"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<EnregistrerCorrespondanceImportMutation, EnregistrerCorrespondanceImportMutationVariables>;
export const DoublonsBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DoublonsBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"doublonsBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"niveau"}},{"kind":"Field","name":{"kind":"Name","value":"a"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"courriel"}},{"kind":"Field","name":{"kind":"Name","value":"telephone"}},{"kind":"Field","name":{"kind":"Name","value":"places"}},{"kind":"Field","name":{"kind":"Name","value":"origine"}},{"kind":"Field","name":{"kind":"Name","value":"sourceImport"}}]}},{"kind":"Field","name":{"kind":"Name","value":"b"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"courriel"}},{"kind":"Field","name":{"kind":"Name","value":"telephone"}},{"kind":"Field","name":{"kind":"Name","value":"places"}},{"kind":"Field","name":{"kind":"Name","value":"origine"}},{"kind":"Field","name":{"kind":"Name","value":"sourceImport"}}]}}]}}]}}]} as unknown as DocumentNode<DoublonsBenevolesQuery, DoublonsBenevolesQueryVariables>;
export const FusionnerBenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FusionnerBenevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"gardeeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"autreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nomDe"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CoteFusion"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courrielDe"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CoteFusion"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"telephoneDe"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CoteFusion"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fusionnerBenevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"gardeeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"gardeeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"autreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"autreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"nomDe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nomDe"}}},{"kind":"Argument","name":{"kind":"Name","value":"courrielDe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courrielDe"}}},{"kind":"Argument","name":{"kind":"Name","value":"telephoneDe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"telephoneDe"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<FusionnerBenevolesMutation, FusionnerBenevolesMutationVariables>;
export const MarquerBenevolesDistinctsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarquerBenevolesDistincts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"aId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"bId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marquerBenevolesDistincts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"aId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"aId"}}},{"kind":"Argument","name":{"kind":"Name","value":"bId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"bId"}}}]}]}}]} as unknown as DocumentNode<MarquerBenevolesDistinctsMutation, MarquerBenevolesDistinctsMutationVariables>;
export const MessagesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Messages"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"messages"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modele"}},{"kind":"Field","name":{"kind":"Name","value":"objet"}},{"kind":"Field","name":{"kind":"Name","value":"corps"}},{"kind":"Field","name":{"kind":"Name","value":"champ"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"statutLe"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"activiteId"}},{"kind":"Field","name":{"kind":"Name","value":"perimetreId"}},{"kind":"Field","name":{"kind":"Name","value":"estLeMien"}},{"kind":"Field","name":{"kind":"Name","value":"auteur"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"destinataires"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"enCopie"}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]}}]} as unknown as DocumentNode<MessagesQuery, MessagesQueryVariables>;
export const CreerMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"message"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MessageInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerMessage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"message"},"value":{"kind":"Variable","name":{"kind":"Name","value":"message"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}}]}}]} as unknown as DocumentNode<CreerMessageMutation, CreerMessageMutationVariables>;
export const DefinirStatutMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DefinirStatutMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"statut"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StatutMessage"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"definirStatutMessage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"statut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"statut"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"statutLe"}}]}}]}}]} as unknown as DocumentNode<DefinirStatutMessageMutation, DefinirStatutMessageMutationVariables>;
export const InformationsMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InformationsMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retroplanning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"postesAPourvoir"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aPourvoir"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}}]}}]}}]}}]} as unknown as DocumentNode<InformationsMessageQuery, InformationsMessageQueryVariables>;
export const AdressesEquipeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdressesEquipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"equipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}}]}}]} as unknown as DocumentNode<AdressesEquipeQuery, AdressesEquipeQueryVariables>;
export const NombreNotificationsNonLuesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NombreNotificationsNonLues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nombreNotificationsNonLues"}}]}}]} as unknown as DocumentNode<NombreNotificationsNonLuesQuery, NombreNotificationsNonLuesQueryVariables>;
export const NombreNotificationsAdminDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NombreNotificationsAdmin"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nombreNotificationsNonLues"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"admin"},"value":{"kind":"BooleanValue","value":true}}]}]}}]} as unknown as DocumentNode<NombreNotificationsAdminQuery, NombreNotificationsAdminQueryVariables>;
export const ListeNotificationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ListeNotifications"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"notifications"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limite"},"value":{"kind":"IntValue","value":"60"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NotificationAffichee"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NotificationAffichee"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Notification"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"niveau"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"lien"}},{"kind":"Field","name":{"kind":"Name","value":"lue"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"periode"}},{"kind":"Field","name":{"kind":"Name","value":"activite"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]} as unknown as DocumentNode<ListeNotificationsQuery, ListeNotificationsQueryVariables>;
export const ListeNotificationsAdminDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ListeNotificationsAdmin"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"notifications"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"admin"},"value":{"kind":"BooleanValue","value":true}},{"kind":"Argument","name":{"kind":"Name","value":"limite"},"value":{"kind":"IntValue","value":"200"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NotificationAffichee"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NotificationAffichee"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Notification"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"niveau"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"lien"}},{"kind":"Field","name":{"kind":"Name","value":"lue"}},{"kind":"Field","name":{"kind":"Name","value":"creeLe"}},{"kind":"Field","name":{"kind":"Name","value":"periode"}},{"kind":"Field","name":{"kind":"Name","value":"activite"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]} as unknown as DocumentNode<ListeNotificationsAdminQuery, ListeNotificationsAdminQueryVariables>;
export const NotificationsAutresOrganisationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NotificationsAutresOrganisations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"notificationsAutresOrganisations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"nonLues"}}]}}]}}]} as unknown as DocumentNode<NotificationsAutresOrganisationsQuery, NotificationsAutresOrganisationsQueryVariables>;
export const MarquerNotificationsLuesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarquerNotificationsLues"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"admin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marquerNotificationsLues"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}},{"kind":"Argument","name":{"kind":"Name","value":"admin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"admin"}}},{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}}]}]}}]} as unknown as DocumentNode<MarquerNotificationsLuesMutation, MarquerNotificationsLuesMutationVariables>;
export const MoiDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}}]}}]}}]} as unknown as DocumentNode<MoiQuery, MoiQueryVariables>;
export const LangueDeMoiDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LangueDeMoi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"langue"}}]}}]}}]} as unknown as DocumentNode<LangueDeMoiQuery, LangueDeMoiQueryVariables>;
export const EditionCouranteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditionCourante"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editionCourante"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"annee"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"debut"}},{"kind":"Field","name":{"kind":"Name","value":"fin"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}}]}}]} as unknown as DocumentNode<EditionCouranteQuery, EditionCouranteQueryVariables>;
export const EditionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Editions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"annee"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"debut"}},{"kind":"Field","name":{"kind":"Name","value":"fin"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}}]}}]} as unknown as DocumentNode<EditionsQuery, EditionsQueryVariables>;
export const PerimetresDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Perimetres"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureArchives"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"inclureArchives"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureArchives"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"ordre"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<PerimetresQuery, PerimetresQueryVariables>;
export const ActivitesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Activites"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"inclureArchives"},"value":{"kind":"BooleanValue","value":true}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"sigle"}},{"kind":"Field","name":{"kind":"Name","value":"nature"}},{"kind":"Field","name":{"kind":"Name","value":"ordre"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}},{"kind":"Field","name":{"kind":"Name","value":"estAdministree"}},{"kind":"Field","name":{"kind":"Name","value":"souhaitsOuverts"}},{"kind":"Field","name":{"kind":"Name","value":"adressesOrganigramme"}},{"kind":"Field","name":{"kind":"Name","value":"formulaireOuvert"}},{"kind":"Field","name":{"kind":"Name","value":"modules"}},{"kind":"Field","name":{"kind":"Name","value":"modulesAutorises"}},{"kind":"Field","name":{"kind":"Name","value":"formulaire"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"introduction"}},{"kind":"Field","name":{"kind":"Name","value":"question"}},{"kind":"Field","name":{"kind":"Name","value":"paliers"}}]}},{"kind":"Field","name":{"kind":"Name","value":"acces"}},{"kind":"Field","name":{"kind":"Name","value":"groupes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cle"}},{"kind":"Field","name":{"kind":"Name","value":"libelle"}},{"kind":"Field","name":{"kind":"Name","value":"libellePluriel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"phases"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cle"}},{"kind":"Field","name":{"kind":"Name","value":"libelle"}},{"kind":"Field","name":{"kind":"Name","value":"jusquA"}}]}},{"kind":"Field","name":{"kind":"Name","value":"logoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"contactRecrutement"}},{"kind":"Field","name":{"kind":"Name","value":"pageEquipe"}},{"kind":"Field","name":{"kind":"Name","value":"theme"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ThemeChamps"}}]}},{"kind":"Field","name":{"kind":"Name","value":"identite"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"contactRecrutement"}},{"kind":"Field","name":{"kind":"Name","value":"pageEquipe"}},{"kind":"Field","name":{"kind":"Name","value":"logoPng"}},{"kind":"Field","name":{"kind":"Name","value":"logoSvg"}},{"kind":"Field","name":{"kind":"Name","value":"logoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"theme"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ThemeChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Theme"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couleurs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encre"}},{"kind":"Field","name":{"kind":"Name","value":"primaire"}},{"kind":"Field","name":{"kind":"Name","value":"primaireClair"}},{"kind":"Field","name":{"kind":"Name","value":"accent"}},{"kind":"Field","name":{"kind":"Name","value":"accentClair"}},{"kind":"Field","name":{"kind":"Name","value":"accentTexte"}},{"kind":"Field","name":{"kind":"Name","value":"succes"}},{"kind":"Field","name":{"kind":"Name","value":"succesClair"}},{"kind":"Field","name":{"kind":"Name","value":"alerte"}},{"kind":"Field","name":{"kind":"Name","value":"alerteClair"}},{"kind":"Field","name":{"kind":"Name","value":"erreur"}},{"kind":"Field","name":{"kind":"Name","value":"erreurClair"}},{"kind":"Field","name":{"kind":"Name","value":"sol1"}},{"kind":"Field","name":{"kind":"Name","value":"sol2"}},{"kind":"Field","name":{"kind":"Name","value":"sol3"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fond"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transition"}},{"kind":"Field","name":{"kind":"Name","value":"halo1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"intensite"}}]}},{"kind":"Field","name":{"kind":"Name","value":"halo2"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"intensite"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"polices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"texte"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"mono"}}]}},{"kind":"Field","name":{"kind":"Name","value":"typographie"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"graisseTitre"}},{"kind":"Field","name":{"kind":"Name","value":"graisseCorps"}},{"kind":"Field","name":{"kind":"Name","value":"espacementTitre"}},{"kind":"Field","name":{"kind":"Name","value":"echelleTitre"}}]}}]}}]} as unknown as DocumentNode<ActivitesQuery, ActivitesQueryVariables>;
export const MesOrganisationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MesOrganisations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mesOrganisations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"sigle"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"active"}}]}}]}}]} as unknown as DocumentNode<MesOrganisationsQuery, MesOrganisationsQueryVariables>;
export const AffecterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Affecter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affecter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"personneId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AffecterMutation, AffecterMutationVariables>;
export const RetirerAffectationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetirerAffectation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retirerAffectation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RetirerAffectationMutation, RetirerAffectationMutationVariables>;
export const DefinirAdminActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DefinirAdminActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"admin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"definirAdminActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"personneId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}}},{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"admin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"admin"}}}]}]}}]} as unknown as DocumentNode<DefinirAdminActiviteMutation, DefinirAdminActiviteMutationVariables>;
export const AvancementGlobalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AvancementGlobal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"avancementGlobal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"avancement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"aFaire"}},{"kind":"Field","name":{"kind":"Name","value":"enCours"}},{"kind":"Field","name":{"kind":"Name","value":"faites"}},{"kind":"Field","name":{"kind":"Name","value":"abandonnees"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"sansPersonne"}}]}}]}}]}}]} as unknown as DocumentNode<AvancementGlobalQuery, AvancementGlobalQueryVariables>;
export const PersonnesConvocablesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PersonnesConvocables"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personnesConvocables"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personneId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"duPerimetre"}}]}}]}}]} as unknown as DocumentNode<PersonnesConvocablesQuery, PersonnesConvocablesQueryVariables>;
export const LieuxDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Lieux"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lieux"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"ordre"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}}]}}]}}]} as unknown as DocumentNode<LieuxQuery, LieuxQueryVariables>;
export const BenevolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Benevoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"benevoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"courriel"}},{"kind":"Field","name":{"kind":"Name","value":"telephone"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"coordonneesVisibles"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"places"}},{"kind":"Field","name":{"kind":"Name","value":"accordLe"}},{"kind":"Field","name":{"kind":"Name","value":"origine"}},{"kind":"Field","name":{"kind":"Name","value":"prevenirParMail"}},{"kind":"Field","name":{"kind":"Name","value":"confirmeeLe"}},{"kind":"Field","name":{"kind":"Name","value":"lienEnvoyeLe"}},{"kind":"Field","name":{"kind":"Name","value":"lienRenvoyable"}},{"kind":"Field","name":{"kind":"Name","value":"lienEspace"}}]}}]}}]} as unknown as DocumentNode<BenevolesQuery, BenevolesQueryVariables>;
export const PremiersPasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PremiersPas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"premiersPas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"etapes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"etape"}},{"kind":"Field","name":{"kind":"Name","value":"faite"}}]}},{"kind":"Field","name":{"kind":"Name","value":"masques"}},{"kind":"Field","name":{"kind":"Name","value":"termines"}}]}}]}}]} as unknown as DocumentNode<PremiersPasQuery, PremiersPasQueryVariables>;
export const DeclinaisonsProposeesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DeclinaisonsProposees"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"declinaisonsProposees"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"origine"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<DeclinaisonsProposeesQuery, DeclinaisonsProposeesQueryVariables>;
export const DeclinaisonsTacheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DeclinaisonsTache"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tache"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"declinaisons"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"accord"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"historiqueAccord"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"etape"}},{"kind":"Field","name":{"kind":"Name","value":"le"}},{"kind":"Field","name":{"kind":"Name","value":"par"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<DeclinaisonsTacheQuery, DeclinaisonsTacheQueryVariables>;
export const DeclinerTacheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeclinerTache"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"echeance"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"declinerTache"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"echeance"},"value":{"kind":"Variable","name":{"kind":"Name","value":"echeance"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TacheChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TacheChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Tache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"termineeLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"clotureePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realiseePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiche"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}}]}}]} as unknown as DocumentNode<DeclinerTacheMutation, DeclinerTacheMutationVariables>;
export const AccorderDeclinaisonDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AccorderDeclinaison"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accepter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accorderDeclinaison"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"accepter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accepter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"accord"}}]}}]}}]} as unknown as DocumentNode<AccorderDeclinaisonMutation, AccorderDeclinaisonMutationVariables>;
export const ImposerDeclinaisonDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImposerDeclinaison"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"imposerDeclinaison"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"accord"}}]}}]}}]} as unknown as DocumentNode<ImposerDeclinaisonMutation, ImposerDeclinaisonMutationVariables>;
export const CreerTacheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerTache"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"echeance"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mAssigner"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"declinaison"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DeclinaisonInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerTache"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"echeance"},"value":{"kind":"Variable","name":{"kind":"Name","value":"echeance"}}},{"kind":"Argument","name":{"kind":"Name","value":"ficheId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}}},{"kind":"Argument","name":{"kind":"Name","value":"mAssigner"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mAssigner"}}},{"kind":"Argument","name":{"kind":"Name","value":"declinaison"},"value":{"kind":"Variable","name":{"kind":"Name","value":"declinaison"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TacheChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TacheChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Tache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"termineeLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"clotureePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realiseePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiche"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}}]}}]} as unknown as DocumentNode<CreerTacheMutation, CreerTacheMutationVariables>;
export const ModifierTacheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierTache"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"titre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"echeance"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"confirmer"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierTache"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"titre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"titre"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"echeance"},"value":{"kind":"Variable","name":{"kind":"Name","value":"echeance"}}},{"kind":"Argument","name":{"kind":"Name","value":"ficheId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ficheId"}}},{"kind":"Argument","name":{"kind":"Name","value":"versionAttendue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"versionAttendue"}}},{"kind":"Argument","name":{"kind":"Name","value":"confirmer"},"value":{"kind":"Variable","name":{"kind":"Name","value":"confirmer"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TacheChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TacheChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Tache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"termineeLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"clotureePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realiseePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiche"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}}]}}]} as unknown as DocumentNode<ModifierTacheMutation, ModifierTacheMutationVariables>;
export const ChangerStatutTacheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangerStatutTache"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"statut"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StatutTache"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"realiseeParId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"statutAttendu"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"StatutTache"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"confirmer"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changerStatutTache"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"statut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"statut"}}},{"kind":"Argument","name":{"kind":"Name","value":"realiseeParId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"realiseeParId"}}},{"kind":"Argument","name":{"kind":"Name","value":"statutAttendu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"statutAttendu"}}},{"kind":"Argument","name":{"kind":"Name","value":"confirmer"},"value":{"kind":"Variable","name":{"kind":"Name","value":"confirmer"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TacheChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TacheChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Tache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"termineeLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"clotureePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realiseePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiche"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}}]}}]} as unknown as DocumentNode<ChangerStatutTacheMutation, ChangerStatutTacheMutationVariables>;
export const AssignerTacheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AssignerTache"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assigne"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignerTache"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"assigne"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assigne"}}},{"kind":"Argument","name":{"kind":"Name","value":"personneId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TacheChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TacheChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Tache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"termineeLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"clotureePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realiseePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiche"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}}]}}]} as unknown as DocumentNode<AssignerTacheMutation, AssignerTacheMutationVariables>;
export const AgendaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Agenda"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"echeances"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"agenda"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"echeances"},"value":{"kind":"Variable","name":{"kind":"Name","value":"echeances"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"peutGerer"}},{"kind":"Field","name":{"kind":"Name","value":"edition"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cle"}},{"kind":"Field","name":{"kind":"Name","value":"sorte"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"dateCleId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"tacheId"}},{"kind":"Field","name":{"kind":"Name","value":"perimetreId"}},{"kind":"Field","name":{"kind":"Name","value":"faite"}}]}}]}}]}}]} as unknown as DocumentNode<AgendaQuery, AgendaQueryVariables>;
export const ReunionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Reunions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reunions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"lieu"}},{"kind":"Field","name":{"kind":"Name","value":"detailMasque"}},{"kind":"Field","name":{"kind":"Name","value":"estConvoquee"}},{"kind":"Field","name":{"kind":"Name","value":"maReponse"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<ReunionsQuery, ReunionsQueryVariables>;
export const SondagesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Sondages"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sondages"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"estParticipant"}},{"kind":"Field","name":{"kind":"Name","value":"aRepondu"}},{"kind":"Field","name":{"kind":"Name","value":"participants"}},{"kind":"Field","name":{"kind":"Name","value":"repondants"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<SondagesQuery, SondagesQueryVariables>;
export const AffectationsPourAgendaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AffectationsPourAgenda"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"affectations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<AffectationsPourAgendaQuery, AffectationsPourAgendaQueryVariables>;
export const SupprimerDateCleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SupprimerDateCle"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supprimerDateCle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<SupprimerDateCleMutation, SupprimerDateCleMutationVariables>;
export const AppelBenevolesPublicDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AppelBenevolesPublic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appelBenevolesPublic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"jeton"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"organisation"}},{"kind":"Field","name":{"kind":"Name","value":"activite"}},{"kind":"Field","name":{"kind":"Name","value":"periode"}},{"kind":"Field","name":{"kind":"Name","value":"introduction"}},{"kind":"Field","name":{"kind":"Name","value":"contact"}},{"kind":"Field","name":{"kind":"Name","value":"ouAilleurs"}},{"kind":"Field","name":{"kind":"Name","value":"jours"}},{"kind":"Field","name":{"kind":"Name","value":"sequences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ref"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}},{"kind":"Field","name":{"kind":"Name","value":"lieu"}},{"kind":"Field","name":{"kind":"Name","value":"lieuDescription"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"consignes"}},{"kind":"Field","name":{"kind":"Name","value":"placesRecherchees"}},{"kind":"Field","name":{"kind":"Name","value":"complete"}}]}}]}}]}}]} as unknown as DocumentNode<AppelBenevolesPublicQuery, AppelBenevolesPublicQueryVariables>;
export const DeposerCandidatureDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeposerCandidature"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"telephone"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sequences"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ouAilleurs"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"plages"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PlageDisponibiliteInput"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"precisions"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"message"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accord"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"siteWeb"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deposerCandidature"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"jeton"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"telephone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"telephone"}}},{"kind":"Argument","name":{"kind":"Name","value":"sequences"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sequences"}}},{"kind":"Argument","name":{"kind":"Name","value":"ouAilleurs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ouAilleurs"}}},{"kind":"Argument","name":{"kind":"Name","value":"plages"},"value":{"kind":"Variable","name":{"kind":"Name","value":"plages"}}},{"kind":"Argument","name":{"kind":"Name","value":"precisions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"precisions"}}},{"kind":"Argument","name":{"kind":"Name","value":"message"},"value":{"kind":"Variable","name":{"kind":"Name","value":"message"}}},{"kind":"Argument","name":{"kind":"Name","value":"accord"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accord"}}},{"kind":"Argument","name":{"kind":"Name","value":"siteWeb"},"value":{"kind":"Variable","name":{"kind":"Name","value":"siteWeb"}}}]}]}}]} as unknown as DocumentNode<DeposerCandidatureMutation, DeposerCandidatureMutationVariables>;
export const CreerBenevoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerBenevole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courriel"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"telephone"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"note"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prevenirParMail"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accord"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerBenevole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"courriel"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courriel"}}},{"kind":"Argument","name":{"kind":"Name","value":"telephone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"telephone"}}},{"kind":"Argument","name":{"kind":"Name","value":"note"},"value":{"kind":"Variable","name":{"kind":"Name","value":"note"}}},{"kind":"Argument","name":{"kind":"Name","value":"prevenirParMail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prevenirParMail"}}},{"kind":"Argument","name":{"kind":"Name","value":"accord"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accord"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreerBenevoleMutation, CreerBenevoleMutationVariables>;
export const ModifierBenevoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierBenevole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courriel"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"telephone"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"note"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prevenirParMail"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierBenevole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"courriel"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courriel"}}},{"kind":"Argument","name":{"kind":"Name","value":"telephone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"telephone"}}},{"kind":"Argument","name":{"kind":"Name","value":"note"},"value":{"kind":"Variable","name":{"kind":"Name","value":"note"}}},{"kind":"Argument","name":{"kind":"Name","value":"prevenirParMail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prevenirParMail"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ModifierBenevoleMutation, ModifierBenevoleMutationVariables>;
export const SupprimerBenevoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SupprimerBenevole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supprimerBenevole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<SupprimerBenevoleMutation, SupprimerBenevoleMutationVariables>;
export const EspaceBenevoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EspaceBenevole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"espaceBenevole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"jeton"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"organisation"}},{"kind":"Field","name":{"kind":"Name","value":"activite"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"confirme"}},{"kind":"Field","name":{"kind":"Name","value":"contact"}},{"kind":"Field","name":{"kind":"Name","value":"ics"}},{"kind":"Field","name":{"kind":"Name","value":"places"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ref"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}},{"kind":"Field","name":{"kind":"Name","value":"lieu"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"}},{"kind":"Field","name":{"kind":"Name","value":"consignes"}},{"kind":"Field","name":{"kind":"Name","value":"confirmee"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}}]}}]}}]}}]} as unknown as DocumentNode<EspaceBenevoleQuery, EspaceBenevoleQueryVariables>;
export const ConfirmerParticipationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmerParticipation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmerParticipation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"jeton"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}}}]}]}}]} as unknown as DocumentNode<ConfirmerParticipationMutation, ConfirmerParticipationMutationVariables>;
export const QuitterPlaceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"QuitterPlace"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ref"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"quitterPlace"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"jeton"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}}},{"kind":"Argument","name":{"kind":"Name","value":"ref"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ref"}}}]}]}}]} as unknown as DocumentNode<QuitterPlaceMutation, QuitterPlaceMutationVariables>;
export const SupprimerMaFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SupprimerMaFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supprimerMaFiche"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"jeton"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jeton"}}}]}]}}]} as unknown as DocumentNode<SupprimerMaFicheMutation, SupprimerMaFicheMutationVariables>;
export const PerimetreCibleFicheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PerimetreCibleFiche"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"peutRedigerFiches"}}]}}]}}]} as unknown as DocumentNode<PerimetreCibleFicheQuery, PerimetreCibleFicheQueryVariables>;
export const DroitFichesCommunesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DroitFichesCommunes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"peutRedigerFichesCommunes"}}]}}]} as unknown as DocumentNode<DroitFichesCommunesQuery, DroitFichesCommunesQueryVariables>;
export const MesTachesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MesTaches"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"affectations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"referents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"avancement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"faites"}},{"kind":"Field","name":{"kind":"Name","value":"abandonnees"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"sansPersonne"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"mesTaches"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TacheChamps"}}]}},{"kind":"Field","name":{"kind":"Name","value":"tachesAPrendre"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TacheChamps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TacheChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Tache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"termineeLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"clotureePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realiseePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiche"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}}]}}]} as unknown as DocumentNode<MesTachesQuery, MesTachesQueryVariables>;
export const OrganigrammeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Organigramme"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"organigramme"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edition"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"complet"}},{"kind":"Field","name":{"kind":"Name","value":"adresses"}},{"kind":"Field","name":{"kind":"Name","value":"contactActivite"}},{"kind":"Field","name":{"kind":"Name","value":"admins"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personneId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"adresse"}},{"kind":"Field","name":{"kind":"Name","value":"moi"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"referents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personneId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"adresse"}},{"kind":"Field","name":{"kind":"Name","value":"contactPrincipal"}},{"kind":"Field","name":{"kind":"Name","value":"moi"}}]}}]}}]}}]}}]} as unknown as DocumentNode<OrganigrammeQuery, OrganigrammeQueryVariables>;
export const PagePerimetreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PagePerimetre"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"acces"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}]},{"kind":"Field","name":{"kind":"Name","value":"referents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"contactPrincipal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"avancement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"aFaire"}},{"kind":"Field","name":{"kind":"Name","value":"enCours"}},{"kind":"Field","name":{"kind":"Name","value":"faites"}},{"kind":"Field","name":{"kind":"Name","value":"abandonnees"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"sansPersonne"}}]}},{"kind":"Field","name":{"kind":"Name","value":"taches"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TacheChamps"}},{"kind":"Field","name":{"kind":"Name","value":"origine"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"resumeDeclinaisons"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"enAttente"}},{"kind":"Field","name":{"kind":"Name","value":"refusees"}},{"kind":"Field","name":{"kind":"Name","value":"acceptees"}},{"kind":"Field","name":{"kind":"Name","value":"faites"}},{"kind":"Field","name":{"kind":"Name","value":"abandonnees"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"fichesCommunes"},"name":{"kind":"Name","value":"fiches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TacheChamps"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Tache"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"termineeLe"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"clotureePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realiseePar"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fiche"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}}]}}]} as unknown as DocumentNode<PagePerimetreQuery, PagePerimetreQueryVariables>;
export const FichesDuPerimetreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FichesDuPerimetre"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"peutRedigerFiches"}},{"kind":"Field","name":{"kind":"Name","value":"fiches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}}]}},{"kind":"Field","name":{"kind":"Name","value":"peutMasquerFichesConnexes"}},{"kind":"Field","name":{"kind":"Name","value":"fichesConnexes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"inclureMasquees"},"value":{"kind":"BooleanValue","value":true}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"connexions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"masquee"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<FichesDuPerimetreQuery, FichesDuPerimetreQueryVariables>;
export const MesPreferencesNotificationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MesPreferencesNotification"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mesPreferencesNotification"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"frequenceResume"}},{"kind":"Field","name":{"kind":"Name","value":"mailModification"}},{"kind":"Field","name":{"kind":"Name","value":"mailEcheance"}},{"kind":"Field","name":{"kind":"Name","value":"mailDemandes"}},{"kind":"Field","name":{"kind":"Name","value":"applicationPerimetre"}},{"kind":"Field","name":{"kind":"Name","value":"pushTaches"}},{"kind":"Field","name":{"kind":"Name","value":"pushEcheances"}},{"kind":"Field","name":{"kind":"Name","value":"pushDemandes"}},{"kind":"Field","name":{"kind":"Name","value":"pushEquipe"}},{"kind":"Field","name":{"kind":"Name","value":"pushAgenda"}},{"kind":"Field","name":{"kind":"Name","value":"applicationEquipe"}},{"kind":"Field","name":{"kind":"Name","value":"resumeAdmin"}}]}}]}}]} as unknown as DocumentNode<MesPreferencesNotificationQuery, MesPreferencesNotificationQueryVariables>;
export const ModifierPreferencesNotificationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierPreferencesNotification"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"frequenceResume"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FrequenceResume"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mailModification"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mailEcheance"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mailDemandes"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"applicationPerimetre"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"applicationEquipe"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"resumeAdmin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierPreferencesNotification"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"frequenceResume"},"value":{"kind":"Variable","name":{"kind":"Name","value":"frequenceResume"}}},{"kind":"Argument","name":{"kind":"Name","value":"mailModification"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mailModification"}}},{"kind":"Argument","name":{"kind":"Name","value":"mailEcheance"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mailEcheance"}}},{"kind":"Argument","name":{"kind":"Name","value":"mailDemandes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mailDemandes"}}},{"kind":"Argument","name":{"kind":"Name","value":"applicationPerimetre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"applicationPerimetre"}}},{"kind":"Argument","name":{"kind":"Name","value":"applicationEquipe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"applicationEquipe"}}},{"kind":"Argument","name":{"kind":"Name","value":"resumeAdmin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"resumeAdmin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"frequenceResume"}},{"kind":"Field","name":{"kind":"Name","value":"mailModification"}},{"kind":"Field","name":{"kind":"Name","value":"mailEcheance"}},{"kind":"Field","name":{"kind":"Name","value":"mailDemandes"}},{"kind":"Field","name":{"kind":"Name","value":"applicationPerimetre"}},{"kind":"Field","name":{"kind":"Name","value":"applicationEquipe"}},{"kind":"Field","name":{"kind":"Name","value":"resumeAdmin"}}]}}]}}]} as unknown as DocumentNode<ModifierPreferencesNotificationMutation, ModifierPreferencesNotificationMutationVariables>;
export const ModifierMonNomDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierMonNom"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierMonNom"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]} as unknown as DocumentNode<ModifierMonNomMutation, ModifierMonNomMutationVariables>;
export const ProgrammeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Programme"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mesSequences"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"programme"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"mesSequences"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mesSequences"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"editionId"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"besoinBenevoles"}},{"kind":"Field","name":{"kind":"Name","value":"consignesBenevoles"}},{"kind":"Field","name":{"kind":"Name","value":"renforts"}},{"kind":"Field","name":{"kind":"Name","value":"jour"}},{"kind":"Field","name":{"kind":"Name","value":"jourFin"}},{"kind":"Field","name":{"kind":"Name","value":"heureDebut"}},{"kind":"Field","name":{"kind":"Name","value":"heureFin"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"peutModifier"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lieu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"places"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"personneId"}},{"kind":"Field","name":{"kind":"Name","value":"benevoleId"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"estMoi"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}}]}}]}}]}}]} as unknown as DocumentNode<ProgrammeQuery, ProgrammeQueryVariables>;
export const FormulaireRejoindreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FormulaireRejoindre"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"organisation"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activite"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"formulaireRejoindre"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"organisation"},"value":{"kind":"Variable","name":{"kind":"Name","value":"organisation"}}},{"kind":"Argument","name":{"kind":"Name","value":"activite"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activite"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"organisation"}},{"kind":"Field","name":{"kind":"Name","value":"activite"}},{"kind":"Field","name":{"kind":"Name","value":"periode"}},{"kind":"Field","name":{"kind":"Name","value":"introduction"}},{"kind":"Field","name":{"kind":"Name","value":"question"}},{"kind":"Field","name":{"kind":"Name","value":"paliers"}},{"kind":"Field","name":{"kind":"Name","value":"contact"}},{"kind":"Field","name":{"kind":"Name","value":"appelBenevoles"}},{"kind":"Field","name":{"kind":"Name","value":"groupes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"libelle"}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FormulaireRejoindreQuery, FormulaireRejoindreQueryVariables>;
export const EnvoyerDemandeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EnvoyerDemande"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"organisation"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activite"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetres"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"disponibilite"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reponse"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"texte"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"siteWeb"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"envoyerDemande"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"organisation"},"value":{"kind":"Variable","name":{"kind":"Name","value":"organisation"}}},{"kind":"Argument","name":{"kind":"Name","value":"activite"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activite"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetres"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetres"}}},{"kind":"Argument","name":{"kind":"Name","value":"disponibilite"},"value":{"kind":"Variable","name":{"kind":"Name","value":"disponibilite"}}},{"kind":"Argument","name":{"kind":"Name","value":"reponse"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reponse"}}},{"kind":"Argument","name":{"kind":"Name","value":"texte"},"value":{"kind":"Variable","name":{"kind":"Name","value":"texte"}}},{"kind":"Argument","name":{"kind":"Name","value":"siteWeb"},"value":{"kind":"Variable","name":{"kind":"Name","value":"siteWeb"}}}]}]}}]} as unknown as DocumentNode<EnvoyerDemandeMutation, EnvoyerDemandeMutationVariables>;
export const RetroplanningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Retroplanning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moi"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}},{"kind":"Field","name":{"kind":"Name","value":"affectations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"retroplanning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titre"}},{"kind":"Field","name":{"kind":"Name","value":"echeance"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}},{"kind":"Field","name":{"kind":"Name","value":"enRetard"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"ordre"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"origine"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<RetroplanningQuery, RetroplanningQueryVariables>;
export const TousLesPerimetresDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TousLesPerimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tousLesPerimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edition"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affecte"}},{"kind":"Field","name":{"kind":"Name","value":"souhaite"}},{"kind":"Field","name":{"kind":"Name","value":"personnesRecherchees"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]}}]}}]} as unknown as DocumentNode<TousLesPerimetresQuery, TousLesPerimetresQueryVariables>;
export const FormulerSouhaitDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FormulerSouhait"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"formulerSouhait"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}]}]}}]} as unknown as DocumentNode<FormulerSouhaitMutation, FormulerSouhaitMutationVariables>;
export const RetirerMonSouhaitDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetirerMonSouhait"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retirerMonSouhait"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}]}]}}]} as unknown as DocumentNode<RetirerMonSouhaitMutation, RetirerMonSouhaitMutationVariables>;
export const CreerActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreerActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sigle"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nature"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"NatureActivite"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupes"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GroupePerimetresInput"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"creerActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"sigle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sigle"}}},{"kind":"Argument","name":{"kind":"Name","value":"nature"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nature"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupes"}}},{"kind":"Argument","name":{"kind":"Name","value":"ordre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}}]} as unknown as DocumentNode<CreerActiviteMutation, CreerActiviteMutationVariables>;
export const ModifierActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sigle"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nature"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"NatureActivite"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GroupePerimetresInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"phases"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PhaseInput"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"archive"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"souhaitsOuverts"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"formulaire"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"FormulaireInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"formulaireOuvert"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"adressesOrganigramme"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AdressesOrganigramme"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"modules"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ModuleActivite"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"sigle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sigle"}}},{"kind":"Argument","name":{"kind":"Name","value":"nature"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nature"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupes"}}},{"kind":"Argument","name":{"kind":"Name","value":"phases"},"value":{"kind":"Variable","name":{"kind":"Name","value":"phases"}}},{"kind":"Argument","name":{"kind":"Name","value":"ordre"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ordre"}}},{"kind":"Argument","name":{"kind":"Name","value":"archive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"archive"}}},{"kind":"Argument","name":{"kind":"Name","value":"souhaitsOuverts"},"value":{"kind":"Variable","name":{"kind":"Name","value":"souhaitsOuverts"}}},{"kind":"Argument","name":{"kind":"Name","value":"formulaire"},"value":{"kind":"Variable","name":{"kind":"Name","value":"formulaire"}}},{"kind":"Argument","name":{"kind":"Name","value":"formulaireOuvert"},"value":{"kind":"Variable","name":{"kind":"Name","value":"formulaireOuvert"}}},{"kind":"Argument","name":{"kind":"Name","value":"adressesOrganigramme"},"value":{"kind":"Variable","name":{"kind":"Name","value":"adressesOrganigramme"}}},{"kind":"Argument","name":{"kind":"Name","value":"modules"},"value":{"kind":"Variable","name":{"kind":"Name","value":"modules"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ModifierActiviteMutation, ModifierActiviteMutationVariables>;
export const ModifierIdentiteActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierIdentiteActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"contactRecrutement"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageEquipe"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"logoPng"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"logoSvg"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"theme"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"JSONObject"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierIdentiteActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"contactRecrutement"},"value":{"kind":"Variable","name":{"kind":"Name","value":"contactRecrutement"}}},{"kind":"Argument","name":{"kind":"Name","value":"pageEquipe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageEquipe"}}},{"kind":"Argument","name":{"kind":"Name","value":"logoPng"},"value":{"kind":"Variable","name":{"kind":"Name","value":"logoPng"}}},{"kind":"Argument","name":{"kind":"Name","value":"logoSvg"},"value":{"kind":"Variable","name":{"kind":"Name","value":"logoSvg"}}},{"kind":"Argument","name":{"kind":"Name","value":"theme"},"value":{"kind":"Variable","name":{"kind":"Name","value":"theme"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ModifierIdentiteActiviteMutation, ModifierIdentiteActiviteMutationVariables>;
export const AdminsOrganisationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminsOrganisation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminsOrganisation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]} as unknown as DocumentNode<AdminsOrganisationQuery, AdminsOrganisationQueryVariables>;
export const AnnuaireAdminsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AnnuaireAdmins"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personnes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}}]}}]}}]} as unknown as DocumentNode<AnnuaireAdminsQuery, AnnuaireAdminsQueryVariables>;
export const AdminsActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminsActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"equipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"activitesAdministrees"}}]}}]}}]} as unknown as DocumentNode<AdminsActiviteQuery, AdminsActiviteQueryVariables>;
export const DefinirAdminOrganisationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DefinirAdminOrganisation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"estAdmin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierPersonne"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"estAdmin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"estAdmin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}}]}}]}}]} as unknown as DocumentNode<DefinirAdminOrganisationMutation, DefinirAdminOrganisationMutationVariables>;
export const ClassementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Classement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"classement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rang"}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"score"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"tachesRealisees"}},{"kind":"Field","name":{"kind":"Name","value":"tachesATemps"}},{"kind":"Field","name":{"kind":"Name","value":"tachesCreees"}},{"kind":"Field","name":{"kind":"Name","value":"fichesCreees"}},{"kind":"Field","name":{"kind":"Name","value":"fichesModifiees"}}]}}]}}]}}]} as unknown as DocumentNode<ClassementQuery, ClassementQueryVariables>;
export const ModifierEditionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierEdition"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"debut"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"statut"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StatutEdition"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierEdition"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"debut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"debut"}}},{"kind":"Argument","name":{"kind":"Name","value":"fin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fin"}}},{"kind":"Argument","name":{"kind":"Name","value":"statut"},"value":{"kind":"Variable","name":{"kind":"Name","value":"statut"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"debut"}},{"kind":"Field","name":{"kind":"Name","value":"fin"}},{"kind":"Field","name":{"kind":"Name","value":"statut"}}]}}]}}]} as unknown as DocumentNode<ModifierEditionMutation, ModifierEditionMutationVariables>;
export const PostesAPourvoirDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PostesAPourvoir"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"annuaire"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"postesAPourvoir"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"effectif"}},{"kind":"Field","name":{"kind":"Name","value":"aPourvoir"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"demandesEnAttente"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"ordre"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"affectations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"contactPrincipal"}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"souhaits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"appelPostes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}]},{"kind":"Field","name":{"kind":"Name","value":"equipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personnes"},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"annuaire"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"attributions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activiteId"}}]}}]}}]}}]} as unknown as DocumentNode<PostesAPourvoirQuery, PostesAPourvoirQueryVariables>;
export const DefinirEffectifDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DefinirEffectif"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"effectif"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"definirEffectif"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"effectif"},"value":{"kind":"Variable","name":{"kind":"Name","value":"effectif"}}}]}]}}]} as unknown as DocumentNode<DefinirEffectifMutation, DefinirEffectifMutationVariables>;
export const DefinirContactPrincipalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DefinirContactPrincipal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"contactPrincipal"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"definirContactPrincipal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"affectationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"contactPrincipal"},"value":{"kind":"Variable","name":{"kind":"Name","value":"contactPrincipal"}}}]}]}}]} as unknown as DocumentNode<DefinirContactPrincipalMutation, DefinirContactPrincipalMutationVariables>;
export const RetirerSouhaitDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetirerSouhait"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retirerSouhait"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RetirerSouhaitMutation, RetirerSouhaitMutationVariables>;
export const SimulerImportEquipeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SimulerImportEquipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lignes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LigneEquipeImport"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"simulerImportEquipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"lignes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lignes"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ligne"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}},{"kind":"Field","name":{"kind":"Name","value":"avertissements"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personnes"}}]}}]}}]} as unknown as DocumentNode<SimulerImportEquipeQuery, SimulerImportEquipeQueryVariables>;
export const ImporterEquipeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImporterEquipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lignes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LigneEquipeImport"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"envoyerMails"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importerEquipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"lignes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lignes"}}},{"kind":"Argument","name":{"kind":"Name","value":"envoyerMails"},"value":{"kind":"Variable","name":{"kind":"Name","value":"envoyerMails"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ligne"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}},{"kind":"Field","name":{"kind":"Name","value":"avertissements"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personnes"}},{"kind":"Field","name":{"kind":"Name","value":"invitationsEnAttente"}},{"kind":"Field","name":{"kind":"Name","value":"affectationsCreees"}},{"kind":"Field","name":{"kind":"Name","value":"contactsPrincipaux"}},{"kind":"Field","name":{"kind":"Name","value":"mailsInvitations"}},{"kind":"Field","name":{"kind":"Name","value":"mailsEquipe"}}]}}]}}]} as unknown as DocumentNode<ImporterEquipeMutation, ImporterEquipeMutationVariables>;
export const SimulerImportTachesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SimulerImportTaches"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lignes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LigneTacheImport"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupeNouveaux"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enregistrerTachesTypes"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"simulerImportTaches"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"lignes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lignes"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupeNouveaux"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupeNouveaux"}}},{"kind":"Argument","name":{"kind":"Name","value":"enregistrerTachesTypes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enregistrerTachesTypes"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ligne"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}},{"kind":"Field","name":{"kind":"Name","value":"avertissements"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetresCrees"}},{"kind":"Field","name":{"kind":"Name","value":"tachesTypesAjoutees"}}]}}]}}]} as unknown as DocumentNode<SimulerImportTachesQuery, SimulerImportTachesQueryVariables>;
export const ImporterTachesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImporterTaches"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lignes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LigneTacheImport"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupeNouveaux"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enregistrerTachesTypes"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importerTaches"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"lignes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lignes"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupeNouveaux"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupeNouveaux"}}},{"kind":"Argument","name":{"kind":"Name","value":"enregistrerTachesTypes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enregistrerTachesTypes"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lignes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ligne"}},{"kind":"Field","name":{"kind":"Name","value":"etat"}},{"kind":"Field","name":{"kind":"Name","value":"raison"}},{"kind":"Field","name":{"kind":"Name","value":"avertissements"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetresCrees"}},{"kind":"Field","name":{"kind":"Name","value":"tachesTypesAjoutees"}}]}}]}}]} as unknown as DocumentNode<ImporterTachesMutation, ImporterTachesMutationVariables>;
export const IdentiteOrganisationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"IdentiteOrganisation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"identiteOrganisation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"sigle"}},{"kind":"Field","name":{"kind":"Name","value":"contactRecrutement"}},{"kind":"Field","name":{"kind":"Name","value":"contactSupport"}},{"kind":"Field","name":{"kind":"Name","value":"pageEquipe"}},{"kind":"Field","name":{"kind":"Name","value":"langue"}},{"kind":"Field","name":{"kind":"Name","value":"domainesCourrielAutorises"}},{"kind":"Field","name":{"kind":"Name","value":"adressesRoleAutorisees"}},{"kind":"Field","name":{"kind":"Name","value":"expediteurRecoitReponses"}},{"kind":"Field","name":{"kind":"Name","value":"logoPng"}},{"kind":"Field","name":{"kind":"Name","value":"logoSvg"}},{"kind":"Field","name":{"kind":"Name","value":"favicon"}},{"kind":"Field","name":{"kind":"Name","value":"iconeApplication"}},{"kind":"Field","name":{"kind":"Name","value":"theme"}},{"kind":"Field","name":{"kind":"Name","value":"contenuModifieLe"}},{"kind":"Field","name":{"kind":"Name","value":"contenuSynchroniseLe"}}]}}]}}]} as unknown as DocumentNode<IdentiteOrganisationQuery, IdentiteOrganisationQueryVariables>;
export const ModifierIdentiteOrganisationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierIdentiteOrganisation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sigle"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"contactRecrutement"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"contactSupport"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageEquipe"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"langue"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"domainesCourrielAutorises"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"adressesRoleAutorisees"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"logoPng"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"logoSvg"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"favicon"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"iconeApplication"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"theme"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"JSONObject"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierIdentiteOrganisation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"sigle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sigle"}}},{"kind":"Argument","name":{"kind":"Name","value":"contactRecrutement"},"value":{"kind":"Variable","name":{"kind":"Name","value":"contactRecrutement"}}},{"kind":"Argument","name":{"kind":"Name","value":"contactSupport"},"value":{"kind":"Variable","name":{"kind":"Name","value":"contactSupport"}}},{"kind":"Argument","name":{"kind":"Name","value":"pageEquipe"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageEquipe"}}},{"kind":"Argument","name":{"kind":"Name","value":"langue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"langue"}}},{"kind":"Argument","name":{"kind":"Name","value":"domainesCourrielAutorises"},"value":{"kind":"Variable","name":{"kind":"Name","value":"domainesCourrielAutorises"}}},{"kind":"Argument","name":{"kind":"Name","value":"adressesRoleAutorisees"},"value":{"kind":"Variable","name":{"kind":"Name","value":"adressesRoleAutorisees"}}},{"kind":"Argument","name":{"kind":"Name","value":"logoPng"},"value":{"kind":"Variable","name":{"kind":"Name","value":"logoPng"}}},{"kind":"Argument","name":{"kind":"Name","value":"logoSvg"},"value":{"kind":"Variable","name":{"kind":"Name","value":"logoSvg"}}},{"kind":"Argument","name":{"kind":"Name","value":"favicon"},"value":{"kind":"Variable","name":{"kind":"Name","value":"favicon"}}},{"kind":"Argument","name":{"kind":"Name","value":"iconeApplication"},"value":{"kind":"Variable","name":{"kind":"Name","value":"iconeApplication"}}},{"kind":"Argument","name":{"kind":"Name","value":"theme"},"value":{"kind":"Variable","name":{"kind":"Name","value":"theme"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}}]}}]} as unknown as DocumentNode<ModifierIdentiteOrganisationMutation, ModifierIdentiteOrganisationMutationVariables>;
export const ExportContenuDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExportContenu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportContenu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nomFichier"}},{"kind":"Field","name":{"kind":"Name","value":"donnees"}}]}}]}}]} as unknown as DocumentNode<ExportContenuQuery, ExportContenuQueryVariables>;
export const PersonnesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Personnes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inclureArchives"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personnes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"inclureArchives"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inclureArchives"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}},{"kind":"Field","name":{"kind":"Name","value":"activitesAdministrees"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}},{"kind":"Field","name":{"kind":"Name","value":"nomModifiable"}},{"kind":"Field","name":{"kind":"Name","value":"affectations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"contactPrincipal"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"souhaits"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"satisfait"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"attributions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activiteId"}},{"kind":"Field","name":{"kind":"Name","value":"rattachee"}},{"kind":"Field","name":{"kind":"Name","value":"affectee"}},{"kind":"Field","name":{"kind":"Name","value":"interessee"}},{"kind":"Field","name":{"kind":"Name","value":"admin"}}]}}]}}]}}]} as unknown as DocumentNode<PersonnesQuery, PersonnesQueryVariables>;
export const PersonnesEquipeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PersonnesEquipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"gereOrganisation"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"equipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}},{"kind":"Field","name":{"kind":"Name","value":"activitesAdministrees"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}},{"kind":"Field","name":{"kind":"Name","value":"nomModifiable"},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"gereOrganisation"}}}]}]},{"kind":"Field","name":{"kind":"Name","value":"affectations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"contactPrincipal"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"souhaits"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"satisfait"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"couleur"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PersonnesEquipeQuery, PersonnesEquipeQueryVariables>;
export const DemandesEnAttenteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DemandesEnAttente"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"demandes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"statut"},"value":{"kind":"EnumValue","value":"EN_ATTENTE"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DemandesEnAttenteQuery, DemandesEnAttenteQueryVariables>;
export const SouhaitsActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SouhaitsActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editionCourante"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetres"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"groupe"}}]}}]}}]} as unknown as DocumentNode<SouhaitsActiviteQuery, SouhaitsActiviteQueryVariables>;
export const SouhaitsEditionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SouhaitsEdition"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"equipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"affectations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"souhaits"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SouhaitsEditionQuery, SouhaitsEditionQueryVariables>;
export const InviterPersonneDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InviterPersonne"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetresSouhaites"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetresAffectes"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inviterPersonne"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetresSouhaites"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetresSouhaites"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetresAffectes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetresAffectes"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enAttente"}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<InviterPersonneMutation, InviterPersonneMutationVariables>;
export const ModifierPersonneDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifierPersonne"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"estAdmin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifierPersonne"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"nom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nom"}}},{"kind":"Argument","name":{"kind":"Name","value":"estAdmin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"estAdmin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}}]}}]}}]} as unknown as DocumentNode<ModifierPersonneMutation, ModifierPersonneMutationVariables>;
export const ArchiverPersonneDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ArchiverPersonne"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"archive"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"archiverPersonne"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"archive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"archive"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"archive"}}]}}]}}]} as unknown as DocumentNode<ArchiverPersonneMutation, ArchiverPersonneMutationVariables>;
export const DefinirSouhaitsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DefinirSouhaits"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"definirSouhaits"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"personneId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}}},{"kind":"Argument","name":{"kind":"Name","value":"editionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"editionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreIds"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DefinirSouhaitsMutation, DefinirSouhaitsMutationVariables>;
export const RattacherAlActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RattacherALActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rattacherALActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}]}]}}]} as unknown as DocumentNode<RattacherAlActiviteMutation, RattacherAlActiviteMutationVariables>;
export const RetirerDeLActiviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetirerDeLActivite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retirerDeLActivite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"activiteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activiteId"}}}]}]}}]} as unknown as DocumentNode<RetirerDeLActiviteMutation, RetirerDeLActiviteMutationVariables>;
export const RenvoyerInvitationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RenvoyerInvitation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"renvoyerInvitation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RenvoyerInvitationMutation, RenvoyerInvitationMutationVariables>;
export const DroitsRedactionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DroitsRedaction"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"annuaire"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"droitsRedaction"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"accordeLe"}},{"kind":"Field","name":{"kind":"Name","value":"personne"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"perimetre"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"activite"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"adminsOrganisation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}}]}},{"kind":"Field","name":{"kind":"Name","value":"equipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}},{"kind":"Field","name":{"kind":"Name","value":"activitesAdministrees"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personnes"},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"annuaire"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nom"}},{"kind":"Field","name":{"kind":"Name","value":"estAdmin"}},{"kind":"Field","name":{"kind":"Name","value":"activitesAdministrees"}}]}}]}}]} as unknown as DocumentNode<DroitsRedactionQuery, DroitsRedactionQueryVariables>;
export const AccorderDroitRedactionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AccorderDroitRedaction"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accorderDroitRedaction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"personneId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"personneId"}}},{"kind":"Argument","name":{"kind":"Name","value":"perimetreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perimetreId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AccorderDroitRedactionMutation, AccorderDroitRedactionMutationVariables>;
export const RetirerDroitRedactionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetirerDroitRedaction"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retirerDroitRedaction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RetirerDroitRedactionMutation, RetirerDroitRedactionMutationVariables>;