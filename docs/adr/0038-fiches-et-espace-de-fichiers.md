# ADR 0038 — Fiches et espace de fichiers d'une organisation

- **Statut** : acceptée
- **Date** : 2026-10-20
- Complète l'ADR 0009 (source de vérité du contenu) et l'ADR 0014 (accès aux périmètres). Ajoute des appels sortants vers des tiers, sur le modèle de l'ADR 0024. Respecte l'ADR 0007 : l'espace de fichiers est facultatif et se règle par des variables.

## Contexte

Une association range ses documents dans un service en ligne : SharePoint ou OneDrive, Google Drive, Dropbox, Nextcloud. Les fiches de Relaytour renvoient à ces documents par un texte écrit à la main. Le modèle de fiche de `content/exemple` prévoit une section « Documents liés » qui donne le nom du document et son emplacement.

Les référentes et référents ont rarement un compte sur l'espace de fichiers de l'association. Les admins y copient alors des documents à la main, ou les envoient par mail. Le même document existe en plusieurs exemplaires, et aucun n'est sûr d'être à jour.

Relaytour ne stocke aucun fichier en dehors des images d'identité (ADR 0009). Un stockage de documents dans Relaytour dupliquerait l'espace de fichiers de l'association et alourdirait chaque installation.

Les fiches restent en Markdown dans Relaytour, avec leurs versions en base et leur export dans le dépôt Git de l'organisation (ADR 0009). Certaines associations veulent aussi les retrouver dans leur espace de fichiers, à côté de leurs documents.

Apple ne publie aucune API serveur pour iCloud Drive. Ce service reste hors de cette décision.

## Décision

### Un espace de fichiers facultatif, en lecture seule

- Une organisation connecte au plus un espace de fichiers. Sans connexion, la section « Fiches » reste inchangée et aucun fichier n'entre dans Relaytour.
- Relaytour lit l'espace de fichiers. Il n'y téléverse, n'y modifie et n'y supprime aucun document. La seule écriture est l'export des fiches, décrit plus bas.
- Relaytour ne copie pas le contenu d'un document. Il le relaie à la demande, au moment où une personne l'ouvre.
- Le premier fournisseur est SharePoint et OneDrive, par Microsoft Graph. Google Drive, Dropbox et Nextcloud suivent, chacun dans une réalisation à part.
- Un exploitant active un fournisseur par ses variables d'application (`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` et `MICROSOFT_LOCATAIRE` pour Microsoft) et par `CLE_CHIFFREMENT_ESPACE_FICHIERS`. Sans elles, l'espace organisateur masque ce fournisseur.

### Connexion par un admin de l'organisation

- Un admin de l'organisation connecte l'espace de fichiers depuis l'écran « Espace de fichiers ». Il se connecte avec son compte chez le fournisseur et accorde l'accès à Relaytour.
- Chez Microsoft, Relaytour demande des autorisations déléguées : `offline_access`, `User.Read`, `Files.ReadWrite.All` et `Sites.Read.All`. L'écriture sert seulement à l'export des fiches, dans le dossier choisi par un admin. La lecture des sites liste leurs bibliothèques de documents.
- Relaytour agit ensuite avec les droits de ce compte. Il ne voit que ce que ce compte voit chez le fournisseur.
- Le serveur garde le jeton de rafraîchissement, chiffré en AES-256-GCM avec `CLE_CHIFFREMENT_ESPACE_FICHIERS`. Aucun jeton n'atteint le navigateur.
- Le worker renouvelle l'accès chaque nuit. Un accès refusé passe la connexion à l'état « à reconnecter » et prévient les admins de l'organisation.
- Un admin de l'organisation déconnecte l'espace de fichiers à tout moment. Le serveur efface alors le jeton. Les dossiers liés et les ressources liées restent en base et s'affichent comme indisponibles jusqu'à une nouvelle connexion.
- Le mode de connexion de Google Drive (compte de service ou portée `drive.file`) se décide avec sa réalisation. La portée complète de Google Drive impose un audit de sécurité annuel par application.

### Dossiers liés aux périmètres

