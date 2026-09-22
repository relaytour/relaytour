# Contribuer à Relaytour

Ce fichier fixe les règles du dépôt : décisions arrêtées, invariants techniques, style d'écriture, glossaire et pièges connus. Il doit rester lisible sans autre contexte.

## Paquets

- `packages/server` : API GraphQL (Express 5, Apollo Server 5, Pothos, un seul schéma), connexion Better Auth et worker BullMQ.
- `packages/orga` : espace organisateur, SPA React 19 + Vite + React Router 7 + Apollo Client 4 + antd 6. Types GraphQL générés dans `src/gql/`.
- `packages/tokens` : modèle de thème, thème par défaut et thème alternatif de Relaytour, contraste. Le serveur le lit pour valider et compléter le thème d'une organisation ; l'espace organisateur le lit pour le thème de repli (ADR 0006).
- `content/exemple` : organisation d'exemple, fictive et anonyme (`organisation.yaml`, périmètres, fiches, tâches types). Le contenu réel d'une organisation vit hors du dépôt (voir son README).
- `packages/database` : Prisma 6 sur MariaDB 11.8. Le client généré (`src/generated/`) n'est jamais commité.
- `infra/` : déploiement de référence minimal (Compose, Caddyfile d'exemple, étapes). L'exploitation réelle vit hors du dépôt (ADR 0007).
- `outils/verifier-licences.mjs` et `outils/verifier-publication.mjs` : contrôles de CI sur les licences des dépendances et sur l'absence de traces privées.
- `outils/versionner.mjs` et `notes/` : journal des changements (`noter`, `valider`, `compiler`).
- `docs/adr/` : décisions d'architecture. `docs/design-system.md` : identité, matériau et composants.
- `site/` : site de présentation publié sur GitHub Pages. `outils/site.mjs` y écrit les jetons, les palettes et les polices ; la CI vérifie qu'il est à jour.
- `docs/feuille-de-route.md` et `docs/publication.md` : évolutions envisagées, liste de publication.

## Commandes

```bash
yarn setup        # installation, Docker, client Prisma, migrations, contrats
yarn dev          # API (4400), worker et espace organisateur (5305)
yarn workspace @relaytour/server admin:creer adresse@exemple.org "Prénom Nom"   # premier compte admin
yarn workspace @relaytour/server edition:creer 2027 "Rencontres 2027" 2027-06-05 2027-06-06   # première édition
yarn workspace @relaytour/server planification:lancer rappels|resumes         # lancer une tâche planifiée tout de suite
yarn check        # lint, types, build
yarn test         # tests unitaires
yarn workspace @relaytour/server test:integration   # base locale, worker arrêté
yarn workspace @relaytour/server orga:exporter      # reverse les fiches modifiées dans l'application vers le dossier de contenu
yarn codegen      # contrats commités
node outils/site.mjs   # site de présentation, après un changement des jetons
node outils/captures.mjs --origine http://localhost:5305   # captures du site, avec le contenu d'exemple et un compte fictif
yarn versionner valider
yarn versionner compiler   # journaux commités
```

## Décisions arrêtées

Ces décisions ne se rouvrent pas sans raison nouvelle.

| Sujet | Décision | Référence |
|---|---|---|
| Socle | Yarn 4, Node 24, tsup ESM, un seul schéma GraphQL sans gateway | ADR 0001 |
| Connexion | Better Auth, code ou lien reçu par mail, inscription fermée (invitation par un admin) | ADR 0002 |
| Modèles de l'espace organisateur | Fiches et tâches types dans un dossier de contenu propre à l'organisation, hors dépôt, importées en base par édition | ADR 0003 |
| Hébergement | Déploiement de référence : une pile Compose sur un VPS. Le dépôt produit une image et ne déploie rien ; l'exploitation vit dans un dépôt séparé qui consomme l'image. Aucun correctif privé. | ADR 0004, 0007 |
| Contenu d'une organisation | Un dépôt par organisation, créé depuis `relaytour/organisation-modele`, rattaché par un chemin (`CONTENU_ORGA`), un volume ou la CI de l'organisation | ADR 0003, 0007 |
| Dépendances | Licences compatibles avec l'AGPL seulement, liste blanche dans `outils/verifier-licences.mjs`. Valkey et non Redis. | ADR 0007 |
| Licence | AGPL-3.0, un seul code, multi-organisation à venir. Le contenu d'une organisation n'entre jamais dans le dépôt. | ADR 0005, 0006 |
| Activités et administration de l'installation | Une organisation porte une ou plusieurs activités (événement, saison, mandat), chacune avec ses périodes, ses périmètres rangés en groupes déclarés dans le contenu, ses fiches et ses tâches types. Les appartenances sont par organisation. L'administration de l'installation (créer, suspendre, limiter, exporter une organisation) passe par un script ou un jeton, sans accès aux données. À réaliser, un chantier par session. | ADR 0008 |
| Extensions | Aucun chargeur de modules dans le serveur. Un besoin d'hébergeur entre par l'API d'administration de l'installation ; portail client, paiement et paliers restent chez l'hébergeur. | ADR 0007, 0008 |
| Configuration d'organisation | Un seul objet (`packages/server/src/lib/organisation.ts`), lu dans la ligne `Organisation` en base, sinon dans les variables d'amorçage. `organisation.yaml` du dépôt d'organisation la porte ; l'import la met à jour. L'expéditeur des mails et l'origine de l'espace organisateur restent dans l'environnement. | ADR 0006 |
| Rôles V1 | Admin et référent·e. Le rôle bénévole viendra après la V1. | ADR 0006 |
| Score de participation | Visible par la personne concernée et par les admins seulement. Calculé à partir de l'état actuel (une tâche rouverte perd ses points) : tâche réalisée 3 points (+1 à temps, crédités à la personne réalisatrice indiquée, sinon à celle qui a coché), tâche créée 1, fiche créée 3, fiche modifiée 2 une fois par jour. Un palmarès public se décide en fin d'édition. Barème validé le 16 septembre 2026. | `packages/server/src/lib/score.ts` |
| Tâches | Une tâche ne se supprime pas, elle s'abandonne. Modifier la tâche d'une autre personne exige une confirmation et la prévient par mail. Qui a coché et qui a réalisé une tâche n'est visible que par la personne qui a coché et par les admins. | `packages/server/src/schema/taches.ts` |
| Fiches | Une version ne se modifie ni ne se supprime ; restaurer crée une nouvelle version. L'historique est réservé aux admins. Rédiger exige un droit accordé par un admin (un périmètre, ou toutes les fiches). | `packages/server/src/schema/fiches.ts` |
| Notifications | Une notification ne stocke que des identifiants ; son texte se compose à la lecture. Mail immédiat : modification d'une tâche assignée, rappels à 7 jours et à la veille, retards. Le reste passe par le résumé (hebdomadaire par défaut, le lundi à 7 h, valeur validée le 16 septembre 2026). Le worker vérifie les préférences au moment de l'envoi. | `packages/server/src/lib/notifications.ts`, `src/jobs/planification.ts` |
| Accès aux périmètres | Lecture pour toute personne affectée au périmètre dans au moins une édition ; écriture pour les personnes affectées à l'édition concernée, tant qu'elle n'est pas archivée ; tout pour les admins. | `packages/server/src/lib/droits.ts` |
| Souhaits | Un souhait note l'intérêt d'une personne pour un périmètre d'une édition. Il est visible des admins seulement, ne donne aucun accès et n'est jamais exporté dans Git. Il est satisfait quand l'affectation correspondante existe. | `packages/server/src/lib/souhaits.ts` |

## Invariants techniques

Chaque règle vient d'un incident réel ou d'un risque constaté.

1. **Aucune liste de participant·es, d'abonné·es ou de référent·es n'atteint un navigateur sans contrôle d'accès serveur.** Un fichier d'adresses publié par erreur reste accessible tant que personne ne le cherche.
2. **Aucune donnée personnelle dans Git** (dump SQL, export, CSV), ni dans l'historique. Le contenu d'une organisation n'entre pas non plus dans ce dépôt.
3. **L'environnement se lit dans `APP_ENV` (`local`, `prod`), jamais dans `NODE_ENV`.** Toute installation déployée tourne en `NODE_ENV=production`, y compris une installation d'essai.
4. **Aucune variable ne bascule la sortie des mails.** Le transport se déduit de `APP_ENV` et de `COURRIEL_SMTP_HOTE` : Mailpit sur le poste local, le SMTP renseigné ailleurs, rien sinon. L'ancien `DISABLE_MAIL_CATCH=false` produisait des envois réels.
5. **Les mails passent par la file BullMQ.** `mettreEnFile` ne lève jamais. La charge utile ne contient ni corps ni jeton, sauf l'exception documentée du code de connexion (ADR 0002).
6. **Le journal ne contient ni adresse complète, ni code, ni jeton.** Utiliser l'identifiant utilisateur, ou `courrielTronque`.
7. **Tout port Docker est publié sur `127.0.0.1`.** Les règles NAT de Docker contournent ufw.
8. **Les migrations sont additives.** Un sens nouveau prend un nom de champ nouveau.
9. **Les contrats générés sont commités et vérifiés en CI** : `packages/server/schema.graphql`, `packages/server/src/courriel/gabarits.genere.ts`, `packages/orga/src/gql/`, `notes/notes-de-version.*.json`.
10. **L'image ne contient pas le code source** : cartes sans `sourcesContent`, `.dockerignore` sans `.env`.
11. **Un contrôle d'accès se prouve par le refus** (requête sans session, avec la session d'un autre périmètre), pas par la réussite avec la bonne session.
12. **`env.ts` valide l'environnement à l'import.** Les modules que charge le schéma importent la file et la connexion Redis de façon paresseuse, sinon `yarn codegen` échoue sans `.env`.
13. **Le schéma GraphQL n'importe jamais `auth.ts`.** Better Auth charge `env.ts` : le serveur résout la session, puis la passe à `buildContext`.
14. **Une requête lue sans session ne demande que des champs publics.** Un champ protégé dans la même requête transforme la réponse en erreur.
15. **Toute nouvelle route de Better Auth s'ouvre explicitement** dans `ROUTES_OUVERTES` (`packages/server/src/auth.ts`). Les autres répondent 404.
16. **Aucune coordonnée personnelle dans un dossier de contenu.** La validation (`orga:valider`) et l'export refusent les adresses et numéros hors des domaines listés dans `DOMAINES_COURRIEL_AUTORISES` ; les contacts s'écrivent sous forme de rôles.
17. **Tout appel à Redis sur le chemin d'une requête est borné dans le temps** (`lib/delai.ts`). La connexion de BullMQ attend Redis sans limite : la première CI, sans Redis, a bloqué deux tests jusqu'à leur délai de 30 s.

