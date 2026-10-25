# ADR 0049 — Imports depuis l'espace organisateur

- **Statut** : proposée
- **Date** : 2026-10-25
- Complète l'ADR 0009 (source de vérité du contenu), l'ADR 0013 (import d'une équipe) et l'ADR 0042 (import de listes de bénévoles).
- Précise une règle de l'ADR 0038 (fiches et espace de fichiers) : l'import de fiches par les admins d'activité.

## Contexte

Une organisation qui adopte Relaytour a déjà des données : un rétroplanning dans un tableur, une liste de l'équipe, des documents de consignes, parfois un dossier de contenu exporté d'une autre installation. L'espace organisateur n'importe aujourd'hui que des listes de bénévoles (ADR 0042).

Le reste passe par la ligne de commande, donc par la personne qui exploite le serveur :

| Données | Seul chemin actuel |
|---|---|
| Dossier de contenu (identité, activités, périmètres, fiches, tâches types) | `orga:importer` |
| Équipe (comptes, affectations, contacts principaux, souhaits) | `equipe:importer`, fichier YAML |
| Tâches d'une période | `orga:importer --edition`, depuis les tâches types seulement |
| Fiches | La commande, ou l'espace de fichiers quand un fournisseur cloud est connecté |

L'archive zip du contenu se télécharge depuis l'espace organisateur (ADR 0009), mais elle ne s'y dépose pas. Un tableur de tâches ou d'équipe ne s'importe nulle part.

## Décision

### Un moteur d'import commun

- Les imports de tableur suivent le modèle de l'import des bénévoles (ADR 0042). Le fichier CSV ou XLSX est lu dans le navigateur.
- L'admin associe ensuite les colonnes aux champs, avec une détection proposée. Il lit un aperçu, puis une simulation calculée par le serveur, avant toute écriture.
- Les limites sont celles de l'ADR 0042 : 2 Mo, 5 000 lignes et 200 colonnes par fichier.
- Seules les colonnes associées partent au serveur. Le fichier lui-même n'est jamais envoyé ni conservé.
- L'écriture se fait par lots de 500 lignes, chacun dans une transaction. Le rapport donne l'état de chaque ligne : à importer, déjà importée ou écartée, avec la raison. Les lignes écartées se téléchargent en CSV.
- Un import se relance sans créer de doublon.
- Chaque import propose un classeur modèle en CSV, produit par le navigateur, avec les colonnes attendues et deux lignes d'exemple fictives. Les tableurs l'ouvrent directement.
- L'enregistrement des correspondances de colonnes reste propre à l'import des bénévoles. Son extension aux autres imports demandera une migration de `CorrespondanceImport` et se fera à part.

### Import des tâches et des périmètres

- Un admin de l'activité importe les tâches d'une période depuis un tableur.
- Les champs sont le périmètre, le titre, la description, l'échéance, la fiche liée et la personne responsable. Seuls le périmètre et le titre sont obligatoires.
- L'échéance s'écrit en date, en `J-n` ou `J+n`, ou en « n jours avant ». Le décalage se compte depuis le premier jour de la période.
- La fiche se désigne par son titre ou par son slug. Une fiche introuvable est signalée, et la tâche est importée sans fiche.
- La personne responsable se désigne par son adresse. Elle doit déjà faire partie de l'équipe du périmètre ; sinon, la tâche est importée sans assignation (ADR 0028).
- Pour un périmètre inconnu, l'admin choisit avant l'écriture : créer le périmètre dans un groupe de l'activité, ou écarter ses lignes.
- Une ligne dont le périmètre, le titre et l'échéance existent déjà dans la période est « déjà importée ».
- Une option enregistre aussi les lignes comme tâches types de leur périmètre. Les périodes suivantes les reprennent alors (ADR 0048). Les tâches types existantes d'un périmètre ne sont jamais remplacées : l'import ajoute seulement celles qui manquent.

### Import de l'équipe

- Un admin de l'activité importe l'équipe d'une période depuis un tableur.
- Les champs sont le nom, l'adresse, les périmètres et le rôle de référente ou référent (contact principal). Le nom et l'adresse sont obligatoires.
- Une personne sans périmètre est rattachée à l'activité (ADR 0045).
- L'import suit les règles de `equipe:importer` (ADR 0013) : il crée ce qui manque, ne retire rien et ne renomme aucun compte existant. La commande et l'écran partagent le même code.
- Il applique aussi les contrôles d'une invitation : validation de l'adresse et cloisonnement de l'annuaire (ADR 0018).
- Aucun mail ne part par défaut. Une case, décochée au départ, envoie les invitations et les mails d'équipe à la fin de l'import.
- Les rôles d'admin ne s'importent pas. Ils restent attribués un par un (ADR 0019).

### Dépôt du dossier de contenu

- Un admin de l'organisation dépose une archive zip au format de l'export (ADR 0009). Le dépôt vaut `orga:importer` sans `--edition`.
- Un admin d'activité dépose une archive pour son activité seulement. Le serveur ne lit alors que `activites/<slug>/` de cette activité, ou le dossier entier dans la disposition plate. Il ignore `organisation.yaml` et les autres activités.
- Le slug de l'organisation reste celui de la base. Celui que déclare `organisation.yaml` est ignoré, et le rapport le signale.
- L'archive se simule d'abord. Le rapport reprend celui de la commande : éléments créés, modifiés, absents de l'archive, et conflits de fiches. Il liste aussi les fichiers de l'archive que l'import n'a pas lus.
- L'archive part vers une route dédiée, `POST /medias/contenu/depot`, et non vers GraphQL : une requête GraphQL est bornée à 1 Mo. Le serveur vérifie la session, l'origine et les droits avant de lire le corps de la requête.
- Un import limité à une activité ne met pas à jour la date de synchronisation de l'organisation : les autres activités ont pu changer dans l'application.
- Une modification faite dans l'application depuis la dernière synchronisation bloque l'import, comme dans la commande. L'admin peut passer outre après un avertissement explicite, ce qui équivaut à `--forcer`.
- Le serveur lit l'archive en mémoire, sans l'écrire sur le disque. Il refuse :
  - une archive de plus de 20 Mo, ou plus de 50 Mo une fois décompressée ;
  - plus de 2 000 fichiers ;
  - un chemin absolu, un chemin qui contient `..`, ou un chemin hors de la disposition attendue ;
  - le format zip64 et le chiffrement.
- Il ignore les fichiers ajoutés par les systèmes d'exploitation (`__MACOSX/`, `.DS_Store`).
- La lecture de l'archive suit l'écriture déjà présente (`lib/zip.ts`) : un code court, sans dépendance nouvelle.

### Dépôt direct de fiches

- Un admin de l'activité dépose des fichiers `.md`, `.markdown`, `.txt` ou `.docx` depuis l'écran « Ressources », pour un périmètre ou pour les fiches communes.
- Le dépôt suit les règles de l'import depuis l'espace de fichiers (ADR 0038) : même conversion, mêmes limites, même traitement des conflits.
- Une version déposée porte la source nouvelle `DEPOT`. Elle se distingue ainsi d'une version écrite dans l'éditeur ou lue dans l'espace de fichiers.
- L'ADR 0038 réserve aux admins de l'organisation le lien d'un dossier cloud, parce que le choix d'un dossier montre tous les dossiers du compte connecté. Le dépôt direct ne montre aucun dossier : il est donc ouvert aux admins d'activité.
- L'import depuis l'espace de fichiers reste réservé aux admins de l'organisation. Les modes d'emploi le décrivent désormais ainsi, à la place de la phrase de l'ADR 0038 qui l'attribuait aux admins d'activité.

### Ce qui reste hors de cette décision

- Le programme du jour J (lieux, séquences) et l'agenda (dates clés, réunions) ne s'importent pas encore. Un import iCalendar demandera sa propre décision.
- L'export complet d'une organisation (ADR 0008) ne se réimporte pas. Il sert à la portabilité des données, pas au transfert entre installations.
- L'import par connecteur depuis un outil d'inscription reste dans la feuille de route.

## Conséquences

- Les fonctions génériques de lecture et de détection de `lib/import-benevoles.ts` passent dans un module commun de l'espace organisateur (`lib/import-tableur.ts`). Les essais de l'import des bénévoles ne changent pas.
- Les nouveaux imports partagent un assistant en quatre étapes (fichier, colonnes, vérification, import). L'assistant des bénévoles garde ses étapes propres (portée, choix, doublons).
- Le contrat GraphQL gagne :
  - `simulerImportTaches` et `importerTaches` ;
  - `simulerImportEquipe` et `importerEquipe` ;
  - `simulerDepotFiches` et `deposerFiches`.
- Le dépôt du dossier de contenu passe par la route `POST /medias/contenu/depot`, simulée avec le paramètre `simulation=1`.
- `lireModeles` lit un dossier de contenu depuis le disque ou depuis une liste de fichiers en mémoire. `importerModeles` gagne une option qui ignore `organisation.yaml`.
- Une migration additive ajoute la valeur `DEPOT` à l'énumération `SourceFiche`.
- Les classeurs modèles sont livrés comme fichiers statiques de l'espace organisateur.
- Les essais d'import gagnent des fichiers CSV et XLSX fictifs pour les tâches et pour l'équipe.
- Les modes d'emploi des admins gagnent une section « Importer vos données ».

## Revue de sécurité

- Chaque import exige un admin de l'activité visée et une organisation en écriture. Le dépôt d'un dossier de contenu sans activité désignée exige un admin de l'organisation.
- Un périmètre, une fiche ou une période d'une autre activité donne le même refus qu'un identifiant inconnu (invariant 18).
- L'import de l'équipe ne donne aucun rôle d'admin. Un admin d'activité n'y lit pas l'annuaire : le rapport ne dit pas si une adresse appartient déjà à un membre d'une autre activité (ADR 0018).
- Les données personnelles de l'import de l'équipe ne sont écrites dans aucun journal ni aucun fichier du serveur. Seules les colonnes associées traversent le réseau.
- L'archive zip est lue en mémoire avec les limites ci-dessus. La décompression s'arrête dès que la taille maximale est atteinte, ce qui écarte une archive piégée.
- Un dossier de contenu importé reste soumis à la validation de `orga:valider` : champs inconnus refusés, slugs contrôlés, adresses et numéros personnels refusés dans les fiches.
- Les images d'un dossier de contenu suivent les contrôles de type et de taille de l'identité d'une organisation.
