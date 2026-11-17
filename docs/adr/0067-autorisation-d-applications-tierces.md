# ADR 0067 — Autorisation d'applications tierces

- **Statut** : acceptée
- **Date** : 2026-11-17
- Complète l'ADR 0064 (module API et jetons d'accès). Revient sur son option écartée « OAuth dans Relaytour ». S'appuie sur l'ADR 0007 (frontière entre logiciel et exploitation) et sur l'ADR 0035 (connexion).

## Contexte

L'ADR 0064 ouvre l'API à un programme tiers par un jeton d'accès personnel. La personne crée le jeton dans « Jetons et API », le copie, puis le colle dans le programme.

Ce parcours convient à une personne qui écrit un script. Il bloque les autres :

- Une personne sans compétence technique ne sait pas où créer un jeton, ni quelle portée choisir, ni où le coller.
- Un jeton copié circule par le presse-papiers, un mail ou une messagerie. Il reste valable un an.
- Un service d'automatisation (Zapier, n8n, Make) attend un bouton « Se connecter », puis un retour automatique. Il ne propose pas de champ pour coller un secret.
- La personne ne voit pas quelle application utilise quel jeton.

OAuth 2.1 règle ce parcours. L'application envoie la personne vers son installation. La personne se connecte, lit ce que l'application demande, puis accepte ou refuse. L'application reçoit des jetons de courte durée, sans que la personne ait rien copié.

Chaque organisation peut avoir sa propre installation, à sa propre adresse. Une application ne peut donc pas s'enregistrer à l'avance auprès de chaque installation. Le document de métadonnées de client (CIMD) lève cet obstacle. L'identifiant du client est une adresse https qui publie sa description. L'installation lit ce document au moment de l'autorisation.

## Décision

### Ce que l'installation devient

- Chaque installation est un serveur d'autorisation OAuth 2.1 pour sa propre API. Son émetteur (`issuer`) est `ORIGINE_ORGA`.
- L'installation est aussi le seul serveur de ressources de ses jetons : `/graphql`, le flux des changements (ADR 0017) et `/api/v1/`.
- Relaytour n'est pas un fournisseur d'identité. L'installation ne fait ni OpenID Connect, ni `id_token`, ni portée `openid`. Un bouton « Se connecter avec Relaytour » sur un autre site reste hors de cette décision.
- La fonction est la même sur toute installation, auto-hébergée comprise (ADR 0007). Elle ne connaît aucune application particulière et n'en favorise aucune.
- Une autorisation n'existe que si le module « API » de l'organisation répond (`ACTIVE` ou `IMPOSEE`, ADR 0064).

### Métadonnées

- `GET /.well-known/oauth-authorization-server` rend les métadonnées du serveur d'autorisation (RFC 8414) :
  - `issuer`, `authorization_endpoint` (`/oauth/autoriser`), `token_endpoint` (`/oauth/jeton`) et `revocation_endpoint` (`/oauth/revocation`) ;
  - `registration_endpoint` (`/oauth/enregistrement`), seulement quand l'enregistrement dynamique est ouvert ;
  - `response_types_supported: ["code"]` et `grant_types_supported: ["authorization_code", "refresh_token"]` ;
  - `code_challenge_methods_supported: ["S256"]` et `token_endpoint_auth_methods_supported: ["none"]` ;
  - `scopes_supported: ["lecture", "ecriture"]` ;
  - `client_id_metadata_document_supported: true` et `authorization_response_iss_parameter_supported: true`.
- `GET /.well-known/oauth-protected-resource` rend les métadonnées de la ressource (RFC 9728). La ressource vaut `ORIGINE_ORGA`, et son seul serveur d'autorisation est l'émetteur.
- Une requête sans jeton valable sur `/graphql` ou `/api/v1/` reçoit, en plus du refus de l'ADR 0064, `WWW-Authenticate: Bearer resource_metadata="…"`. Une application qui ne connaît que l'adresse de l'installation trouve ainsi le reste.
- Les métadonnées ne portent ni la version de l'installation ni le nom de l'organisation.

