# Auto-héberger Relaytour

Ce dossier décrit le déploiement de référence (ADR 0004) : une machine sous Linux, Docker et Caddy sur l'hôte, une pile Compose. Il donne les étapes à suivre, pas un outillage clé en main : chaque hébergeur garde ses propres scripts, sauvegardes et supervision hors de ce dépôt (ADR 0007).

## Ce que contient la pile

| Service | Rôle |
|---|---|
| `db` | MariaDB 11.8, publiée sur `127.0.0.1` seulement |
| `cache` | Valkey 8, file des mails et des rappels |
| `migrate` | Applique les migrations avant le démarrage de l'API |
| `orga` | Copie l'espace organisateur (site statique) dans `ORGA_DIR` à chaque démarrage |
| `server` | API GraphQL, port 4400 sur `127.0.0.1` |
| `worker` | Mails, rappels et résumés |
| `mailpit` | Boîte de test, profil `courriel`, pour une recette seulement |

L'espace organisateur est un site statique, livré par l'image `-orga` et servi par Caddy, qui relaie `/api/auth/*` et `/graphql` vers l'API. Aucun outil Node n'est nécessaire sur le serveur.

## Étapes

1. **Machine.** Un serveur au nom de votre organisation, Debian ou Ubuntu, avec Docker Engine, le plugin Compose et Caddy installés depuis leurs dépôts officiels.
2. **Durcissement.** Un utilisateur sans sudo pour le déploiement, SSH par clé seulement, un pare-feu qui n'ouvre que SSH, 80 et 443, les mises à jour de sécurité automatiques. Tous les ports Docker sont publiés sur `127.0.0.1` : Caddy seul écoute sur 80 et 443.
3. **DNS.** Deux hôtes vers la machine : l'API et l'espace organisateur (par exemple `api.exemple.org` et `orga.exemple.org`).
4. **Dossiers.** `/srv/relaytour` avec `docker-compose.yml` (copié depuis `compose/`), un `.env` créé depuis `compose/.env.example` (droits 640), et `/srv/relaytour/orga` (`ORGA_DIR`) pour les fichiers de l'espace organisateur.
5. **Image.** `docker login ghcr.io` si l'image est privée, puis `IMAGE_TAG` dans le `.env`. Le workflow `image.yml` publie trois images à chaque poussée sur `main`, sous le tag `main` et sous le SHA court du commit : l'API et le worker (`<tag>`), les migrations (`<tag>-migrate`) et l'espace organisateur (`<tag>-orga`).
6. **Mail.** Un fournisseur SMTP et les enregistrements SPF, DKIM et DMARC de votre domaine (voir `docs/courriel.md`). Une fois la pile démarrée, un mail d'essai vérifie la chaîne :
    ```bash
    docker compose --env-file .env exec worker node dist/essai-courriel.js adresse@exemple.org
    ```
7. **Caddy.** Copier `caddy/Caddyfile.example` dans `/etc/caddy/Caddyfile`, remplacer les hôtes, recharger Caddy.
8. **Démarrage.** `docker compose --env-file .env up -d`, puis vérifier `https://api.exemple.org/health`.
9. **Espace organisateur.** Rien à faire : le service `orga` a déposé les fichiers dans `ORGA_DIR` au démarrage, et Caddy les sert.
10. **Premier compte admin.**
    ```bash
    docker compose --env-file .env exec server node dist/creer-admin.js adresse@exemple.org "Prénom Nom"
    ```
11. **Première édition.** L'import des tâches types exige une édition, créée ici ou plus tard dans l'espace organisateur :
    ```bash
    docker compose --env-file .env exec server node dist/creer-edition.js 2027 "Rencontres 2027" 2027-06-05 2027-06-06
    ```
12. **Contenu de l'organisation.** Cloner votre dépôt d'organisation (créé depuis `relaytour/organisation-modele`) dans `/srv/relaytour/contenu`, puis :
    ```bash
    docker compose --env-file .env run --rm -v /srv/relaytour/contenu/contenu:/contenu:ro server \
      node dist/orga-importer.js --dossier /contenu --edition 2027 --simulation
    docker compose --env-file .env run --rm -v /srv/relaytour/contenu/contenu:/contenu:ro server \
      node dist/orga-importer.js --dossier /contenu --edition 2027
    ```
13. **Sauvegarde.** Un dump quotidien de la base (`mariadb-dump` dans le conteneur `db`) copié hors de la machine, et une restauration testée avant l'ouverture.

## Mettre à jour

Changer `IMAGE_TAG` dans le `.env`, puis `docker compose --env-file .env up -d`. Le service `migrate` applique les migrations, le service `orga` dépose la nouvelle version de l'espace organisateur, puis l'API redémarre. Les anciens fichiers `assets/` restent dans `ORGA_DIR` ; un nettoyage périodique du dossier reste à votre charge.

## Adapter la pile à votre hébergement

Ne modifiez pas `docker-compose.yml` : ajoutez un fichier de surcharge, par exemple `compose.local.yml`, et lancez `docker compose -f docker-compose.yml -f compose.local.yml …`. C'est là que vont vos ports, vos limites mémoire, vos volumes et votre supervision. Si une adaptation exige un changement dans l'application, proposez-le dans le dépôt de Relaytour sous une forme générique.

## Tâches planifiées

Le worker planifie deux tâches, à l'heure de Paris : à 6 h 30 les rappels d'échéance (7 jours, veille) et le signalement des retards ; à 7 h les résumés par mail. Pour en lancer une tout de suite :

```bash
docker compose --env-file .env exec worker node dist/planification-lancer.js rappels
docker compose --env-file .env exec worker node dist/planification-lancer.js resumes
```

Un rappel n'est jamais créé deux fois et un résumé ne part qu'une fois par jour : relancer est sans risque.
