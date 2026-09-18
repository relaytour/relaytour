# Relaytour

Relaytour aide une association ou un collectif bénévole à organiser un événement récurrent : tournoi, rencontre sportive, festival, forum. Il garde la méthode d'une édition à l'autre.

- **Périmètres** : les sports et les pôles transverses d'une organisation, stables d'une édition à l'autre.
- **Référentes et référents** : les personnes affectées à un périmètre pour une édition.
- **Tâches** : des tâches types à échéance relative au jour J (J-120, J+14), recréées à chaque édition, puis suivies dans un rétroplanning.
- **Fiches méthode** : le « comment faire » de chaque périmètre, versionné et transmis à l'édition suivante.
- **Postes à pourvoir, souhaits, notifications** : ce qu'il faut pour constituer l'équipe et tenir les échéances.

Relaytour est un logiciel libre (AGPL-3.0). Vous pouvez l'héberger vous-même. Le contenu de votre organisation reste chez vous : le dépôt ne contient qu'une organisation d'exemple.

| Paquet | Rôle |
|---|---|
| `packages/server` | API GraphQL (Express, Apollo, Pothos), connexion Better Auth et worker (BullMQ, mails). |
| `packages/orga` | Espace organisateur (React, Vite, antd). |
| `packages/database` | Schéma Prisma, migrations et services Docker du poste local. |
| `packages/tokens` | Couleurs et polices du thème par défaut. |
| `content/exemple` | Organisation d'exemple : périmètres, fiches méthode et tâches types. |
| `infra/` | Déploiement de référence : Docker Compose, Caddyfile d'exemple et étapes pour s'auto-héberger. |
| `outils/versionner.mjs` | Notes de version et trains de version. |
| `docs/adr/` | Décisions d'architecture. |

Les règles du dépôt (décisions, invariants, style d'écriture) sont dans [CONTRIBUTING.md](CONTRIBUTING.md).

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

Services locaux : MariaDB (4410), Redis (4411), Mailpit (SMTP 4415, interface http://localhost:4416).

## Importer votre contenu

```bash
yarn workspace @relaytour/server orga:valider /chemin/vers/votre/contenu
yarn workspace @relaytour/server orga:importer --dossier /chemin/vers/votre/contenu --edition 2027
```

La structure attendue est décrite dans [content/exemple/README.md](content/exemple/README.md). Le plus simple est de créer votre dépôt d'organisation depuis le gabarit `relaytour/organisation-modele`, qui documente les trois façons de le rattacher à Relaytour. Le choix du fournisseur de mail est décrit dans [docs/courriel.md](docs/courriel.md).

## Commandes

```bash
yarn check        # lint, types, build
yarn test         # tests unitaires
yarn codegen      # schema.graphql, gabarits de mail et types GraphQL (contrats commités)
yarn db:migrate   # nouvelle migration Prisma
yarn workspace @relaytour/server courriel:essai adresse@exemple.org   # mail d'essai (worker requis)
```

## Licence

Relaytour est distribué sous licence [GNU AGPL-3.0](LICENSE). Copyright Quentin Fremeaux.
