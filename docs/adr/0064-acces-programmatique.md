# ADR 0064 — Accès programmatique : module API et jetons d'accès

- **Statut** : proposée
- **Date** : 2026-11-09
- Réalise la section « Pour plus tard » de l'ADR 0013. Complète l'ADR 0008 (administration de l'installation), l'ADR 0031 (archivage par organisation) et l'ADR 0035 (jeton d'administration local).

## Contexte

Une personne ne travaille aujourd'hui dans Relaytour que par l'espace organisateur. Un programme tiers ne peut ni lire ses tâches ni en créer : une ligne de commande, un outil de gestion de projet, une automatisation ou un assistant n'ont aucun accès.

Le seul accès programmatique est le jeton d'administration de l'installation (ADR 0008). Il n'ouvre que les opérations de l'hébergeur, n'agit au nom d'aucune personne, et ne répond qu'aux requêtes locales (ADR 0035). L'ADR 0013 annonçait déjà un jeton propre à une organisation, avec des droits limités.

L'API GraphQL contrôle déjà chaque champ selon la personne et son organisation. Un programme tiers peut donc s'en servir s'il agit au nom d'une personne, avec ses droits et jamais plus.

## Décision

### Le module « API » de l'organisation

- Chaque organisation a un module « API », inactif par défaut. Tant qu'il est inactif, aucun jeton d'accès ne se crée et aucun jeton ne répond.
- Un admin de l'organisation l'active ou le désactive (`activerApi`, `desactiverApi`). Une désactivation ne révoque aucun jeton : les jetons cessent de répondre, puis répondent de nouveau à la réactivation.
- L'administration de l'installation règle le module par l'argument `api` de `modifierOrganisationInstallation` :
  - `autorisee: false` interdit l'API à l'organisation ;
  - `imposee: true` active l'API, quel que soit le choix de l'organisation ;
  - `suspendue: true`, avec un motif obligatoire, suspend l'API et révoque tous les jetons de l'organisation dans la même transaction ;
  - `suspendue: false` lève la suspension. Les membres créent alors de nouveaux jetons.
- L'état effectif suit cet ordre : `SUSPENDUE`, puis `INTERDITE`, puis `IMPOSEE`, puis `ACTIVE`, sinon `INACTIVE`. Les jetons répondent pour `ACTIVE` et `IMPOSEE` seulement.
- Les membres lisent l'état et le motif d'une suspension par `apiOrganisation`. L'administration de l'installation lit l'état, ses réglages et le nombre de jetons actifs dans `organisations`, sans aucune donnée des membres.
- Le module est le même sur toute installation. Une organisation auto-hébergée l'active elle-même (ADR 0007).

### Les jetons d'accès

- Une personne crée ses jetons avec sa session (`creerJetonAcces`). Un jeton vaut pour une personne et une seule organisation : celle de la session au moment de la création.
- Un jeton a la forme `rt_` suivi de 43 caractères base64url (32 octets aléatoires). Le préfixe le distingue du jeton d'administration et facilite la détection d'un jeton publié par erreur.
- Le serveur garde l'empreinte SHA-256 du jeton, jamais le jeton. La valeur s'affiche une seule fois, à la création. Les huit caractères qui suivent le préfixe restent lisibles, pour reconnaître le jeton à l'écran.
- Un jeton porte un nom, une portée, une liste facultative d'activités et une date de fin :
  - la portée `LECTURE` refuse toute mutation avec le code `PORTEE_INSUFFISANTE` ; `LECTURE_ECRITURE` écrit avec les droits de la personne ;
  - une liste d'activités réduit chaque ensemble d'activités du contexte (administrées, visibles, découvertes) et les affectations lues. Une activité hors de la liste vaut une activité d'une autre organisation ;
  - un jeton limité à des activités ne porte pas le rôle d'admin de l'organisation. Il administre seulement les activités de sa liste que la personne administre ;
  - la date de fin est obligatoire : un an par défaut, un an au plus ;
  - la gestion des membres est une dimension à part, désactivée par défaut (`gestionMembres`). Sans elle, le jeton n'invite, n'affecte, ne retire ni ne promeut personne : `inviterPersonne`, `accepterDemande`, `archiverPersonne`, `modifierPersonne`, `definirAdminActivite`, `rattacherALActivite`, `retirerDeLActivite`, `affecter`, `retirerAffectation`, `importerEquipe`, `relancerInvitation` et `retirerInvitation` répondent `PORTEE_INSUFFISANTE`. Un jeton fuité ne change donc pas l'équipe. Cette dimension ne crée aucun droit : elle en retire un par défaut, et la personne garde les siens. Un jeton de robot ne la reçoit jamais.
