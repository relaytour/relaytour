# Auto-héberger Relaytour

Ce dossier décrit le déploiement de référence (ADR 0004) : une machine sous Linux, Docker et Caddy sur l'hôte, une pile Compose. Il donne les étapes à suivre, pas un outillage clé en main : chaque hébergeur garde ses propres scripts, sauvegardes et supervision hors de ce dépôt (ADR 0007).

## Ce que contient la pile

| Service | Rôle |
|---|---|
| `db` | MariaDB 11.8, joignable par les seuls conteneurs de la pile |
| `cache` | Valkey 8, file des mails et des rappels, joignable par les seuls conteneurs de la pile |
| `migrate` | Applique les migrations avant le démarrage de l'API |
| `orga` | Copie l'espace organisateur (site statique) dans `ORGA_DIR` à chaque démarrage |
| `server` | API GraphQL, port 4400 sur `127.0.0.1` |
| `worker` | Mails, rappels et résumés |

L'espace organisateur est un site statique, livré par l'image `-orga` et servi par Caddy, qui relaie `/api/auth/*`, `/graphql` et `/medias/*` vers l'API. `/medias/*` sert les logos et les favicons des organisations (ADR 0009). `/graphql` porte aussi le flux des changements (voir « Laisser passer le flux des changements »). Aucun outil Node n'est nécessaire sur le serveur.

## Étapes

1. **Machine.** Un serveur au nom de votre organisation, Debian ou Ubuntu, avec Docker Engine, le plugin Compose et Caddy installés depuis leurs dépôts officiels.
2. **Durcissement.** Un utilisateur sans sudo pour le déploiement, SSH par clé seulement, un pare-feu qui n'ouvre que SSH, 80 et 443, les mises à jour de sécurité automatiques. Tous les ports Docker sont publiés sur `127.0.0.1` : Caddy seul écoute sur 80 et 443.
3. **DNS.** Deux hôtes vers la machine : l'API et l'espace organisateur (par exemple `api.exemple.org` et `orga.exemple.org`).
4. **Dossiers.** `/srv/relaytour` avec `docker-compose.yml` (copié depuis `compose/`), un `.env` créé depuis `compose/.env.example` (droits 640), et `/srv/relaytour/orga` (`ORGA_DIR`) pour les fichiers de l'espace organisateur.
5. **Image.** `docker login ghcr.io` si l'image est privée, puis `IMAGE_TAG` dans le `.env`. Le workflow `publier.yml` publie trois images : l'API et le worker (`<tag>`), les migrations (`<tag>-migrate`) et l'espace organisateur (`<tag>-orga`). Chaque version publiée porte les étiquettes `x.y.z`, `x.y` et `latest` ; chaque poussée sur `main` porte aussi l'empreinte courte du commit et l'étiquette `main`. Une installation fixe `IMAGE_TAG=x.y.z` pour rester sur une version, ou `IMAGE_TAG=x.y` pour recevoir les correctifs de cette version.
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
12. **Contenu de l'organisation.** Cloner votre dépôt d'organisation (créé depuis `relaytour/organisation-modele`) dans `/srv/relaytour/contenu`, puis importer. L'import lit `organisation.yaml` : le nom, le thème et les domaines de mail de votre organisation remplacent les valeurs d'amorçage du `.env`.
    ```bash
    docker compose --env-file .env run --rm -v /srv/relaytour/contenu/contenu:/contenu:ro server \
      node dist/orga-importer.js --dossier /contenu --edition 2027 --simulation
    docker compose --env-file .env run --rm -v /srv/relaytour/contenu/contenu:/contenu:ro server \
      node dist/orga-importer.js --dossier /contenu --edition 2027
    ```
13. **Sauvegarde.** Un dump quotidien de la base (`mariadb-dump` dans le conteneur `db`) copié hors de la machine, et une restauration testée avant l'ouverture. La section « Sauvegarder et restaurer » détaille ce qui se sauvegarde et comment se restaure une installation.

## Sauvegarder et restaurer

Ce que porte une installation, et ce qu'il faut en garder :