18. **Aucune nouvelle contrainte d'unicité globale sans clé d'organisation ou d'activité, aucune nouvelle requête qui parcourt toute la base sans filtre, aucune marque en dur** (ADR 0005, 0006 et 0008).

## Écriture

- **Style neutre** pour tout texte : copie, mails, docs, commits, PR. Chaque phrase a un sujet et un verbe conjugué, une idée par phrase, 25 mots au plus, « vous » pour l'utilisateur, « nous » pour l'organisation, pas de « on », pas de tiret d'incise.
- **Écriture inclusive obligatoire**, sur toutes les éditions : doublet dans une phrase (« les référentes et référents »), point médian seulement là où la place manque (« Devenir référent·e »), un seul point médian par mot, jamais de point simple. Préférer une tournure épicène quand elle existe.
- Commentaires et messages de commit en français, commits conventionnels (`feat(server):`, `fix(orga):`).

### Glossaire

Un seul mot par notion.

| Mot | Sens |
|---|---|
| organisation | L'association ou le collectif qui utilise une installation de Relaytour. Elle porte une ou plusieurs activités. Une seule par installation tant que l'ADR 0008 n'est pas réalisée. |
| activité | Ce qu'une organisation fait dans la durée : un événement, une section, une instance. Une activité porte ses périodes, ses périmètres, ses fiches et ses tâches types (ADR 0008). |
| nature | Événement, saison ou mandat. La nature d'une activité fixe le libellé de sa période. |
| édition | Une période d'une activité : l'édition d'un événement (2025, 2027), la saison d'une section, le mandat d'une instance. `Edition` reste le nom technique. |
| périmètre | Une sous-partie d'une activité (un sport, un pôle, une commission…), rangée dans un groupe. |
| groupe | Catégorie de périmètre déclarée par l'activité dans son contenu. Le gabarit propose sport et pôle. |
| pôle | Groupe de périmètres transverses (coordination, logistique, trésorerie…), proposé par défaut. Les pôles sont listés dans le `perimetres.yaml` de l'activité. |
| référent·e | Personne membre de l'organisation, désignée pour un périmètre et une édition. |
| affectation | Lien entre une personne, un périmètre et une édition. |
| effectif | Nombre de référentes et de référents souhaité pour un périmètre et une édition. |
| poste à pourvoir | Place de référent·e encore libre : l'effectif moins les affectations. |
| souhait | Intérêt d'une personne pour un périmètre d'une édition, noté par un admin. |
| tâche | Action datée d'un périmètre pour une édition. |
| fiche | Fiche méthode (« comment faire ») d'un périmètre ou commune. |
| admin | Membre du bureau qui voit l'avancement global et gère les affectations. Le rôle vaut pour une organisation et toutes ses activités. |
| journal | Trace de qui a fait quoi, et quand. Le journal alimente les notifications et le score de participation. |
| administration de l'installation | Actions d'hébergement, par script ou par jeton, sans accès aux données : créer, suspendre, limiter, exporter une organisation. |
| limites | Plafonds d'une organisation (nombre d'activités), fixés par l'administration de l'installation. Une organisation auto-hébergée n'en a aucune. |
| bénévole | Personne qui aide pendant le tournoi sans être référent·e. |

