# ADR 0072 — Lecture du texte d'un document par un jeton

- **Statut** : acceptée
- **Date** : 2026-11-21
- Acceptée le 2026-11-21 : une requête `texteDocument` avec les droits de la liseuse, ouverte aux jetons par la dimension `lectureDocuments`, désactivée par défaut, pour le texte, le Markdown, Word et le PDF. Les autres options figurent sous « Options écartées ». La mise en œuvre viendra dans une PR séparée.
- Complète l'ADR 0038 (fiches et espace de fichiers), l'ADR 0043 (dossiers liés à plusieurs lecteurs), l'ADR 0064 (jetons d'accès) et l'ADR 0067 (autorisation d'applications tierces).
- Ne remplace aucune règle d'une ADR acceptée. Un jeton sans la nouvelle dimension garde l'accès actuel : il lit les noms des documents, jamais leur contenu.

## Contexte

Une organisation lie à Relaytour des dossiers de son espace de fichiers (ADR 0038). Une personne lit les éléments d'un dossier lié selon ses lecteurs (ADR 0043). Une fiche porte des documents liés, et un document ouvert aux lecteurs de la fiche se lit par cette fiche.

La liseuse de l'espace organisateur affiche un document par la route `/medias/espace-fichiers/apercu`. Cette route vérifie les droits comme la requête GraphQL. Elle exige une session : le serveur la monte avec un contexte sans jeton.

Un jeton d'accès (ADR 0064) ou un jeton d'application (ADR 0067) lit donc les dossiers liés, leurs éléments et les documents liés d'une fiche. Il lit leurs noms, leurs tailles et leurs liens web. Il ne lit jamais le contenu d'un document.

Ce manque limite les programmes au service de la personne. Un programme qui aide à préparer une réunion lit l'ordre du jour d'une fiche, mais pas le compte rendu en Word de la réunion précédente. Un programme qui répond à une question sur un règlement lit le nom du fichier, mais pas son texte. La personne ouvre alors le document elle-même et le recopie.

Trois risques accompagnent cette lecture :

- Un document peut contenir des données personnelles absentes du reste de l'espace : une liste de contacts, un tableau de bénévoles, un compte rendu nominatif.
- Un document est un texte écrit par une personne, parfois hors de l'organisation. Un programme qui le lit peut y trouver des instructions écrites pour le détourner. Relaytour ne sait pas reconnaître ces instructions.
- L'extraction du texte d'un fichier consomme de la mémoire et du temps de calcul. Un fichier piégé pourrait épuiser le serveur.

## Décision

### Ce que l'API rend

- Une requête `texteDocument(dossierLieId: ID!, chemin: [String!]!, ressourceId: ID)` rend le texte extrait d'un fichier d'un dossier lié.
- Le fichier s'adresse comme dans la liseuse : un dossier lié et un chemin de noms qui n'en sort pas. `ressourceId` désigne un document lié ouvert aux lecteurs de sa fiche (ADR 0043).
- Le résultat porte le nom du fichier, son format, le texte, la longueur du texte d'origine en caractères et un booléen `tronque`.
- Le texte se normalise comme le contenu d'une fiche (`normaliserContenu`) : fins de ligne unifiées, espaces de fin de ligne retirés. Le serveur retire en plus les caractères de contrôle, sauf le retour à la ligne et la tabulation.
- La requête rend `null` pour un fichier absent ou refusé, comme la route de la liseuse. Un refus et une absence ne se distinguent pas.

### Ordre des contrôles

- Le serveur contrôle d'abord la dimension du jeton (`PORTEE_INSUFFISANTE`). Cette réponse ne dit rien d'un fichier.
- Il vérifie ensuite les droits et l'existence du fichier. Un refus, une absence et un dossier rendent `null`.
- Viennent ensuite la limite de débit, le format, la taille et l'extraction. Leurs codes ne partent donc que vers une personne qui lit déjà le fichier dans la liseuse. Ils ne révèlent rien de plus que la liseuse.

### Qui lit le texte

