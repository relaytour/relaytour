# ADR 0013 — Administrer l'équipe depuis le serveur

- **Statut** : acceptée
- **Date** : 2026-09-29
- Complète l'ADR 0008, sans en changer la frontière.

## Contexte

Une organisation constitue son équipe à partir de fiches d'intérêt, de mails ou d'un tableur : parfois plusieurs dizaines de personnes, avec leurs périmètres et leurs souhaits. La saisie une par une dans l'espace organisateur prend du temps et multiplie les erreurs.

L'API de l'administration de l'installation (ADR 0008) semblait un point d'entrée possible. Elle ne l'est pas :

- Par conception, le jeton d'administration n'accède à aucune donnée d'une organisation. Inviter et affecter des personnes, c'est traiter leurs données. L'hébergeur deviendrait un super admin qui manipule les membres des organisations, ce que l'ADR 0008 écarte.
- Ce jeton répond sur `/graphql`, donc depuis Internet, à toute personne qui le détient.

## Décision

### Une commande dans le conteneur

- `equipe-importer` lit un fichier YAML qui décrit, pour chaque personne : son nom, son adresse, ses affectations, ses contacts principaux et ses souhaits, pour une activité et une période.
- La commande s'exécute dans le conteneur de l'API, comme `creer-admin` ou `orga-importer`. Aucune route réseau ne l'ouvre : il faut l'accès à la machine et à Docker.
- Elle agit dans une seule organisation, comme un admin de cette organisation qui saisirait l'équipe.
- Elle est additive et rejouable : elle crée les comptes, les appartenances, les affectations et les souhaits qui manquent, désigne les contacts principaux, et ne retire rien. Le nom d'un compte existant ne change pas.
- Le fichier se valide en entier avant toute écriture, et l'import s'écrit dans une seule transaction. `--simulation` montre le résultat sans rien écrire.
- Aucun mail ne part sans `--envoyer-mails`. Avec l'option, une personne nouvelle reçoit son invitation et une personne déjà membre reçoit le mail d'équipe (ADR 0012).
- Le fichier contient des données personnelles : il ne va dans aucun dépôt Git (invariant 2), et il se supprime du serveur après l'import.

### Un jeton d'administration limité aux requêtes locales

- `JETON_ADMINISTRATION_LOCAL=true` n'accepte le jeton que sur une requête locale. Une requête relayée par Caddy porte `X-Forwarded-For`, qu'un client ne peut pas retirer à travers le proxy : le jeton y vaut un jeton faux, et la requête devient anonyme.
- Un programme de la machine, comme le portail d'un hébergeur installé à côté, appelle alors `http://127.0.0.1:4400/graphql`.

### Pour plus tard

- La commande pourra décrire aussi les activités et les périmètres.
- Une automatisation par le réseau passerait par un jeton propre à une organisation, créé par l'un de ses admins, avec des droits limités. Elle demandera sa propre ADR.

## Conséquences

- Une nouvelle commande entre dans `tsup.config.ts`, dans le garde-fou de la CI et dans `infra/README.md`.
- Un test d'intégration prouve la validation du fichier, la simulation sans écriture, l'import rejouable et l'envoi des mails seulement sur demande.
- Le jeton local se teste par une fonction pure, `requeteLocale`.