- Une personne a au plus 10 jetons actifs par organisation. Le plafond se vérifie sous le verrou de l'organisation.
- Un jeton n'ouvre jamais plus que la session de la personne. Le contrôle des champs reste celui de l'API : un jeton ne crée aucun droit.
- Une requête porteuse d'un jeton lit ses bornes par `jetonCourant`.
- La création d'un jeton se signale par mail à la personne au nom de qui il agit, avec sa portée et un lien de révocation signé (`/medias/jeton/revocation/`) qui coupe l'accès sans session. Le jeton d'un robot se signale à l'admin qui l'a créé. Une session volée ne crée donc pas un accès d'un an en silence.
- Un admin de l'organisation lit les jetons de tous les membres et des robots (`jetonsAccesOrganisation`), sans leur valeur, et révoque chacun (`revoquerJetonOrganisation`). La porteuse l'apprend par mail, qui nomme l'admin. Une personne révoque tous ses jetons d'un geste (`revoquerMesJetonsAcces`).

### Les robots

- Un robot est un membre de l'organisation sans connexion. Un admin de l'organisation le crée, avec sa session, pour une automatisation partagée : une synchronisation avec un outil de gestion de projet, un script d'équipe.
- Le robot est un compte (`User.robot`), avec une appartenance de membre. Ses actions ont ainsi un auteur dans le journal, le fil d'une tâche et les notifications, comme celles d'une personne.
- La création le rattache aux activités choisies. Il reçoit ensuite ses droits par les écrans existants : rattachements, affectations, rôle d'admin d'une activité. Il n'est jamais admin de l'organisation.
- Son adresse est technique, dans le domaine réservé `.invalid` (RFC 2606) :
  - l'envoi d'un mail vers une adresse `.invalid` n'a jamais lieu ;
  - aucun code de connexion ne se prépare pour un robot ;
  - une adresse `.invalid` est refusée partout où une personne entre par son adresse (invitation, import, formulaire public).
- Un robot prend une place de membre (ADR 0058). Une organisation compte cinq robots actifs au plus.
- Un admin de l'organisation crée et révoque les jetons d'un robot, cinq actifs au plus. Les activités d'un jeton de robot se vérifient contre celles que le robot voit, jamais contre celles de l'admin.
- L'archivage d'un robot révoque ses jetons et libère sa place. Un robot archivé ne reçoit pas de jeton.
- Un robot n'entre ni au classement (ADR 0056) ni à l'organigramme (ADR 0036). L'annuaire et l'équipe l'affichent avec l'étiquette « robot », sans adresse et sans bouton pour lui écrire.

### Ce qu'un jeton n'ouvre pas

Un jeton ne remplace pas la session. Ces opérations exigent une session de l'espace organisateur :

- la gestion des jetons : créer, lister, révoquer, pour soi comme pour l'organisation ;
- les opérations du compte : choisir une organisation, accepter une invitation, changer son nom ou sa langue, lire les notifications des autres organisations ;
- les secrets et les appareils : abonnements à l'agenda (ADR 0037), notifications push (ADR 0024), connexion au fournisseur cloud (ADR 0038) ;
- les réglages personnels : préférences de notification, accord de l'organigramme (ADR 0036) ;
- le lien personnel de l'espace bénévole d'une autre personne et son renvoi (ADR 0041), qui identifient cette personne ;
- l'export complet et l'export du contenu, qui livrent les noms et les adresses des membres ;
- l'activation et la désactivation du module.

Les notifications de l'organisation ne passent pas par les activités. Un jeton limité à des activités ne les lit donc pas, et un jeton sans liste les lit.

### Transport

- `/graphql` accepte `Authorization: Bearer rt_…`. Le jeton désigne la personne et l'organisation : l'en-tête `X-Relaytour-Organisation` ne compte pas. L'en-tête `X-Relaytour-Activite` choisit l'activité par défaut parmi celles du jeton.
- Un jeton refusé reçoit un statut HTTP avant toute exécution :
  - 401 `JETON_INVALIDE`, avec `WWW-Authenticate`, pour un jeton inconnu, révoqué, expiré, d'une personne archivée ou d'une organisation suspendue. Le message est le même dans tous les cas ;
  - 403 `API_INACTIVE` quand le module est fermé. L'extension `cause` vaut `organisation`, `hebergeur` ou `suspendue`, et le message reprend le motif d'une suspension ;
  - 429 `LIMITE_DE_DEBIT`, avec `Retry-After`, au-delà de la limite de débit.
