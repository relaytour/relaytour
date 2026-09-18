# ADR 0006 — Plusieurs organisations dans une même installation

- **Statut** : proposée (dépend de l'ADR 0005)
- **Date** : 2026-09-17

## Contexte

Relaytour doit servir plusieurs organisations, qu'un hébergeur les accueille sur une même installation ou qu'une fédération héberge pour ses clubs. Deux façons d'héberger plusieurs organisations ont été comparées le 17 septembre 2026.

- **Une pile Compose par organisation** : peu de code à changer, isolation naturelle des données, mais une base, un cache et un worker de plus à chaque organisation, et des mises à jour rejouées pour chaque pile.
- **Plusieurs organisations dans le code** : un chantier plus lourd sur les droits, les mails et la base, puis une seule pile à exploiter quel que soit le nombre d'organisations.

La seconde voie est retenue dès le départ pour ne pas construire deux fois, et parce qu'une fédération, une ligue ou une commune qui héberge pour plusieurs clubs a le même besoin.

L'application est aujourd'hui écrite pour une seule organisation. L'inventaire du 17 septembre 2026 relève :

- **Modèle de données** (`packages/database/prisma/schema.prisma`) : aucune notion d'organisation. `Edition` est la seule racine et ne couvre pas `User`, `Notification`, `PreferenceNotification`, `RateLimit` ni `Newsletter`. `Perimetre` et les fiches communes (`Fiche.perimetreId` nul) sont transverses. Cinq contraintes d'unicité sont globales : `User.email`, `Edition.annee`, `Perimetre.slug`, `Fiche.slug`, `Notification.cle`.
- **Droits** : `estAdmin` est un booléen global qui court-circuite tout contrôle (`packages/server/src/lib/droits.ts`, scope `admin` de `schema/builder.ts`). `buildContext` (`src/context.ts`) ne porte aucune organisation. Les requêtes `editions`, `editionCourante` et `perimetres` (`schema/organisation.ts`) ne filtrent rien pour toute personne connectée.
- **Marque en dur** : en-tête et pied des gabarits MJML (`src/courriel/gabarits/`), sujets (`src/courriel/messages.ts`), expéditeur par défaut (`src/env.ts`), en-tête de l'application (`packages/orga/src/composants/Coquille.tsx`), palette figée dans `packages/tokens`. Le nom de l'organisation vient pour l'instant de la variable `ORGANISATION_NOM`.
- **Domaines autorisés** : lus dans la variable `DOMAINES_COURRIEL_AUTORISES`, communs à tout le processus.
- **Worker** : un seul cron `Europe/Paris` par processus (`src/worker.ts`), files BullMQ sans préfixe (`src/jobs/queues.ts`), clés de limite sans discriminant (`src/lib/limite.ts`), `genererRappels` et `personnesAResumer` parcourent toute la base (`src/jobs/planification.ts`), `periodeEdition` cherche l'édition précédente par année sur toute la table (`src/lib/score.ts`).
- **Infrastructure** : aucune limite mémoire dans `infra/compose/docker-compose.yml`, Caddyfile d'exemple à hôtes fixes.

## Décision

### Modèle

- Une table `Organisation` (identifiant, slug, nom, sigle, configuration) devient la racine de toutes les données. `Edition`, `Perimetre`, `Fiche`, `Notification`, `PreferenceNotification` et `RateLimit` reçoivent une clé d'organisation. `Newsletter` est retirée du périmètre publié.
- Les cinq contraintes d'unicité globales deviennent des contraintes par organisation, sauf `User.email`.
- **Un compte est global, ses appartenances sont multiples.** Une personne a une seule adresse et peut appartenir à plusieurs organisations avec un rôle par organisation (admin ou membre). Le module « organization » de Better Auth porte ce modèle.
- `estAdmin` devient un rôle d'organisation. `buildContext` porte l'organisation active et tout accès de données la filtre. Une requête sans organisation active ne lit rien.
- Les migrations restent additives (invariant 8) : les nouvelles colonnes sont remplies vers une organisation par défaut avant de devenir obligatoires.

### Configuration d'organisation

- Chaque organisation porte sa configuration : nom, sigle, expéditeur de mail, domaines de mail autorisés, origine de l'espace organisateur, couleurs, fuseau horaire. Elle se lit en base et l'API la sert à l'espace organisateur.
- Les gabarits de mail se rendent avec ces variables. Le build vérifie la présence des marqueurs de la configuration, pas de constantes.
- L'espace organisateur n'a plus de marque figée : un seul build sert toutes les organisations. `packages/tokens` devient le thème par défaut, parmi d'autres.
- Le contenu d'une organisation reste hors de l'image Docker et hors du dépôt. L'import crée le contenu d'une organisation donnée. Le dépôt n'embarque que l'organisation d'exemple.

### Worker et agrégats

- Le planificateur parcourt les organisations et déclenche rappels et résumés selon le fuseau et l'heure de chacune.
- Les identifiants de jobs, les clés de limite et le préfixe BullMQ portent l'organisation.
- `genererRappels`, `personnesAResumer`, `calculerScores`, `avancementGlobal` et `classement` reçoivent une organisation obligatoire.

### Installation à une seule organisation

- Il n'existe pas de mode séparé. Le script de premier compte admin crée la première organisation. Le sélecteur d'organisation reste masqué tant qu'il n'y en a qu'une. Une association qui auto-héberge tourne ainsi avec une seule organisation.

## Plan de mise en œuvre

Deux lots, dans cet ordre.

| Lot | Chantier |
|---|---|---|
| Commun | Configuration d'organisation en un seul objet, lue dans l'environnement d'abord |
| Commun | Gabarits et sujets de mail rendus avec variables |
| Commun | Espace organisateur sans marque figée, configuration servie par l'API |
| Commun | Contenu de démarrage générique, `content/orga` hors de l'image |
| Multi | Table `Organisation`, clés et contraintes, migration de remplissage |
| Multi | Droits par organisation, contexte, filtre obligatoire sur toutes les requêtes |
| Multi | Comptes globaux à appartenances multiples, cookies et origines |
| Multi | Worker par organisation, préfixes de jobs et de clés |
| Multi | Score et agrégats par organisation |
| Multi | Sélection d'organisation dans l'interface |
| Multi | Preuves de refus croisés entre organisations (invariant 11), revue de sécurité |


Le lot commun a une valeur seul : il rend l'installation mono-association livrable à une autre association.

## Conséquences

- L'ADR 0003 est conservée : les modèles restent dans Git et s'importent par organisation.
- Chaque test d'intégration crée son organisation et la supprime. Les fonctions qui parcouraient toute la base n'ont plus besoin du paramètre `filtre` réservé aux tests.
- L'invariant 11 s'étend : un contrôle d'accès se prouve aussi par le refus avec la session d'une autre organisation.
- Les trois règles de code de l'ADR 0005 figurent dans `CONTRIBUTING.md`.