- La requête applique les droits de la liseuse : la personne lit le dossier lié, ou la fiche d'un document lié ouvert à ses lecteurs. Le module documents de l'activité doit être actif (ADR 0052).
- Le dossier d'export d'une organisation, s'il se trouve sous un dossier lié, ne se lit pas.
- Une session lit le texte d'un document que la personne ouvre déjà dans la liseuse. Elle n'obtient aucune lecture de plus.
- Un jeton lit le texte seulement s'il porte la dimension `lectureDocuments`. Cette dimension est désactivée par défaut, comme `gestionMembres` (ADR 0064). Sans elle, la requête répond `PORTEE_INSUFFISANTE`.
- La dimension ne crée aucun droit. Elle autorise le jeton à lire le contenu des documents que sa personne lit déjà.
- Un jeton de robot ne reçoit jamais la dimension. Un robot lit l'activité sans les documents de ses membres.

### Comment la personne l'accorde

- Le formulaire de création d'un jeton, dans « Jetons et API », propose la case « Lire le texte des documents de l'espace de fichiers ». Elle est décochée par défaut.
- L'écran de consentement d'une application (ADR 0067) propose la même case, décochée, sous le choix de la lecture ou de l'écriture. L'application peut demander la dimension dans sa demande d'autorisation. La personne décide toujours.
- Le mail qui signale un nouveau jeton ou une nouvelle autorisation indique si la dimension est accordée.
- La liste « Applications autorisées » et le panneau « API » de l'écran « Organisation » indiquent la dimension de chaque accès.
- Un admin de l'organisation révoque un accès comme aujourd'hui. Aucun réglage de l'organisation n'ouvre la dimension à la place de la personne.

### Formats et bornes

- La requête lit un fichier texte, un fichier Markdown, un document Word (`.docx`) et un PDF. Le format se déduit du nom, jamais du type annoncé par le fournisseur, comme dans la liseuse.
- Un document Word se convertit en Markdown par la conversion de l'import des fiches (`mammoth` et `turndown`). Les images ne passent pas.
- Un PDF rend le texte de ses pages par `pdfjs-dist` (licence Apache-2.0). La liseuse l'emploie déjà dans le navigateur. Le serveur emploie sa version prévue pour Node (`legacy`), sans rendu, sans police et sans worker propre à la bibliothèque : seule l'extraction du texte (`getTextContent`) sert. Un PDF sans texte, comme un scan, rend un texte vide.
- Un document natif du fournisseur (Google Docs, par exemple) et tout autre format répondent `FORMAT_NON_LU`. Une décision ultérieure pourra les ouvrir.
- Un fichier de plus de 10 Mo répond `FICHIER_TROP_LOURD`. Le serveur compare d'abord la taille que rend le fournisseur. Quand le fournisseur ne la rend pas, ou la rend fausse, le serveur coupe le téléchargement au-delà de 10 Mo et répond le même code.
- Un PDF de plus de 200 pages ne rend que ses 200 premières pages, avec `tronque` à vrai.
- Le texte rendu compte au plus 200 000 caractères, avec `tronque` à vrai au-delà.
- L'extraction tourne dans un fil d'exécution séparé (`worker_threads`), avec une mémoire bornée et une durée de 20 secondes au plus. Au-delà, le serveur arrête le fil et répond `EXTRACTION_IMPOSSIBLE`.
- Une personne lit au plus 60 textes de document par heure, toutes sessions et tous jetons confondus. Au-delà, la requête répond `LIMITE_DE_DEBIT`. Le compte vit dans Valkey, par `limiterParCle`, comme la limite de débit des jetons : il vaut pour toutes les instances du serveur. Si Valkey ne répond pas, la requête est refusée.

### Ce que Relaytour ne promet pas

- Relaytour rend le texte tel que le document le porte. Il ne retire aucune instruction et ne marque aucun passage comme dangereux.
- La description du champ et le mode d'emploi de l'API indiquent qu'un texte de document est écrit par des personnes. Un programme le traite comme une donnée, jamais comme une instruction.

### Ce que le serveur note

- Le journal du serveur note chaque lecture par un jeton : l'identifiant du jeton, celui du dossier lié et le format. Il ne note ni le nom du fichier, ni son chemin, ni son texte.
- `dernierAccesLe` du jeton avance comme pour toute requête.

### Raisons du choix