- **La base MariaDB** (volume `dbdata`) : toutes les données des organisations. Un dump quotidien suffit : `docker compose --env-file .env exec -T db sh -c 'mariadb-dump --single-transaction --routines -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' | gzip > relaytour-$(date +%F).sql.gz` (les variables se développent dans le conteneur, et `-T` évite un pseudo-terminal dans le flux). Le fichier contient des données personnelles : chiffrez-le avant de le copier hors de la machine (`age` ou `gpg`), limitez sa conservation (par exemple 30 jours glissants et une copie mensuelle sur un an), et gardez la clé de déchiffrement hors de la machine.
- **Le `.env`** : les secrets de l'installation. Sans `BETTER_AUTH_SECRET`, les codes de connexion en attente sont perdus, sans les clés VAPID, tous les abonnements push. Gardez-en une copie chiffrée avec les dumps.
- **Le dossier de contenu de l'organisation** : il vit dans son propre dépôt Git ; l'application le relit par `orga-importer`.
- **Le volume `exports`** : des fichiers d'export d'organisation, avec noms et adresses. Il ne se sauvegarde pas : un export se remet à son destinataire puis se supprime (point 4 de « Plusieurs organisations »).
- **Le volume `cachedata`** (Valkey) : la file des mails et les compteurs de limite. Il ne se sauvegarde pas. Après une restauration, les mails en attente sont perdus ; les rappels et les résumés repartent à la prochaine planification.
- **`ORGA_DIR`** : l'espace organisateur, que l'image `-orga` redépose à chaque `up`.

Restaurer sur une machine neuve, dans cet ordre :

1. Installer la pile comme ci-dessus, avec le `.env` restauré et la même `IMAGE_TAG` que l'installation sauvegardée.
2. Démarrer la base seule : `docker compose --env-file .env up -d db`.
3. Charger le dump : `gunzip -c relaytour-AAAA-MM-JJ.sql.gz | docker compose --env-file .env exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"'`.
4. Démarrer le reste : `docker compose --env-file .env up -d`. Le service `migrate` applique les migrations manquantes si l'image est plus récente que le dump.
5. Vérifier `/ready`, puis une connexion par code et un mail de test (`essai-courriel`).

Testez cette restauration avant l'ouverture, puis à chaque changement de machine ou de version majeure de MariaDB.

## Mettre à jour

Les versions publiées sont listées dans les releases du dépôt, avec leurs notes et leurs consignes de migration. Changer `IMAGE_TAG` dans le `.env`, puis `docker compose --env-file .env up -d`. Le service `migrate` applique les migrations, le service `orga` dépose la nouvelle version de l'espace organisateur, puis l'API redémarre. Les anciens fichiers `assets/` restent dans `ORGA_DIR` ; un nettoyage périodique du dossier reste à votre charge.

L'espace organisateur s'installe sur un téléphone (ADR 0023). Deux points concernent le serveur web :

- `/sw.js` et `/index.html` ne reçoivent pas de cache long. Le `Caddyfile` d'exemple ne met en cache long que `/assets/*` : il convient tel quel.
- Une application ouverte garde l'ancienne version jusqu'à son rechargement. Gardez donc les fichiers `assets/` de la version précédente lors d'un nettoyage.

Le manifest de chaque organisation se sert sous `/medias/application/`, chemin déjà relayé vers l'API.

### Revenir à une version antérieure

Une version récente peut écrire, dans la configuration d'une organisation, un champ qu'une version antérieure ne connaît pas. À partir de la version 0.13, le serveur écarte ce champ à la lecture et garde le reste : un retour arrière ne change pas l'identité de l'organisation. Une configuration qu'il ne sait pas lire du tout n'est jamais écrasée : le journal porte l'événement `configuration-illisible`, et l'organisation s'affiche avec l'identité d'amorçage jusqu'à son réimport.

Les versions 0.12.1 et antérieures n'ont pas cette protection. Au démarrage, elles remplacent une configuration qu'elles ne lisent pas par les valeurs d'amorçage du `.env`. Avant de revenir d'une version 0.13 ou suivante à l'une d'elles, exportez le contenu de l'organisation (`orga-exporter`), ou retirez l'icône d'application dans l'écran « Organisation ».

### Notifications push

Les notifications push sont facultatives (ADR 0024). Pour les ouvrir :