## Proposer une modification

Relaytour accueille les contributions : correctifs, évolutions, documentation, traductions de la documentation. Ouvrez d'abord un ticket pour une évolution importante, afin d'en discuter avant d'écrire le code.

1. Travaillez dans un fork ou, pour les personnes mainteneuses, dans une branche du dépôt. Nommez la branche `type/sujet`, par exemple `fix/recherche-sans-edition` ou `feat/export-calendrier`.
2. Partez de `develop` et visez `develop`. `main` n'avance qu'à la publication d'une version.
3. Donnez à la PR un titre au format des commits conventionnels, en français : `feat(orga): …`, `fix(server): …`, `docs: …`. Avec la fusion en squash, ce titre devient le message du commit fusionné.
4. Traitez un seul sujet par PR. Une PR courte se relit et se fusionne plus vite.
5. Remplissez le modèle de PR. Il rappelle les vérifications et les règles d'écriture.

### Ce que chaque PR apporte

- `yarn check` et `yarn test` passent sur votre poste. Un changement du serveur passe aussi `yarn workspace @relaytour/server test:integration`.
- Un changement visible porte son fragment de note de version, avec une audience parmi `organisateurs`, `interne` et `public`. Lancez ensuite `yarn versionner valider` puis `yarn versionner compiler`.
  ```bash
  yarn versionner noter --cible orga --type fonctionnalite --audience organisateurs --titre "Les fiches s'affichent en liste condensée"
  ```
  La cible vaut `serveur` ou `orga`. Le type vaut `fonctionnalite`, `correctif`, `rupture`, `securite`, `performance` ou `interne`. Complétez ensuite le texte du fragment créé dans `notes/fragments/`.