- Le flux des changements (ADR 0017) accepte le même jeton. Les autres routes (dépôt de contenu, espace de fichiers) servent l'espace organisateur seul : un jeton d'accès y rend la requête anonyme.
- CORS ne change pas. Un jeton sert un programme, pas une page d'une autre origine.
- L'introspection reste fermée en production. Le contrat publié `packages/server/schema.graphql` documente l'API.

### API REST v1

- Un outil qui ne parle pas GraphQL appelle l'API REST sous `/api/v1/`, avec le même jeton. Une session de l'espace organisateur ne l'ouvre pas : un cookie n'y est jamais lu.
- Chaque route exécute un document GraphQL écrit dans `packages/server/src/api-rest/operations.ts`, sur le schéma de l'API, avec le contexte du jeton. Une route n'ouvre donc aucun droit que GraphQL n'ouvre pas.
- La liste des routes est fermée. Elle couvre la personne et son jeton, les activités, les périodes, les périmètres et l'équipe, les tâches, les priorités, les commentaires et les fiches. Elle crée, modifie, assigne et commente une tâche, et change son statut.
- Un document ne sélectionne que des champs lisibles par toute personne qui lit l'objet. L'équipe se rend sans adresses.
- Une route lit ses paramètres dans le chemin, puis dans l'adresse pour `GET` ou dans un corps JSON d'un mégaoctet au plus pour `POST` et `PATCH`.
- Une réponse réussie rend la valeur du champ racine, avec le statut 200, ou 201 pour une création. Une erreur rend `{ erreurs: [{ code, message }] }` avec un statut tiré du code : 400 saisie, 401 jeton, 403 accès, portée, API fermée ou lecture seule, 409 conflit, 422 limite, 429 débit, 500 erreur interne masquée avec sa référence.
- `/api/v1/openapi.json` sert le contrat OpenAPI 3.0, sans jeton. Le contrat se calcule à partir des documents : une réponse décrit les champs sélectionnés, pas le type GraphQL entier. `packages/server/openapi.json` en est la copie commitée, vérifiée en CI comme `schema.graphql`.
- Chaque document reste sous la limite de complexité du serveur (2 000 points), et un test le vérifie.
- Le relais de l'exploitant transmet `/api/v1/*` comme `/graphql`.

### Sécurité

- Un jeton accepté compte 120 requêtes par minute au plus. L'ouverture d'un flux des changements compte une requête, puis chaque relecture de ses droits en compte une autre. Quand Redis ne répond pas, la limite refuse : un programme sait réessayer, et l'espace organisateur n'est pas touché.
- Les jetons refusés se comptent par adresse : au-delà de 60 refus en un quart d'heure, l'adresse reçoit la limite de débit, même avec un jeton exact. La valeur reste haute, car un programme qui relaie plusieurs personnes appelle depuis une seule adresse.
- Cette limite par adresse est un compromis assumé. Derrière un proxy ou un NAT partagé, un programme mal configuré peut fermer l'API aux autres programmes de la même adresse pendant un quart d'heure. Elle borne en échange une recherche de jetons à l'aveugle.
- Le jeton n'entre jamais au journal (invariant 6). Le journal garde l'identifiant du jeton et l'événement : `jeton-acces-cree`, `jeton-acces-revoque`, `jeton-acces-refuse`.
- Le dernier usage d'un jeton s'écrit au plus une fois par minute. La personne le lit à côté de chaque jeton.
- L'archivage d'une personne dans une organisation révoque ses jetons dans la même transaction. Un rétablissement ne les rouvre pas.
- Une personne ne révoque que ses propres jetons, et un admin de l'organisation ceux de toute l'organisation. Un identifiant d'un autre jeton ne fait rien et rend faux. Une révocation par un admin note son auteur (`revoqueParId`) et se signale à la porteuse.
- Les mails `jeton-cree` et `jeton-revoque` ne sont jamais reportés par le plafond quotidien. Le lien de révocation ne vaut que pour un jeton encore actif : révoqué ou expiré, il répond comme un lien non valide.
- Le contrat `/api/v1/openapi.json`, lisible sans jeton, porte la version du contrat (`1.0.0`), jamais celle de l'installation.

## Options écartées