- Un admin de l'organisation lie des dossiers de l'espace de fichiers aux périmètres d'une activité. Un dossier lié sans périmètre sert à toute l'activité.
- Le lien d'un dossier est réservé aux admins de l'organisation : pour choisir un dossier, l'admin parcourt tout ce que voit le compte connecté. Un admin d'activité n'y lit donc pas les noms des dossiers des autres activités.
- Une bibliothèque entière ne se lie pas. L'admin choisit un dossier.
- Une personne lit un dossier lié à un périmètre quand elle lit les fiches de ce périmètre : elle y a été affectée au moins une fois, ou elle administre son activité. La consultation (ADR 0014) n'ouvre pas les dossiers, comme elle n'ouvre pas les fiches.
- Une personne lit un dossier lié à toute l'activité quand elle lit les fiches communes de cette activité.
- Une personne parcourt les sous-dossiers d'un dossier lié. Le serveur adresse chaque élément depuis le dossier lié, par son identifiant chez le fournisseur, puis par un chemin de noms. Il refuse un chemin qui contient « . », « .. » ou un séparateur : un élément hors du dossier lié ne peut pas être désigné.
- Le dossier d'export des fiches et ses sous-dossiers ne se lient pas à un périmètre. Ils contiennent les fiches de tous les périmètres.

### Lire un document

- La liseuse de l'espace organisateur affiche un PDF, une image, un texte ou un fichier Markdown.
- Un document Word, Excel ou PowerPoint s'affiche en PDF quand le fournisseur sait le convertir. Microsoft Graph le fait pour ces formats.
- Les autres formats proposent un téléchargement.
- Chaque document porte aussi le lien « Ouvrir dans SharePoint » (ou le nom du fournisseur). Ce lien ne fonctionne que pour une personne qui a un compte avec accès au document, et l'interface le précise.

### Ressources liées à une fiche

- Une personne qui rédige une fiche y lie des dossiers ou des fichiers de l'espace de fichiers.
- Une ressource liée doit appartenir à un dossier lié que les lecteurs de la fiche peuvent lire. Pour une fiche de périmètre, il s'agit d'un dossier lié à ce périmètre ou à toute l'activité. Pour une fiche commune, il s'agit d'un dossier lié à toute l'activité.
- La fiche affiche ses ressources liées sous son texte, avec leur nom, leur type et la liseuse.
- Les ressources liées vivent en base. Elles n'entrent pas dans le Markdown de la fiche, et un import ne les change pas.

### Export des fiches vers l'espace de fichiers

- Un admin de l'organisation choisit un dossier d'export. Relaytour y écrit les fiches non archivées de toutes les activités, au format de `orga:exporter` (en-tête `slug` et `titre`, puis le Markdown) :

  ```
  <dossier d'export>/
    README.md
    <activité>/communes/<slug>.md
    <activité>/<périmètre>/<slug>.md
  ```

- L'export va toujours de Relaytour vers l'espace de fichiers. Relaytour ne relit jamais ce dossier.
- `README.md` explique que le dossier est une copie en lecture seule. Il indique que les fiches se modifient dans Relaytour, qui gère les modifications simultanées et garde chaque version.
- Une modification de fiche planifie l'export de son activité, regroupé sur une minute. Une réconciliation complète a lieu chaque nuit.
- Relaytour ne réécrit pas une fiche dont l'empreinte n'a pas changé. Il réécrit une fiche modifiée à la main dans l'espace de fichiers, et l'écran « Espace de fichiers » le signale.
- Une fiche archivée, déplacée ou renommée disparaît de son ancien emplacement.
- Une fiche qui contient une coordonnée personnelle n'est pas exportée, comme dans `orga:exporter` (invariant 16). L'écran « Espace de fichiers » la signale.
- Le dépôt Git de l'organisation reste la sauvegarde indépendante de l'espace de fichiers.

### Import initial des fiches

- À la connexion, puis à la demande, un admin de l'organisation importe les fiches que l'association a déjà rangées dans son espace de fichiers.
- Il désigne un dossier source par périmètre et un dossier pour les fiches communes. Ces dossiers peuvent se trouver n'importe où dans l'espace de fichiers, hors du dossier d'export.
- L'import se lance d'abord en simulation. Le rapport liste les fiches créées, modifiées, inchangées, en conflit et non importées. L'admin confirme ensuite l'import.
- Un fichier `.md`, `.markdown` ou `.txt` s'importe tel quel. Un document Word (`.docx`) et un document Google Docs se convertissent en Markdown. Les autres formats restent dans l'espace de fichiers et figurent dans le rapport.
- L'écran prévient que la conversion perd une partie de la mise en forme, et que l'export écrit toujours du Markdown.
- Le slug vient de l'en-tête, sinon du nom du fichier. Le titre vient de l'en-tête, sinon du premier titre de niveau 1, sinon du nom du fichier.
- L'import suit les règles de `orga:importer`. Il crée une version seulement si l'empreinte change. Il ne remplace pas une fiche modifiée dans l'application et la signale en conflit. Il refuse une fiche qui contient une coordonnée personnelle.
- Une version importée porte la source `ESPACE_FICHIERS`.