- Un changement d'interface joint une capture de l'écran, faite avec le contenu d'exemple (`content/exemple`) et des comptes fictifs.
- Un changement de contrôle d'accès joint un test qui prouve le refus (invariant 11).
- Les contrats générés sont à jour (`yarn codegen`, invariant 9).
- Aucun contenu d'organisation, aucune donnée personnelle, aucun secret (invariants 1 et 2).
- Le champ `version` des `package.json` ne change pas : seule la PR de publication le relève (voir « Versions »).

### Revue et fusion

- La CI (« Lint, types, tests, build ») doit passer.
- Tous les fils de discussion doivent être résolus : la règle de `develop` bloque la fusion sinon.
- Copilot relit chaque PR. Sa revue est consultative : une remarque écartée reçoit une réponse qui explique le choix, puis son fil est résolu.
- Une personne mainteneuse fusionne en **squash** : une PR donne un commit sur `develop`. Le rebase reste réservé aux PR de mainteneur dont chaque commit est propre et utile seul.
- `develop` et `main` gardent un historique linéaire. Aucune poussée forcée, aucune suppression de ces branches.

## Versions

### Ce qui porte un numéro

- Deux cibles se publient, chacune avec son propre numéro : le serveur (`packages/server/package.json`) et l'espace organisateur (`packages/orga/package.json`).
- `packages/tokens` et `packages/database` sont internes au dépôt. Leur numéro ne se publie pas.
- Le journal `notes/notes-de-version.<cible>.json` reprend le numéro de sa cible et les fragments de `notes/fragments/`.

### Numérotation

- Les numéros suivent la forme `x.y.z` du versionnage sémantique.
- Avant la version 1.0, une fonctionnalité fait monter le deuxième chiffre (0.3.0 devient 0.4.0) et un correctif le troisième (0.4.0 devient 0.4.1).
- Une rupture (fragment de type `rupture`) fait aussi monter le deuxième chiffre avant la 1.0. Son fragment porte une consigne de migration.
- Une cible sans changement depuis sa dernière version garde son numéro.

### Une PR ordinaire ne change pas de numéro

Une PR de correctif ou d'évolution apporte seulement son fragment de note. Elle ne modifie jamais le champ `version` d'un `package.json`. Deux PR ouvertes en même temps se disputeraient sinon le même numéro.

### Publier une version

