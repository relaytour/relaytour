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
  - la date de fin est obligatoire : un an par défaut, un an au plus.
- Une personne a au plus 10 jetons actifs par organisation. Le plafond se vérifie sous le verrou de l'organisation.
- Un jeton n'ouvre jamais plus que la session de la personne. Le contrôle des champs reste celui de l'API : un jeton ne crée aucun droit.
- Une requête porteuse d'un jeton lit ses bornes par `jetonCourant`.

### Ce qu'un jeton n'ouvre pas

Un jeton ne remplace pas la session. Ces opérations exigent une session de l'espace organisateur :

- la gestion des jetons : créer, lister, révoquer ;
- les opérations du compte : choisir une organisation, accepter une invitation, changer son nom ou sa langue, lire les notifications des autres organisations ;
- les secrets et les appareils : abonnements à l'agenda (ADR 0037), notifications push (ADR 0024), connexion au fournisseur cloud (ADR 0038) ;
- les réglages personnels : préférences de notification, accord de l'organigramme (ADR 0036) ;
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

### Sécurité

- Un jeton accepté compte 120 requêtes par minute au plus. Les jetons refusés se comptent par adresse : au-delà de 60 refus en un quart d'heure, l'adresse reçoit la limite de débit, même avec un jeton exact. La valeur reste haute, car un programme qui relaie plusieurs personnes appelle depuis une seule adresse.
- Le jeton n'entre jamais au journal (invariant 6). Le journal garde l'identifiant du jeton et l'événement : `jeton-acces-cree`, `jeton-acces-revoque`, `jeton-acces-refuse`.
- Le dernier usage d'un jeton s'écrit au plus une fois par minute. La personne le lit à côté de chaque jeton.
- L'archivage d'une personne dans une organisation révoque ses jetons dans la même transaction. Un rétablissement ne les rouvre pas.
- Une personne ne révoque que ses propres jetons. Un identifiant d'un autre jeton ne fait rien et rend faux.

## Options écartées

- **Un jeton d'organisation sans compte.** Le journal, le fil d'une tâche, les notifications et le score attribuent chaque action à un compte. Un jeton sans compte demanderait un acteur fictif, ou des colonnes nulles dans toutes ces tables.
- **OAuth dans Relaytour.** Chaque installation devrait enregistrer les programmes clients et tenir un serveur d'autorisation. Un jeton personnel suffit à une ligne de commande et à une automatisation. Un programme tiers peut proposer OAuth à ses propres utilisateurs.
- **Un jeton sans date de fin.** Un jeton oublié resterait valable. La date de fin d'un an borne le risque d'une fuite.
- **Des droits fins par opération.** Les droits de la personne existent déjà, champ par champ. Une liste d'opérations par jeton serait une seconde politique d'accès à tenir.

## Conséquences

- Une migration additive ajoute cinq colonnes à `Organisation` et la table `JetonAcces`. Après un retour à une version antérieure, les jetons cessent de répondre et aucune donnée ne se perd.
- Un admin de l'organisation qui n'active pas le module ne change rien à son organisation.
- Une opération nouvelle qui touche au compte, à un secret ou à un appareil exige `session` dans ses `authScopes`. Une lecture nouvelle de toute l'organisation, hors des activités, exige `toutesActivites`.
- Une opération nouvelle qui reçoit un identifiant entre dans la table des refus croisés, comme aujourd'hui. Le garde-fou couvre `creerJetonAcces` et `revoquerJetonAcces`.
- Les webhooks sortants restent hors de cette décision (feuille de route).

## Revue de sécurité

Les tests prouvent chaque contrôle par le refus (`jetons-acces.integration.test.ts`, `refus-croises.integration.test.ts`) :

- un module inactif, interdit ou suspendu refuse la création et l'usage des jetons, avec sa cause ;
- un jeton en lecture refuse une mutation ;
- un jeton limité à une activité ne lit ni n'écrit dans une autre activité, et ne lit pas les notifications ;
- un jeton d'un admin limité à une activité ne lit pas l'annuaire ;
- un jeton n'ouvre ni la gestion des jetons, ni les opérations du compte, ni les secrets ;
- un jeton révoqué, expiré, inconnu ou mal formé reçoit le même refus ;
- une personne ne révoque pas le jeton d'une autre ;
- la suspension et l'archivage révoquent les jetons ;
- le journal ne reçoit jamais un jeton ;
- la route GraphQL répond 401, 403 ou 429 avant toute exécution.

## Plan de mise en œuvre

1. Serveur : module, jetons, contexte, scopes, administration de l'installation, tests (cette ADR, statut proposée).
2. Espace organisateur : panneau « Jetons et API » des préférences, entrée du menu du compte, panneau « API » de l'écran « Organisation ».
3. API REST v1 générée depuis le schéma, sur une liste choisie d'opérations, avec son contrat OpenAPI commité. Elle demande une ligne de relais `/api/v1/*` chez l'exploitant.
4. Robots : des membres sans connexion, créés par un admin de l'organisation, qui portent des jetons pour une automatisation partagée.
5. Mode d'emploi de l'API, glossaire, et passage de l'ADR à « acceptée ».