- Les droits restent ceux de la liseuse. Un programme ne lit rien que sa personne ne puisse déjà ouvrir.
- La dimension désactivée par défaut garde l'accès actuel pour tous les jetons existants. La personne choisit en connaissance de cause, sur l'écran où elle autorise le programme.
- Le texte, le Markdown et Word réutilisent la conversion de l'import des fiches. Le PDF demande une dépendance nouvelle du serveur, `pdfjs-dist`. La bibliothèque est déjà vérifiée pour sa licence dans l'espace organisateur, mais son usage sous Node est nouveau dans le dépôt.
- Les bornes de taille, de pages, de durée et de débit empêchent un fichier piégé d'épuiser le serveur.

## Options écartées

### Ouvrir la route de la liseuse aux jetons

- La route `/medias/espace-fichiers/apercu` accepterait un jeton.
- Elle rend le fichier brut, jusqu'à 50 Mo, dans son format d'origine. Le programme devrait extraire le texte lui-même.
- Un jeton fuité téléchargerait alors tous les fichiers des dossiers lisibles, images et tableurs compris.

### Un réglage de l'organisation à la place de la dimension

- Un admin de l'organisation ouvrirait la lecture des documents à tous les jetons de l'organisation.
- La personne qui autorise un programme ne choisirait plus ce qu'il lit. Un jeton créé pour lire l'agenda lirait aussi les comptes rendus.
- Cette option irait contre l'ADR 0064 : un jeton réduit les droits de sa personne, et la personne fixe cette réduction.

### Tous les formats du fournisseur

- La requête lirait aussi les tableurs, les présentations et les documents natifs, par la conversion en PDF du fournisseur.
- Chaque fournisseur convertit à sa façon, avec ses propres limites et ses propres erreurs.
- Un tableur rendu en texte perd sa structure, et le programme lirait un texte trompeur. Une décision ultérieure pourra traiter ces formats un par un.

### Marquer ou filtrer les instructions dans le texte

- Le serveur chercherait dans le texte des phrases qui ressemblent à des instructions et les retirerait.
- Aucune règle ne distingue une instruction piégée d'une consigne légitime d'un règlement. Le filtre donnerait une fausse assurance et altérerait des documents ordinaires.
- Le programme qui lit le texte reste le seul à pouvoir le traiter comme une donnée.

## Conséquences

- Une migration additive ajoute la colonne `JetonAcces.lectureDocuments`, fausse par défaut. Les jetons existants ne lisent aucun texte. Après un retour à une version antérieure, la requête disparaît et aucune donnée ne se perd.
- Le contrat GraphQL gagne la requête `texteDocument`, son type de résultat et l'argument de la dimension dans la création d'un jeton. `yarn codegen` régénère les contrats.
- `pdfjs-dist` entre dans les dépendances du serveur. `outils/verifier-licences.mjs` la vérifie.
- `schema/portees.test.ts` fige une quatrième liste : les champs qui exigent `lectureDocuments`.
- Le glossaire reçoit le terme « texte d'un document » (anglais « document text »).
- Le mode d'emploi de l'API décrit la requête, la dimension et le risque d'un texte écrit par des personnes.

## Revue de sécurité

Les tests de la mise en œuvre prouvent chaque contrôle par le refus :

- un jeton sans `lectureDocuments` reçoit `PORTEE_INSUFFISANTE`, même pour un document qu'il nomme déjà ;
- un jeton de robot ne reçoit jamais la dimension, ni à la création ni par une modification ;
- une personne qui ne lit pas le dossier lié reçoit `null`, comme pour un fichier absent ;
- un document lié ouvert aux lecteurs d'une fiche se lit par cette fiche, et un autre fichier du même dossier ne se lit pas ;
- un chemin qui sort du dossier lié, ou qui entre dans le dossier d'export, reçoit `null` ;
- une activité sans le module documents ne rend aucun texte ;
- un fichier de plus de 10 Mo, un format non lu et une extraction trop longue reçoivent leur code, sans texte partiel ;
- un fichier dont le fournisseur ne rend pas la taille se coupe à 10 Mo pendant le téléchargement ;
- une personne sans droit reçoit `null` pour un fichier trop lourd ou d'un format non lu, comme pour un fichier absent ;
- un PDF de plus de 200 pages et un texte de plus de 200 000 caractères rendent `tronque` à vrai ;
- la limite de 60 textes par heure compte les sessions et les jetons d'une même personne ;
- le journal du serveur ne contient ni nom de fichier, ni chemin, ni texte.