### Clients

- **Le document de métadonnées de client (CIMD) est le mode principal.** Le `client_id` est une adresse https. L'installation lit ce document à chaque demande d'autorisation, avec ces règles :
  - adresse publique seulement, désignée par un nom de domaine (ni adresse IP, ni `localhost`), sans redirection, en 5 secondes au plus, lecture arrêtée à 16 Ko ;
  - le champ `client_id` du document doit être égal à l'adresse lue ;
  - le document doit déclarer `client_name` et `redirect_uris`, et `token_endpoint_auth_method` doit valoir `none` ;
  - le cache suit les en-têtes HTTP, 24 heures au plus.
- **L'enregistrement dynamique (DCR, RFC 7591) est facultatif et fermé par défaut.** L'exploitant l'ouvre par `APPLICATIONS_ENREGISTREMENT_DYNAMIQUE=true`, pour des applications qui ne publient pas encore de CIMD.
  - Un client enregistré ainsi est signalé « non vérifié » sur l'écran de consentement : son nom et son site sont déclarés par lui-même.
  - L'enregistrement se limite par adresse. Un client sans autorisation pendant 30 jours est supprimé.
- Le nom d'un client fait 80 caractères au plus, sans retour à la ligne. L'installation n'affiche aucun logo distant : le navigateur de la personne ne contacte pas le site de l'application avant son accord.
- Une adresse de retour se compare exactement à celles du client. Seule exception, une application installée sur l'appareil peut déclarer une adresse de boucle locale `http://127.0.0.1/…`, dont le port est libre (RFC 8252).
- Tous les clients sont publics en v1. Un client confidentiel (`private_key_jwt`) reste pour plus tard.

### Parcours d'autorisation

1. L'application ouvre `/oauth/autoriser` avec `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge` (S256) et `resource`. Sans PKCE S256, la demande est refusée.
2. Le serveur vérifie le client, l'adresse de retour et la ressource, puis garde la demande 15 minutes. Une demande invalide avant la vérification de l'adresse de retour s'affiche en erreur sur l'installation, sans redirection.
3. Le serveur renvoie le navigateur vers l'écran de consentement de l'espace organisateur. La personne se connecte d'abord si elle n'a pas de session (ADR 0002).
4. La personne choisit l'organisation, la portée et les activités, puis accepte ou refuse.
5. Le serveur renvoie le navigateur vers l'adresse de retour, avec `code`, `state` et `iss` (RFC 9207). Un refus renvoie `error=access_denied`.
6. L'application échange le code sur `/oauth/jeton`, avec `code_verifier` et `resource`. Elle reçoit un jeton d'application et un jeton de renouvellement.

Un code vaut 60 secondes et une seule fois. Un code rejoué révoque l'autorisation qu'il a créée.

### Consentement

- L'écran de consentement est une page de l'espace organisateur. Il ne s'affiche jamais dans un cadre (`frame-ancestors 'none'`) et ne charge aucune ressource de l'application.
- Il s'affiche à chaque demande, même pour une application déjà autorisée. Aucun accord n'est implicite.
- Il nomme l'application, l'hôte de son adresse de retour, l'organisation, la portée et les activités.
- La personne peut réduire ce que l'application demande : passer de l'écriture à la lecture, ou limiter les activités. Elle ne peut pas l'étendre.
- Le texte suit le catalogue de l'interface (ADR 0047). Textes de référence :