1. Créez une paire de clés VAPID, une seule fois : `npx web-push generate-vapid-keys`.
2. Renseignez `PUSH_VAPID_PUBLIQUE`, `PUSH_VAPID_PRIVEE` et `PUSH_VAPID_SUJET` dans le `.env`, puis relancez la pile. Le sujet est une adresse `mailto:` ou `https://` que les services de push peuvent joindre.
3. Laissez le worker sortir en HTTPS vers `fcm.googleapis.com`, `*.push.apple.com`, `updates.push.services.mozilla.com` et `*.notify.windows.com`.

La clé privée est un secret : elle ne quitte pas le `.env`. Changer la paire de clés annule tous les abonnements, et chaque personne doit réactiver les notifications sur ses appareils.

## Adapter la pile à votre hébergement

Ne modifiez pas `docker-compose.yml` : ajoutez un fichier de surcharge, par exemple `compose.local.yml`, et lancez `docker compose -f docker-compose.yml -f compose.local.yml …`. C'est là que vont vos ports, vos limites mémoire, vos volumes et votre supervision. La base et le cache ne publient aucun port et ne sont joignables que sur le réseau interne de la pile : la file des mails contient des codes de connexion en clair pendant quelques minutes, et tout processus de la machine pourrait les lire. Valkey exige en plus le mot de passe `VALKEY_MOT_DE_PASSE`. Pour administrer la base, passez par `docker compose exec db mariadb -u root -p`. Si un outil de la machine doit joindre la base, publiez le port dans votre surcharge, sur `127.0.0.1` seulement. Si une adaptation exige un changement dans l'application, proposez-le dans le dépôt de Relaytour sous une forme générique.

Les services de l'application tournent sans capacité, sans élévation de privilège et sur un système de fichiers en lecture seule (`/tmp` en mémoire, le volume `exports` en écriture). Le service `orga`, qui écrit dans `ORGA_DIR`, n'a pas de réseau ; fixez-lui `user:` dans votre surcharge si votre utilisateur de déploiement ou Caddy l'exige. L'image `-migrate` ne contient ni source ni build : les dépendances installées (dont le CLI Prisma, une dépendance de développement), le schéma et les migrations, sous l'utilisateur `node`. Les images publiées portent une attestation de provenance et un inventaire des composants (SBOM), lisibles avec `docker buildx imagetools inspect`.

## Laisser passer le flux des changements

L'API signale chaque changement aux navigateurs par un flux SSE (ADR 0017) : une réponse HTTP qui reste ouverte et reçoit quelques lignes par signal. Le flux passe par `/graphql`, pour une requête `POST` qui demande `text/event-stream`. Il n'ajoute ni chemin ni port.

Le `Caddyfile` d'exemple relaie ce flux sans réglage : Caddy transmet une réponse `text/event-stream` au fil de l'eau. Tout autre intermédiaire placé devant l'API (proxy, répartiteur de charge, CDN) respecte trois règles.

- **Tampon.** L'intermédiaire transmet chaque ligne dès qu'il la reçoit, sans mettre la réponse en tampon. nginx, par exemple, met les réponses en tampon par défaut : la directive `proxy_buffering off` s'applique alors au relais de `/graphql`.
- **Compression.** L'intermédiaire ne compresse pas une réponse `text/event-stream`. L'API annonce `Content-Encoding: none` pour écarter la compression.
- **Délai d'inactivité.** L'API envoie un battement toutes les 12 secondes. Un délai d'inactivité de 30 secondes ou plus garde donc le flux ouvert.

- **Adresse du client.** L'API lit l'adresse du client dans l'en-tête `X-Relaytour-Ip`, que le `Caddyfile` d'exemple remplit avec `{client_ip}` (`header_up`). Elle ne lit cet en-tête que sur une connexion venue d'une adresse locale ou privée, celle du proxy ; sinon elle retient l'adresse qu'Express résout derrière un seul relais. Un intermédiaire placé devant Caddy (CDN, répartiteur de charge) se déclare dans `trusted_proxies` (bloc global `servers`), pour que `{client_ip}` reste l'adresse du client et non celle de l'intermédiaire : sinon les compteurs de la connexion et du formulaire public comptent tous les clients comme un seul. Un autre proxy que Caddy pose lui-même `X-Relaytour-Ip` avec l'adresse du client et remplace toute valeur reçue.

Ce dépôt ne vérifie que la configuration de Caddy.

