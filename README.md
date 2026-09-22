# Relaytour

Relaytour aide une association ou un collectif bénévole à organiser ses activités récurrentes. Une activité peut être un événement (tournoi, rencontre sportive, festival), une section qui vit à la saison, ou une instance comme un conseil d'administration. Relaytour garde la méthode d'une période à l'autre.

- **Activités** : les événements, sections et instances d'une organisation. Chacune a ses périodes (édition, saison ou mandat) et ses groupes de périmètres.
- **Périmètres** : les parties d'une activité (un sport, un pôle, une commission), rangées en groupes et stables d'une période à l'autre.
- **Référentes et référents** : les personnes affectées à un périmètre pour une période.
- **Tâches** : des tâches types à échéance relative au premier jour (J-120, J+14), recréées à chaque période, puis suivies dans un rétroplanning.
- **Fiches méthode** : le « comment faire » de chaque périmètre, versionné et transmis à la période suivante.
- **Postes à pourvoir, souhaits, notifications** : ce qu'il faut pour constituer l'équipe et tenir les échéances.
- **Plusieurs organisations** : une installation peut servir plusieurs associations. Un hébergeur les administre par script ou par API. L'API ne renvoie aucune donnée d'une organisation ; seul l'export d'une organisation, écrit sur le serveur, contient ses noms et ses adresses (ADR 0008).

Relaytour est un logiciel libre (AGPL-3.0). Vous pouvez l'héberger vous-même. Le contenu de votre organisation reste chez vous : le dépôt ne contient qu'une organisation d'exemple.

| Paquet | Rôle |
|---|---|
| `packages/server` | API GraphQL (Express, Apollo, Pothos), connexion Better Auth et worker (BullMQ, mails). |
| `packages/orga` | Espace organisateur (React, Vite, antd). |
| `packages/database` | Schéma Prisma, migrations et services Docker du poste local. |
| `packages/tokens` | Modèle de thème et thème par défaut de Relaytour. Chaque organisation déclare le sien dans `organisation.yaml`. |
| `content/exemple` | Organisation d'exemple : identité et thème, deux activités, leurs périmètres, fiches méthode et tâches types. |
| `infra/` | Déploiement de référence : Docker Compose, Caddyfile d'exemple et étapes pour s'auto-héberger. |
| `outils/versionner.mjs` | Journal des changements : un fragment par changement visible, compilé en `notes/notes-de-version.<cible>.json`. |
| `docs/adr/` | Décisions d'architecture. |
| `docs/feuille-de-route.md` | Évolutions envisagées après la première version. |

Les règles du dépôt (décisions, invariants, style d'écriture, proposition d'une PR) sont dans [CONTRIBUTING.md](CONTRIBUTING.md). Chaque participation suit le [code de conduite](CODE_OF_CONDUCT.md). Une faille de sécurité se signale en privé ([SECURITY.md](SECURITY.md)).

## Prérequis

- Node 24 (`.nvmrc`) et corepack (`corepack enable`), qui fournit Yarn 4.
- Docker.

## Démarrer

```bash
cp packages/database/.env.example packages/database/.env
cp packages/server/.env.example packages/server/.env
yarn setup        # installation, services Docker, client Prisma, migrations, contrats
yarn dev          # API sur http://localhost:4400/graphql, worker et espace organisateur sur http://localhost:5305
yarn workspace @relaytour/server admin:creer adresse@exemple.org "Prénom Nom"   # premier compte admin
yarn workspace @relaytour/server edition:creer 2027 "Rencontres 2027" 2027-06-05 2027-06-06   # première édition
```

Services locaux : MariaDB (4410), Valkey (4411), Mailpit (SMTP 4415, interface http://localhost:4416). Adminer (http://localhost:4417) démarre avec `COMPOSE_PROFILES=outils yarn db:up`.

## Importer votre contenu

```bash
yarn workspace @relaytour/server orga:valider /chemin/vers/votre/contenu
yarn workspace @relaytour/server orga:importer --dossier /chemin/vers/votre/contenu --edition 2027
```

Une installation qui porte plusieurs organisations exige `--organisation <slug>`, pour l'import comme pour l'export. La structure attendue, en disposition plate ou en disposition `activites/`, est décrite dans [content/exemple/README.md](content/exemple/README.md). Le plus simple est de créer votre dépôt d'organisation depuis le gabarit `relaytour/organisation-modele`, qui documente les trois façons de le rattacher à Relaytour. Le choix du fournisseur de mail est décrit dans [docs/courriel.md](docs/courriel.md).

## Commandes

```bash
yarn check        # lint, types, build
yarn test         # tests unitaires
yarn workspace @relaytour/server test:integration   # tests sur la base locale (worker arrêté)
yarn codegen      # schema.graphql, gabarits de mail et types GraphQL (contrats commités)
yarn db:migrate   # nouvelle migration Prisma
yarn workspace @relaytour/server courriel:essai adresse@exemple.org   # mail d'essai (worker requis)
yarn workspace @relaytour/server orga:exporter --dossier /chemin/vers/votre/contenu   # écrit tout le contenu porté par l'application
```

## Licence

Relaytour est distribué sous licence [GNU AGPL-3.0](LICENSE). Copyright Quentin Fremeaux. Le nom et le pictogramme ne sont pas couverts par cette licence ([MARQUE.md](MARQUE.md)).