| Élément | Français | Anglais |
|---|---|---|
| Titre | « [Application] demande l'accès à votre compte dans [organisation] » | "[Application] wants to access your account in [organization]" |
| Lecture | « Elle pourra lire ce que vous voyez dans les activités choisies : tâches, fiches, agenda et équipe. » | "It will be able to read what you can see in the selected activities: tasks, records, calendar and team." |
| Écriture | « Elle pourra aussi écrire en votre nom : créer et modifier des tâches, et les commenter. » | "It will also be able to write on your behalf: create and edit tasks, and comment on them." |
| Limites | « Elle agit avec vos droits, jamais plus. Elle ne peut ni gérer les membres, ni créer de jetons, ni modifier votre compte. » | "It acts with your permissions, never more. It cannot manage members, create tokens or change your account." |
| Activités | « Activités : toutes vos activités » ou la liste choisie | "Activities: all your activities" or the selected list |
| Retour | « Après votre réponse, vous reviendrez sur [hôte]. » | "After you answer, you will return to [host]." |
| Client non vérifié | « Cette application s'est enregistrée elle-même. Son nom n'est pas vérifié. » | "This application registered itself. Its name has not been verified." |
| Révocation | « Vous pouvez retirer cet accès à tout moment dans Préférences, Jetons et API. » | "You can remove this access at any time in Preferences, Tokens and API." |
| Boutons | « Autoriser » et « Refuser » | "Allow" and "Deny" |

### Jetons

- Une autorisation d'application lie une personne, une organisation et un client. Elle porte une portée, une liste facultative d'activités et une date de fin d'un an.
- Ses bornes sont celles d'un jeton d'accès de l'ADR 0064, sans exception :
  - la portée `lecture` vaut `LECTURE`, et la portée `lecture ecriture` vaut `LECTURE_ECRITURE` ;
  - la liste d'activités réduit le contexte comme celle d'un jeton d'accès ;
  - la dimension « gestion des membres » n'est jamais accordée à une application ;
  - la liste « Ce qu'un jeton n'ouvre pas » de l'ADR 0064 s'applique telle quelle.
- Un **jeton d'application** a la forme `rto_` suivi de 43 caractères base64url. Il vaut une heure.
- Un **jeton de renouvellement** a la forme `rtr_` suivi de 43 caractères base64url. Il vaut 90 jours et tourne à chaque usage : chaque échange rend un nouveau jeton de renouvellement et retire le précédent.
- La durée de 90 jours suit le rythme d'une organisation. Une automatisation peut rester sans usage pendant la pause entre deux éditions, sans perdre sa connexion.
- Un jeton de renouvellement déjà utilisé qui revient révoque toute l'autorisation. La personne reçoit un mail qui le signale.
- Le serveur garde l'empreinte SHA-256 de chaque jeton, jamais sa valeur. Les jetons sont opaques : une révocation agit dès la requête suivante.
- **Audience.** Le paramètre `resource` (RFC 8707) est obligatoire à l'autorisation et à l'échange du code. Il est facultatif au renouvellement, comme le permet la RFC 8707. Présent, il doit valoir `ORIGINE_ORGA`, sinon la demande reçoit `invalid_target`. Le jeton n'est accepté que par cette installation, sur `/graphql`, le flux des changements et `/api/v1/`.
- À la fin de l'autorisation, après un an, l'application doit redemander l'accord de la personne.
- Trente jours avant cette fin, la personne reçoit un mail de rappel. Le mail nomme l'application et la date, et indique comment la reconnecter.
- Le contexte d'une requête porteuse d'un jeton d'application est celui d'un jeton d'accès. `jetonCourant` indique en plus le nom de l'application.
- Une requête refusée reçoit les statuts de l'ADR 0064 : 401 `JETON_INVALIDE`, 403 `API_INACTIVE`, 429 `LIMITE_DE_DEBIT`.
- Un module « API » désactivé ou interdit refuse aussi l'échange d'un jeton de renouvellement, sans le consommer. L'autorisation répond de nouveau à la réactivation.

### Plusieurs applications

