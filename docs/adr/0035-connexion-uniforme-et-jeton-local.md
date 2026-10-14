# ADR 0035 — Connexion à réponse uniforme et jeton d'administration local par défaut

- **Statut** : acceptée
- **Date** : 2026-10-14
- Complète l'ADR 0002 (connexion par code mail) et l'ADR 0013 (jeton d'administration limité aux requêtes locales). Précise la portée du jeton décrite par l'ADR 0008.

## Contexte

L'audit de sécurité d'octobre 2026 a relevé des écarts entre ces ADR et le comportement du serveur. La PR #114 les a corrigés le 10 octobre 2026, sans qu'une ADR consigne les nouvelles règles. Les ADR 0002 et 0013 décrivent donc encore l'état d'avant.

- **La connexion révélait l'existence d'un compte.** L'ADR 0002 promet la même réponse pour une adresse connue et pour une adresse inconnue. Better Auth répondait pourtant « trop d'essais » ou « code expiré » pour une adresse connue. Il répondait toujours « code invalide » pour une adresse inconnue. Six essais suffisaient à savoir si une adresse avait un compte.
- **La force brute restait possible sur la durée.** Cinq codes par adresse et par quart d'heure, avec cinq essais par code, laissaient environ 2 400 essais par jour sur un million de codes.
- **Deux réponses portaient le jeton de session.** La connexion réussie et la lecture de session (`/get-session`) le renvoyaient dans leur corps. Une faille dans le navigateur aurait pu le lire, alors que le cookie suffit. La lecture de session est corrigée avec cette ADR.
- **Le jeton d'administration répondait depuis Internet par défaut.** Sans réglage, `JETON_ADMINISTRATION_LOCAL` valait faux, et le jeton s'acceptait à travers le proxy, sans limite de tentatives.
- **Une requête locale se reconnaissait à l'absence d'un en-tête de proxy.** Un port publié par erreur sur une interface publique aurait ouvert le jeton à toute personne qui le connaît.
- **La portée du jeton était mal décrite.** L'ADR 0008 dit que le jeton n'a « aucun accès aux données ». Deux de ses opérations touchent pourtant des données personnelles : l'export d'une organisation, et la nomination de son premier admin.

## Décision

### La connexion répond de la même façon pour toute adresse

- Un code refusé reçoit toujours la réponse « code invalide » (400), qu'il soit faux ou expiré, ou que les essais soient épuisés. La réponse est la même pour une adresse connue et pour une adresse inconnue. Un hook `after` sur `/sign-in/email-otp` ramène les réponses de Better Auth à celle-ci.
- Une adresse reçoit au plus cinq codes par quart d'heure et vingt codes par jour. Avec cinq essais par code, une personne qui ne connaît pas le code dispose de 100 essais par jour sur un million de codes.
- Ni la réponse d'une connexion réussie, ni celle de `/get-session` ne portent le jeton de session : seul le cookie le transporte. Le même hook `after` le retire des deux corps.
- Une adresse inconnue ne reçoit toujours aucun mail (ADR 0002).

### Le jeton d'administration n'est accepté qu'en local, par défaut

- `JETON_ADMINISTRATION_LOCAL` vaut vrai sans réglage. Une installation qui appelle l'API d'administration à travers le proxy, depuis une autre machine, écrit `JETON_ADMINISTRATION_LOCAL=false`.
- Une requête est locale à deux conditions. Elle ne porte aucun en-tête de proxy (`X-Forwarded-For`, `Forwarded`). Sa connexion vient d'une adresse de boucle locale ou d'un réseau privé (RFC 1918, ULA). La fonction pure `requeteLocale` porte la règle.
- Dix jetons refusés en quinze minutes depuis une même adresse ferment l'API d'administration à cette adresse pour la fenêtre.
- L'adresse du client se lit dans l'en-tête `X-Relaytour-Ip`, que Caddy pose avec `{client_ip}`. Le serveur ne l'accepte que d'une connexion locale ou privée : le proxy se trouve sur la machine ou sur son réseau. Un client qui joint l'API depuis Internet, sans proxy, ne peut donc pas se déclarer une autre adresse.
- La frontière de confiance est ce réseau. Une machine du réseau privé qui joint l'API directement peut déclarer une autre adresse, et contourner ainsi la limite par adresse. L'exploitant ne publie donc l'API que pour Caddy (invariant 7).

### Ce que le jeton touche

- Le jeton ne lit aucune donnée des membres d'une organisation par l'API : ni personne, ni tâche, ni fiche. Il lit les métadonnées de l'administration de l'installation : slug, nom, statut, limites et date de création de chaque organisation, ses activités et leurs périodes ouvertes, et son nombre de membres.
- Deux opérations font exception, et la documentation le dit :
  - `demanderExport` écrit sur le serveur un fichier qui contient les noms et les adresses des membres. Ce fichier sert à remettre ses données à l'organisation.
  - `inviterPremierAdmin` nomme le premier admin d'une organisation qui n'en a pas. Un membre existant en devient admin ; un compte connu hors de l'organisation reçoit une invitation à accepter (ADR 0030).
- Cette précision remplace, pour le jeton, la formule « sans accès aux données » de l'ADR 0008.

## Conséquences

- La version 0.17.0 publie le changement de `JETON_ADMINISTRATION_LOCAL` comme une rupture, avec sa consigne de migration.
- `infra/README.md`, `.env.example` et `env.ts` décrivent déjà ces règles depuis la PR #114. `CONTRIBUTING.md` reprend la précision sur la portée du jeton.
- Les ADR 0002 et 0013 restent acceptées. Leur lecture se complète par celle-ci.

## Revue de sécurité

- `auth.integration.test.ts` compare les séquences de réponses pour une adresse connue et une adresse inconnue, essai après essai. Il vérifie aussi un code expiré, et l'absence du jeton de session dans le corps d'une connexion réussie et, par HTTP, dans celui de `/get-session`.
- `requete-locale.test.ts` et `adresse-client.test.ts` prouvent les deux conditions d'une requête locale. Ils prouvent aussi le refus d'une adresse déclarée par un client dont la connexion vient d'une adresse publique.
- `installation.integration.test.ts` prouve que le jeton ne lit aucun champ ordinaire d'une organisation (`personnes`, `fiches`, `activites`, `moi`) et ne nomme pas un second premier admin.
- La fermeture après dix jetons refusés n'a pas encore de test d'intégration. Un test la prouvera par le refus : onze requêtes d'une même adresse, la dernière refusée même avec le bon jeton. 