Le serveur ferme chaque flux après 15 minutes, et le navigateur en rouvre un. Un intermédiaire qui coupe une requête plus tôt ne bloque rien : le navigateur rouvre un flux après 1 à 30 secondes. Chaque onglet visible ouvre un flux, et une personne en garde quatre au plus par processus de l'API. En HTTP/1.1, un navigateur ouvre six connexions au plus par hôte : servez l'espace organisateur en HTTP/2 ou en HTTP/3, comme Caddy le fait par défaut.

Le flux est un accélérateur. Sans lui, l'espace organisateur relit ses écrans chaque minute et à chaque retour sur l'onglet. Un flux retenu en tampon est le seul cas gênant. Le navigateur reçoit alors les en-têtes de la réponse et aucun signal : il espace sa relecture à cinq minutes.

Deux vérifications suivent une mise en service ou un changement de proxy.

1. **Sans compte.** La commande suivante reçoit une réponse `text/event-stream`, qui porte un refus (`FORBIDDEN`) puis se termine. Le chemin et le type de la réponse traversent donc le proxy.
    ```bash
    curl -N -X POST https://orga.exemple.org/graphql \
      -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
      -d '{"query":"subscription { changements { entite } }"}'
    ```
2. **Avec deux comptes d'une même activité**, ouverts dans deux navigateurs. Une personne change le statut d'une tâche, et l'autre écran affiche le changement en quelques secondes. Un changement qui n'apparaît qu'au retour sur l'onglet, ou après plusieurs minutes, désigne un tampon.

## Héberger plusieurs organisations

Une installation peut porter plusieurs organisations (ADR 0008). Chacune a ses membres, ses activités et son thème ; aucune ne voit les données d'une autre.

1. **Créer une organisation** et inviter son premier admin :
    ```bash
    docker compose --env-file .env exec server node dist/creer-organisation.js rencontres "Les Rencontres" \
      --domaines exemple.org --admin adresse@exemple.org --admin-nom "Prénom Nom"
    ```
    Les options `--limite-activites` et `--limite-periodes` plafonnent le nombre d'activités et de périodes ouvertes. Sans elles, l'organisation n'a aucune limite.
2. **Désigner l'organisation** dans les autres scripts avec `--organisation <slug>` : `creer-admin.js`, `creer-edition.js` (et `--activite <slug>`). `creer-admin.js` suit le cloisonnement des organisations (ADR 0030) : une adresse qui a déjà un compte dans une autre organisation reçoit une invitation au rôle d'admin, qu'elle accepte depuis son compte, et un compte archivé n'est rétabli que s'il n'appartient qu'à cette organisation.
3. **Administrer par API** (facultatif) : un jeton `JETON_ADMINISTRATION` d'au moins 32 caractères, dans le `.env`, ouvre les requêtes `organisations` et les mutations `creerOrganisation`, `inviterPremierAdmin`, `modifierOrganisationInstallation` et `demanderExport` sur `/graphql`, avec l'en-tête `Authorization: Bearer <jeton>`. L'API ne rend à ce jeton aucune donnée d'une organisation ; l'export qu'il déclenche s'écrit sur le disque du serveur et contient les noms et les adresses (point 4). `CONTACT_HEBERGEUR` indique à qui s'adresser quand une limite est atteinte. Par défaut, le jeton n'est accepté que sur une requête locale, qui n'est pas passée par Caddy : un programme de la machine appelle `http://127.0.0.1:4400/graphql` (ADR 0013). Ce critère suppose que tout relais vers l'API pose `X-Forwarded-For`, ce que Caddy fait toujours, et que le port de l'API reste publié sur `127.0.0.1`. `JETON_ADMINISTRATION_LOCAL=false` accepte le jeton à travers Caddy, pour un hébergeur qui administre depuis une autre machine. Dix jetons refusés en quinze minutes depuis une même adresse ferment l'API d'administration à cette adresse pour la fenêtre.
4. **Exporter une organisation** : le fichier s'écrit dans le volume `exports`.
    ```bash
    docker compose --env-file .env exec server node dist/exporter-organisation.js rencontres
    docker compose --env-file .env cp server:/exports ./exports
    ```
    Le fichier contient des noms et des adresses : remettez-le à l'organisation et supprimez-le du serveur ensuite.