- Une personne autorise autant d'applications qu'elle le souhaite, dans la limite de 20 autorisations actives par personne et par organisation. Ces autorisations ne comptent pas dans les 10 jetons d'accès de l'ADR 0064.
- Une nouvelle autorisation du même client, par la même personne et pour la même organisation, remplace la précédente et la révoque.
- Chaque autorisation se révoque seule, sans toucher aux autres ni aux jetons d'accès.

### Révocation dans « Jetons et API »

- Le panneau « Jetons et API » des préférences ajoute une section « Applications autorisées ». Chaque ligne montre l'application, l'hôte de son `client_id`, la portée, les activités, la date d'accord et le dernier usage. Un bouton révoque l'autorisation.
- L'autorisation se signale par mail à la personne, avec un lien de révocation signé, comme la création d'un jeton d'accès. Une session volée ne crée donc pas un accès en silence.
- Une application révoque elle-même ses jetons par `/oauth/revocation` (RFC 7009). La révocation d'un jeton révoque toute l'autorisation.
- Un admin de l'organisation lit les autorisations de tous les membres dans le panneau « API » de l'écran « Organisation ». Il révoque chacune. La personne l'apprend par mail, qui nomme l'admin.
- Un admin de l'organisation peut aussi refuser un client pour toute l'organisation. Le refus révoque ses autorisations et bloque les nouvelles demandes.
- `revoquerMesJetonsAcces` révoque aussi les autorisations d'application de la personne.
- L'archivage d'une personne et la suspension du module (ADR 0064) révoquent ses autorisations dans la même transaction.
- Les autorisations, comme les jetons, se gèrent avec une session. Un jeton d'application ne les lit ni ne les révoque, sauf par `/oauth/revocation`.

### Refus par l'administration de l'installation

- `APPLICATIONS_TIERCES` règle la fonction pour toute l'installation :
  - `ouvertes`, la valeur par défaut, accepte tout client valide. Le module « API » de chaque organisation reste inactif par défaut. Aucune application ne demande donc d'accès avant son activation par un admin de l'organisation ;
  - `liste` n'accepte que les `client_id` de `APPLICATIONS_LISTE` ;
  - `fermees` ferme les points `/oauth/*` et les métadonnées. Les jetons d'accès de l'ADR 0064 restent utilisables.
- `APPLICATIONS_REFUSEES` liste des `client_id` ou des hôtes refusés, quel que soit le mode.
- L'administration de l'installation peut fermer les applications tierces d'une organisation par l'argument `api.applications` de `modifierOrganisationInstallation`.
- Un client refusé ne reçoit aucune nouvelle autorisation. Ses jetons cessent de répondre dès la requête suivante. Ses autorisations se révoquent au démarrage suivant.
- Une installation sans accès sortant vers Internet ne peut pas lire de CIMD. La demande affiche alors « Cette installation ne peut pas vérifier l'application » (*"This installation cannot verify the application"*), sans détail technique. Son exploitant choisit `fermees`, ou ouvre l'enregistrement dynamique.

### Transport et relais

- Les points `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource` et `/oauth/*` sont servis par l'API. Le relais de l'exploitant les transmet, comme `/api/v1/*`. Le Caddyfile de référence reçoit ces lignes.
- `/oauth/jeton` et `/oauth/revocation` reçoivent un corps `application/x-www-form-urlencoded`. Leurs réponses portent `Cache-Control: no-store`.
- CORS ne change pas. Une application sert ses utilisateurs depuis son serveur ou depuis l'appareil, jamais depuis une page d'une autre origine.

### Règle de gouvernance

Aucune fonction n'est refusée dans le logiciel au motif qu'une application tierce, ou un service d'un hébergeur, la propose déjà. Cette règle rejoint `CONTRIBUTING.md` avec le mode d'emploi.

Cette règle protège l'engagement du projet : toutes les fonctions du logiciel restent dans le logiciel, sur toute installation. Une application tierce s'ajoute au logiciel et ne le remplace pas.

### Mise en œuvre