- **Un jeton d'organisation sans compte.** Le journal, le fil d'une tâche, les notifications et le score attribuent chaque action à un compte. Un jeton sans compte demanderait un acteur fictif, ou des colonnes nulles dans toutes ces tables.
- **OAuth dans Relaytour.** Chaque installation devrait enregistrer les programmes clients et tenir un serveur d'autorisation. Un jeton personnel suffit à une ligne de commande et à une automatisation. Un programme tiers peut proposer OAuth à ses propres utilisateurs.
- **Une API REST générée pour tout le schéma (Sofa).** La bibliothèque `sofa-api` crée une route par champ racine, choisit elle-même les champs rendus et ouvre des routes de webhook. Une seule erreur de champ fait alors échouer toute la réponse, et le contrat décrit chaque type GraphQL entier. Une liste fermée de documents écrits à la main garde des réponses exactes et un contrat lisible.
- **Un jeton sans date de fin.** Un jeton oublié resterait valable. La date de fin d'un an borne le risque d'une fuite.
- **Des droits fins par opération.** Les droits de la personne existent déjà, champ par champ. Une liste d'opérations par jeton serait une seconde politique d'accès à tenir.

## Conséquences

- Deux migrations additives ajoutent cinq colonnes à `Organisation`, la table `JetonAcces` et la colonne `User.robot`. Une troisième ajoute `JetonAcces.gestionMembres` et `JetonAcces.revoqueParId`. Après un retour à une version antérieure, les jetons cessent de répondre, un robot devient un compte ordinaire sans connexion, et aucune donnée ne se perd.
- Un admin de l'organisation qui n'active pas le module ne change rien à son organisation.
- Une opération nouvelle qui touche au compte, à un secret ou à un appareil exige `session` dans ses `authScopes`. Une lecture nouvelle de toute l'organisation, hors des activités, exige `toutesActivites`. Une opération nouvelle qui ajoute, retire ou promeut une personne exige `gestionMembres`. `schema/portees.test.ts` fige les trois listes : un champ qui entre ou sort se décide à la revue.
- Une opération nouvelle qui reçoit un identifiant entre dans la table des refus croisés, comme aujourd'hui. Le garde-fou couvre `creerJetonAcces`, `revoquerJetonAcces`, `creerRobot`, `creerJetonRobot` et `revoquerJetonRobot`.
- Toute nouvelle façon de faire entrer une personne par son adresse passe par `adresseValide`, qui refuse le domaine `.invalid`.
- Les webhooks sortants restent hors de cette décision (feuille de route).

## Revue de sécurité

Les tests prouvent chaque contrôle par le refus (`jetons-acces.integration.test.ts`, `robots.integration.test.ts`, `api-rest.integration.test.ts`, `refus-croises.integration.test.ts`) :

- un module inactif, interdit ou suspendu refuse la création et l'usage des jetons, avec sa cause ;
- un jeton en lecture refuse une mutation ;
- un jeton limité à une activité ne lit ni n'écrit dans une autre activité, et ne lit pas les notifications ;
- un jeton d'un admin limité à une activité ne lit pas l'annuaire ;
- un jeton n'ouvre ni la gestion des jetons, ni les opérations du compte, ni les secrets ;
- un jeton révoqué, expiré, inconnu ou mal formé reçoit le même refus ;
- une personne ne révoque pas le jeton d'une autre, un admin de l'organisation révoque celui d'un membre, et la porteuse en est prévenue (`jetons-acces.integration.test.ts`) ;
- la création d'un jeton met en file un mail dont le lien signé révoque le jeton sans session, une seule fois ;
- un jeton sans la dimension « gestion des membres » n'invite ni ne renomme personne, et la reçoit avec elle ;
- les champs à portée `session` et `gestionMembres` sont ceux de la liste figée (`portees.test.ts`) ;
- la suspension et l'archivage révoquent les jetons ;
- le journal ne reçoit jamais un jeton ;
- la route GraphQL répond 401, 403 ou 429 avant toute exécution ;
- l'API REST refuse une requête sans jeton, même avec un cookie, et rend chaque refus avec son statut ;
- une référente, un jeton ou un admin d'une autre organisation ne crée ni robot ni jeton de robot ;
- un robot prend une place de membre, ne devient pas admin de l'organisation, n'entre pas par son adresse et ne reçoit aucun mail ;
- les activités d'un jeton de robot se vérifient contre celles du robot.

## Plan de mise en œuvre

1. Serveur : module, jetons, contexte, scopes, administration de l'installation, tests (cette ADR, statut proposée).
2. Espace organisateur : panneau « Jetons et API » des préférences, entrée du menu du compte, panneau « API » de l'écran « Organisation ».
3. API REST v1 sur une liste fermée de documents GraphQL, avec son contrat OpenAPI calculé et commité. Elle demande une ligne de relais `/api/v1/*` chez l'exploitant.
4. Robots : des membres sans connexion, créés par un admin de l'organisation, qui portent des jetons pour une automatisation partagée. Ils se gèrent sous le panneau « API » de l'écran « Organisation ».
5. Mode d'emploi de l'API, glossaire, et passage de l'ADR à « acceptée ».