5. **Code source.** L'espace organisateur lie le code source de la version exécutée, comme l'AGPL l'exige (article 13). Par défaut, le lien mène au dépôt public. Un hébergeur qui modifie Relaytour indique son propre dépôt dans `CODE_SOURCE_URL`. De la même façon, le menu du compte et le mail d'invitation lient les modes d'emploi du site de Relaytour ; `MODES_D_EMPLOI_URL` les remplace par ceux de l'hébergeur.
6. **Version et support.** Le menu du compte affiche le numéro de version de l'installation et ouvre les notes de version, limitées au rôle de chaque personne (ADR 0021). Le bouton « Support » du même menu ouvre l'adresse de support que l'organisation a déclarée. Pour les organisations qui n'en ont pas, `SUPPORT_URL` indique l'action de l'hébergeur : une page d'assistance en `https://` ou une adresse en `mailto:`. Sans l'une ni l'autre, le bouton n'apparaît pas.
7. **Identité et contenu.** Les admins d'une organisation modifient son nom, ses contacts, son logo et son thème dans l'espace organisateur, et téléchargent son contenu en archive. Le portail d'un hébergeur ne gère que le statut et les limites (ADR 0009).

## Constituer une équipe depuis le serveur

Une commande importe l'équipe d'une activité pour une période : les comptes, les affectations, les contacts principaux et les souhaits (ADR 0013). Elle s'exécute dans le conteneur, sans route réseau. Elle crée ce qui manque, ne retire rien, et peut se relancer. Aucun mail ne part sans `--envoyer-mails`.

```yaml
# equipe.yaml : données personnelles, à garder hors de tout dépôt Git.
personnes:
  - nom: Prénom Nom
    adresse: prenom.nom@exemple.org
    affectations: [coordination, football]   # slugs des périmètres de l'activité
    contactPrincipal: [coordination]         # parmi ses affectations
  - nom: Autre Personne
    adresse: autre@exemple.org
    souhaits: [volley]                       # intéressée, sans affectation
```

```bash
docker compose --env-file .env run --rm -v /chemin/equipe.yaml:/equipe.yaml:ro server \
  node dist/equipe-importer.js --fichier /equipe.yaml --activite rencontres --edition 2027 --simulation
```

Sans `--simulation`, la commande écrit. Avec `--envoyer-mails`, une personne nouvelle reçoit son invitation, qui liste ses périmètres, et une personne déjà membre reçoit le mail d'équipe (ADR 0012). Supprimez le fichier du serveur après l'import.

La commande agit comme un admin de l'organisation : elle rattache par son adresse un compte déjà membre, quelle que soit son activité. Une adresse qui a déjà un compte hors de l'organisation, sur une installation partagée, ne reçoit qu'une invitation : ses affectations, ses souhaits et sa désignation de contact principal attendent son accord, et le compte rendu la compte à part (ADR 0030). Une personne déclarée sans affectation ni souhait n'entre dans l'équipe d'aucune activité (ADR 0018) : seuls les admins de l'organisation la lisent, dans l'annuaire.

## Tâches planifiées

Le worker planifie deux tâches pour chaque organisation active, à l'heure de son fuseau (ADR 0008) : à 6 h 30 les rappels d'échéance (7 jours, veille) et le signalement des retards ; à 7 h les résumés par mail. Il ajuste ces planifications à son démarrage, puis chaque heure : une organisation créée ou suspendue est prise en compte dans l'heure. Pour lancer une tâche tout de suite :

```bash
docker compose --env-file .env exec worker node dist/planification-lancer.js rappels
docker compose --env-file .env exec worker node dist/planification-lancer.js resumes --organisation rencontres
```

Sans `--organisation`, la tâche part pour toutes les organisations actives. Un rappel n'est jamais créé deux fois et un résumé ne part qu'une fois par jour et par organisation : relancer est sans risque.

Une troisième tâche, `purge`, tourne chaque nuit à 3 h 15, à l'heure du serveur, pour toutes les organisations quel que soit leur statut. Elle supprime les demandes pour rejoindre l'équipe des périodes archivées (ADR 0015) : ces demandes portent le nom et l'adresse de personnes qui ne sont pas membres. Les comptes et les affectations restent. Elle se lance aussi à la main :

```bash
docker compose --env-file .env exec worker node dist/planification-lancer.js purge
```