## Conséquences

- Une migration additive ajoute :
  - l'énumération `FournisseurFichiers` ;
  - les tables `ConnexionFichiers`, `DossierLie`, `RessourceFiche` et `FicheExportee` ;
  - la valeur `ESPACE_FICHIERS` à `SourceFiche`.
- Chaque contrainte d'unicité contient l'organisation (invariant 18).
- Le serveur reçoit une interface `FournisseurFichiers` et un module par fournisseur, sans chargeur de modules (ADR 0007). Un fournisseur en mémoire sert aux tests.
- Une route `/medias/espace-fichiers/apercu` relaie un document vers la liseuse. Elle exige une session et vérifie les droits comme la requête GraphQL. Le retour de la connexion chez Microsoft arrive sur `/medias/espace-fichiers/retour/sharepoint`. Ces routes vivent sous `/medias/`, que le proxy de l'installation relaie déjà vers l'API : aucun proxy ne change.
- Le worker reçoit trois travaux : l'export des fiches d'une activité, la réconciliation de nuit et le renouvellement des accès.
- La fonction d'import des fiches de `orga:importer` devient commune au dépôt Git et à l'espace de fichiers.
- L'import utilise `mammoth` (licence BSD-2-Clause) et `turndown` (licence MIT). La liseuse utilise `pdfjs-dist` (licence Apache-2.0). Ces licences sont compatibles avec l'AGPL.
- Le flux des changements reçoit l'entité `FICHIERS` pour les dossiers liés et les ressources liées (ADR 0017).
- L'export complet d'une organisation reprend les dossiers liés et les ressources liées, sans jeton. L'archive du contenu ne les reprend pas.
- `infra/compose/.env.example` porte les variables des fournisseurs et la clé de chiffrement. Le guide d'installation explique comment inscrire l'application chez Microsoft.
- Le glossaire reçoit les mots « espace de fichiers », « dossier lié » et « document », puis « ressource liée » avec sa réalisation. La page « Fiches » garde son nom et reçoit un onglet « Documents ».
- Les modes d'emploi décrivent la connexion pour les admins de l'organisation, les dossiers liés et l'import pour les admins d'activité, et la liseuse pour les référentes et référents.

## Revue de sécurité

- La connexion, la déconnexion, le parcours de l'espace connecté, le lien d'un dossier, le choix du dossier d'export et l'import exigent le rôle ADMIN dans l'organisation active. Le lien d'une ressource à une fiche exige le droit de rédiger cette fiche. La table des refus croisés couvre chaque opération.
- La connexion suit le flux OAuth avec PKCE. Un état à usage unique, gardé dix minutes dans Valkey, désigne la personne et l'organisation. Au retour, la session doit être celle de cette personne, et elle doit toujours administrer cette organisation.
- Le jeton de rafraîchissement est chiffré en base. Il n'apparaît ni dans une réponse, ni dans le journal (invariant 6), ni dans l'export complet.
- Le compte connecté peut voir plus que les dossiers liés. Le serveur ne sert donc que les éléments adressés depuis un dossier lié lisible par la personne, avec un chemin admis. Il ne reçoit jamais du navigateur l'identifiant d'un élément quelconque. Des tests prouvent le refus d'un chemin qui sort du dossier lié, d'un dossier d'un autre périmètre et d'un dossier d'une autre organisation.
- La liseuse ne rend jamais le HTML ni le SVG d'un document. Elle les propose au téléchargement. La route d'aperçu envoie `Content-Disposition`, `X-Content-Type-Options: nosniff` et une politique de sécurité qui bloque tout script.
- Le serveur n'appelle que les hôtes du fournisseur : `graph.microsoft.com`, `login.microsoftonline.com`, puis les adresses de téléchargement `*.sharepoint.com` et le service de conversion `*.svc.ms`. Il suit lui-même une redirection, seulement vers un hôte admis et sans l'en-tête d'autorisation. Il borne chaque appel par un délai et limite un aperçu à 50 Mo.
- La route d'aperçu n'envoie aucun cache partagé (`Cache-Control: private, no-store`). Un refus et un élément absent reçoivent la même réponse.
- Un fichier importé pèse 2 Mo au plus et produit une fiche de 200 000 caractères au plus, comme une fiche rédigée dans l'application.
- L'export n'écrit que dans le dossier choisi par un admin de l'organisation. Le chemin d'une fiche se compose des slugs de l'activité, du périmètre et de la fiche, et non d'une valeur saisie librement.
- Une personne qui a un compte chez le fournisseur garde les droits que l'association lui a donnés. Relaytour n'en ajoute ni n'en retire.