1. Une PR `chore(version): serveur x.y.z, orga x.y.z` vers `develop` relève le numéro de chaque cible qui a changé. Elle lance `yarn versionner valider` puis `yarn versionner compiler`, et commite les journaux.
2. Après sa fusion, une personne mainteneuse avance `main` jusqu'à `develop` en avance rapide, une fois la CI de `develop` au vert :
   ```bash
   git push origin develop:main
   ```
   Une fusion de PR par GitHub réécrirait les commits, en rebase comme en squash, et `main` divergerait de `develop`. Seul le rôle d'administration contourne la règle de PR de `main`.
3. Elle pose ensuite un tag par cible publiée, sur le commit de `main` :
   ```bash
   git tag serveur-x.y.z && git tag orga-x.y.z && git push origin --tags
   ```

### Ce qui reste à outiller

- Aujourd'hui, chaque poussée sur `main` publie l'image du serveur sous l'empreinte du commit (`ghcr.io/relaytour/relaytour-server:<sha7>`), avec la version `x.y.z-dev.<sha7>` dans ses métadonnées.
- Trois outils restent à écrire : le rattachement de chaque note à la version qui la publie, une release GitHub rédigée depuis les notes à chaque tag, et une image marquée du numéro de version.
- En attendant, une installation suit une image par son empreinte de commit, et la release se rédige à la main à partir du journal.

## Branches et CI

- `develop` est la branche d'intégration. `main` porte la dernière version publiée. L'historique de ces deux branches ne se réécrit pas.
- Pousser avec `git push origin <branche>`.
- Un correctif de CI s'ajoute comme étape de `ci.yml`, jamais comme job.
- Deux arrêts obligatoires : une migration destructive, et tout geste sur les secrets ou la production.

## Pièges connus

- MJML 5 remplace en silence une inclusion refusée : `scripts/gabarits-courriel.ts` assemble les fragments lui-même et vérifie la présence du pied de page.
- MJML strict refuse une variable dans un attribut de couleur : les gabarits écrivent des couleurs sentinelles (`#010101` encre, `#020202` primaire, `#030303` accent, `#040404` sol), que `scripts/gabarits-courriel.ts` remplace par `{{couleur…}}` après compilation. Ne jamais utiliser ces quatre valeurs comme vraies couleurs.
- `mjml2html` est asynchrone en version 5 alors que ses types le décrivent synchrone.
- Sans `--target`, un `docker build` construit la dernière étape du Dockerfile : `runtime` doit rester la dernière.
- BullMQ refuse `:` dans un `jobId`.
- antd 6 déprécie plusieurs props : `message` sur `Alert` (`title`), `tip` sur `Spin` (`description`), `direction` sur `Space` (`orientation`), `size="default"` sur `Progress` (`medium`), `valueStyle` sur `Statistic` (`styles.content`).
- Prettier reformate le texte des requêtes `graphql()` : relancer `yarn workspace @relaytour/orga codegen` après un formatage, sinon les types deviennent `unknown`.
- Dans `Coquille`, le contenu principal porte `minWidth: 0` : sans lui, un tableau large élargit toute la page au-delà de l'écran.
- antd 6.6 déprécie aussi `List` : utiliser une liste HTML simple.
- antd 6.6 nomme `.ant-drawer-section` le conteneur du tiroir et `.ant-modal-container` celui de la fenêtre modale ; `.ant-drawer-content` et `.ant-modal-content` n'existent plus. Le verre dépoli de `global.css` les cible ainsi. Après une montée de version d'antd, vérifier ces classes dans le navigateur.
- Prettier ne lit `.prettierignore` que dans le dossier courant : le lancer depuis la racine, sinon il reformate `packages/orga/src/gql`.
- Le sol se pose sur `html` seul, jamais sur `body` : un fond sur `body` se peint au-dessus des halos en `z-index: -1` et les cache.
- Aucune couleur en dur dans `packages/orga` : les composants lisent les variables `--rt-*` (`var(--rt-primaire)`, `var(--rt-erreur)`, `var(--rt-encre-08)`…). Une couleur d'un périmètre vient de son contenu.
- Aucune police servie par un tiers : une famille s'ajoute par paquet fontsource dans `packages/orga/src/polices.ts` et dans `POLICES_DISPONIBLES`.
- Les tests d'intégration partagent la base de développement : une fonction qui parcourt toute la base (comme `genererRappels`) doit être restreinte aux données du test, sinon elle crée des notifications sur les données locales.
- Les tests d'intégration mettent de vrais jobs dans le Redis local. Un worker lancé en même temps les traite et journalise « Aucun destinataire » pour les comptes de test déjà supprimés.
- Le mode de développement de Vite recharge les requêtes `graphql()` avant la fin de `yarn workspace @relaytour/orga codegen` : une erreur « Expecting a parsed GraphQL document » disparaît au rechargement.