- Le serveur d'autorisation est une implémentation propre dans `packages/server`. Ses jetons entrent directement dans le contexte des jetons d'accès de l'ADR 0064, avec les mêmes contrôles et les mêmes refus.
- Les tests d'intégration jouent le rôle de l'application avec la bibliothèque cliente `oauth4webapi`. Ils vérifient ainsi le protocole de l'extérieur.

## Options écartées

- **Le greffon de fournisseur OAuth de Better Auth.** La version 1.7 de Better Auth ne le contient pas : il vient d'un paquet séparé. Un greffon créerait ses propres jetons et ses propres tables, qu'il faudrait traduire dans le contexte de l'ADR 0064. Deux politiques d'accès seraient alors à tenir.
- **Des greffons chargés dans le serveur, sur le modèle de WordPress.** Un greffon s'exécuterait avec tous les droits du serveur. Il pourrait lire toutes les organisations d'une installation (ADR 0030). Il ferait tourner une version différente de l'image publiée (ADR 0007). Il figerait le code interne comme une interface à maintenir. Une fonction utile à tous entre dans le dépôt, éventuellement comme module (ADR 0052).
- **OpenID Connect.** Relaytour ne sert pas à se connecter à d'autres sites. Un `id_token` exposerait l'identité de la personne sans besoin.
- **Des jetons JWT signés.** Un jeton autoporteur resterait valable jusqu'à sa fin après une révocation. L'installation est le seul serveur de ressources, et un jeton opaque se vérifie en base.
- **Un enregistrement préalable de chaque client par l'exploitant.** Chaque application devrait s'enregistrer sur chaque installation. Le CIMD rend ce geste inutile.
- **L'enregistrement dynamique ouvert par défaut.** Tout programme pourrait se déclarer sous un nom trompeur. Le CIMD lie le client à une adresse que son éditeur contrôle.
- **Un accord implicite pour une application déjà autorisée.** Une page malveillante pourrait relancer une autorisation à l'insu de la personne.
- **Le parcours par code d'appareil (RFC 8628).** Il sert les outils sans navigateur. Une ligne de commande garde le jeton d'accès de l'ADR 0064, ou l'adresse de boucle locale.
- **Les parcours implicite et par mot de passe.** OAuth 2.1 les retire.

## Conséquences

- Des migrations additives créent les clients, les demandes, les autorisations et leurs jetons. Après un retour à une version antérieure, les applications cessent de répondre, et aucune donnée ne se perd.
- Le relais de l'exploitant transmet trois nouveaux chemins. Sans ces lignes, la fonction reste invisible, et les jetons d'accès fonctionnent comme avant.
- Une installation qui veut lire les CIMD doit pouvoir joindre Internet en https.
- La liste « Ce qu'un jeton n'ouvre pas » de l'ADR 0064 vaut pour les applications. Une opération qui y entre se ferme aux deux.
- Le glossaire reçoit quatre mots : « application tierce » (*third-party application*), « autorisation d'application » (*application authorization*), « jeton d'application » (*application token*) et « jeton de renouvellement » (*refresh token*). « Jeton d'accès » garde son sens de l'ADR 0064.
- **Suite possible, sans engagement : un annuaire d'applications.** Le site du projet pourrait publier une page « Applications compatibles ». Chaque fiche indiquerait ce que l'application lit, si elle écrit, qui l'édite et où vont les données. Les critères seraient les mêmes pour toutes les applications. Le logiciel ne lirait jamais cet annuaire.

## Revue de sécurité

| Menace | Contre-mesure |
|---|---|
| Code volé en chemin | PKCE S256 obligatoire, code de 60 secondes à usage unique |
| Redirection ouverte | Adresse de retour comparée exactement à celles du client ; erreur affichée sur l'installation avant cette vérification |
| Confusion entre serveurs d'autorisation (*mix-up*) | Paramètre `iss` dans chaque réponse (RFC 9207) |
| Falsification de requête (CSRF) | `state` rendu tel quel, PKCE, identifiant de demande aléatoire (32 octets) valable 15 minutes et à réponse unique, réponse réservée à une session |
| Clic détourné sur « Autoriser » | Écran jamais affiché dans un cadre, accord jamais implicite |
| Nom de client trompeur | Hôte affiché, client DCR signalé « non vérifié », DCR fermé par défaut |
| Requête forgée vers le réseau interne (SSRF) par un CIMD | Nom de domaine seulement (adresse IP et `localhost` refusés), résolu vers une adresse publique, sans redirection, 5 secondes, 16 Ko |
| Jeton de renouvellement volé | Rotation à chaque usage ; un ancien jeton qui revient révoque l'autorisation et prévient la personne |
| Jeton présenté ailleurs | Audience fixée par `resource`, jeton opaque connu de la seule installation |
| Élévation de droits | Bornes d'un jeton d'accès, sans gestion des membres, jamais plus que la session |
| Accès d'une autre organisation | Autorisation liée à une organisation, refus croisés de l'ADR 0064 |
| Fuite par le journal | Aucun jeton ni code au journal (invariant 6), seulement les identifiants et les événements |
| Accès créé en silence | Mail à chaque autorisation, avec lien de révocation signé |

Les tests prouvent chaque contrôle par le refus :

- une demande sans PKCE S256, avec une autre adresse de retour ou une autre ressource est refusée ;
- un code rejoué, expiré ou présenté avec un autre `code_verifier` est refusé, et le rejeu révoque l'autorisation ;
- un jeton de renouvellement réutilisé révoque l'autorisation et met un mail en file ;
- une autorisation qui prend fin dans 30 jours met un mail de rappel en file, une seule fois ;
- un CIMD sur une adresse privée, avec une redirection, trop lent ou trop gros est refusé ;
- un CIMD dont le `client_id` diffère de l'adresse lue est refusé ;
- un jeton d'application en lecture refuse une mutation, et un jeton limité à une activité ne lit pas les autres ;
- un jeton d'application n'ouvre ni la gestion des membres, ni la gestion des jetons, ni les opérations du compte ;
- un module inactif, interdit ou suspendu refuse les jetons d'application et l'échange d'un jeton de renouvellement ;
- un client refusé par l'installation ou par l'organisation ne reçoit aucune autorisation, et ses jetons cessent de répondre ;
- l'archivage d'une personne et la suspension du module révoquent ses autorisations ;
- une personne ne révoque pas l'autorisation d'une autre ; un admin de l'organisation révoque celle d'un membre, qui en est prévenu ;
- l'écran de consentement porte `frame-ancestors 'none'` ;
- le journal ne reçoit jamais un jeton ni un code.

Une revue de sécurité de la mise en œuvre précède le passage de cette ADR à « acceptée ». Elle a eu lieu sur la pile #377 à #381. Elle a relevé qu'une adresse IP écrite dans le `client_id` échappait au contrôle de l'adresse publique, faute de résolution de nom. L'identifiant refuse désormais toute adresse IP et `localhost`, et les tests de lecture du CIMD passent par le vrai `fetch`. Elle a aussi fait refuser les caractères de format Unicode (commandes bidirectionnelles comprises) dans le nom d'un client.

## Plan de mise en œuvre

1. Serveur : métadonnées, clients CIMD, enregistrement dynamique facultatif, autorisation, jetons, rotation, révocation, refus de l'installation et de l'organisation, mails d'autorisation et de rappel, lignes du Caddyfile de référence, tests.
2. Espace organisateur : écran de consentement en français et en anglais, et section « Applications autorisées » de « Jetons et API ». Le panneau « API » de l'écran « Organisation » reçoit les autorisations des membres et les clients refusés.
3. Mode d'emploi de la connexion d'une application, glossaire et règle de gouvernance dans `CONTRIBUTING.md`. L'ADR passe à « acceptée » après la revue de sécurité.
