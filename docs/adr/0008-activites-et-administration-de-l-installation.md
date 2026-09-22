# ADR 0008 — Activités d'une organisation et administration de l'installation

- **Statut** : acceptée ; réalisée le 22 septembre 2026, en huit PR empilées (#10 à #17)
- **Date** : 2026-09-22
- Complète l'ADR 0006. Remplace son choix du module « organization » de Better Auth et sa réserve sur `TypePerimetre`.

## Contexte

Une association ne porte pas qu'un événement. Elle organise souvent plusieurs manifestations. Elle anime aussi des sections sportives ou culturelles et des instances, comme un conseil d'administration. Ces activités ont le même besoin. Chacune enchaîne des périodes, confie des périmètres à des personnes responsables, et s'appuie sur des fiches méthode et des tâches types à échéance relative.

Le modèle actuel ne le permet pas. L'inventaire du 22 septembre 2026 relève :

- `Edition` est « une année de l'événement » : `annee` est unique dans toute la base, et `editionCourante` comme `periodeEdition` supposent une seule suite d'années. Deux périodes 2027 sont impossibles.
- `Perimetre.slug` et `Fiche.slug` sont uniques dans toute la base. Un périmètre « natation » ne peut pas exister dans deux activités.
- `TypePerimetre` ne connaît que `SPORT` et `POLE`. Le tri des postes, l'appel à candidatures et huit libellés de l'espace organisateur les lisent.
- Aucune table d'appartenance n'existe : `User.isAdmin` est un booléen global. `organisationParDefaut()` a sept points d'appel en production.
- Aucun rôle d'installation n'existe. Un hébergeur qui sert plusieurs organisations ne peut ni créer, ni suspendre, ni exporter une organisation sans accéder à la base.
- Le mot « activité » désigne aujourd'hui le journal (`model Activite`). À l'écran, il n'apparaît que dans « score d'activité ».

Un hébergeur a aussi besoin d'un portail client, d'une facturation et de paliers. L'ADR 0007 interdit tout correctif privé et demande une forme générique dans le dépôt public.

## Décision

### Activité

- Une **activité** est ce qu'une organisation fait dans la durée : un événement, une section sportive ou culturelle, une instance. Elle porte ses périodes, ses périmètres, ses fiches et ses tâches types.
- Sa **nature** fixe le libellé de la période : `EVENEMENT` (édition), `SAISON` (saison), `MANDAT` (mandat). La mécanique ne change pas : rétroplanning, échéances `J-n` depuis le début de la période, affectations, droits.
- Modèle : `Activite { id, organisationId, slug, nom, sigle?, nature, groupes, ordre, archivedAt }`, unique sur `(organisationId, slug)`.
- Relaytour ne gère ni adhésions, ni licences, ni cotisations. Une section y suit sa saison comme un événement suit son édition.

### Période

- Le modèle `Edition` reste le nom technique de la période. `annee` est l'année de début ; `debut` et `fin` couvrent une saison ou un mandat de plusieurs années ; `nom` est libre.
- `Edition.activiteId` est obligatoire. `annee` est unique par activité.

### Groupes de périmètres

- Chaque activité déclare ses **groupes** de périmètres, ordonnés, dans son contenu : clé, libellé, libellé pluriel. Chaque périmètre porte un `groupe`.
- Le gabarit propose `sport` et `pole`. Un conseil d'administration déclare par exemple `commission` et `bureau` ; une section déclare `equipe` et `pole`.
- Le tri des postes, l'appel à candidatures et les libellés de l'espace organisateur lisent les groupes de l'activité. `TypePerimetre` reste en base, rempli, sans lecture.
- `Perimetre.activiteId` est obligatoire et `slug` est unique par activité. `Fiche.activiteId` est obligatoire et `slug` reste unique par organisation, pour laisser la place à des fiches d'organisation.

### Journal

- Le journal `model Activite` devient `model Journal`, et `TypeActivite` devient `TypeJournal`. Une migration écrite à la main renomme la table (`RENAME TABLE`), sans perte. L'enum MySQL est un type de colonne sans objet nommé.
- Le « score d'activité » devient « score de participation » dans la copie et les mails.

### Appartenances

- Un compte reste global. Une table `Appartenance { userId, organisationId, role }`, unique sur `(userId, organisationId)`, porte le rôle `ADMIN` ou `MEMBRE` par organisation.
- Le module « organization » de Better Auth n'est pas retenu : il ouvrirait des routes (invariant 15) et doublerait le flux d'invitation existant.
- `User.isAdmin` reste en base, rempli, sans lecture. Un admin voit toutes les activités de son organisation. Un membre voit les périmètres où il est affecté, activité par activité.
- Inviter une adresse déjà connue d'une autre organisation ajoute une appartenance au compte existant, sans nouveau compte.
- Le nom et l'archivage appartiennent au compte, commun à toutes ses organisations. Un admin ne les modifie pas quand le compte appartient aussi à une autre organisation.
- Le droit de rédaction porte une clé d'organisation : un droit sans périmètre vaut pour toutes les fiches de cette organisation seulement.

### Contexte et droits

- `buildContext` reçoit l'organisation active : l'en-tête `X-Relaytour-Organisation`, sinon l'unique appartenance de la personne. Une organisation suspendue ou archivée ne donne aucun contexte. Une organisation en lecture seule donne le contexte sans le droit d'écrire.
- Trois scopes existent : `connecte` (personne et organisation actives), `admin` (rôle `ADMIN`), `administration` (jeton, voir plus bas).
- `perimetresLisibles` renvoie toujours une liste, sans branche `null` : un admin lit tous les périmètres de son organisation, pas toute la base.
- L'activité se déduit de `editionId` partout où il existe. Les opérations `editions`, `editionCourante`, `perimetres`, `fiches`, `recherche`, `creerEdition`, `creerPerimetre` et `creerFiche` reçoivent un argument `activiteId`.
- Les opérations `activites`, `creerActivite`, `modifierActivite` et `archiverActivite` sont réservées aux admins.
- `organisationParDefaut()` disparaît. Un test vérifie qu'aucun point d'appel ne subsiste.

### Administration de l'installation

- L'**administration de l'installation** regroupe les actions d'un hébergeur. Il crée une organisation, invite son premier admin, la suspend ou l'archive, fixe ses limites et demande son export. Elle n'accède à aucune donnée : ni personne, ni tâche, ni fiche.
- Un script `organisation:creer <slug> "<nom>" [--sigle] [--fuseau] [--domaines] [--limite-activites n] [--limite-periodes n] [--admin adresse --admin-nom "Nom"]` crée une organisation et sa première activité. `admin:creer` reçoit `--organisation`, `edition:creer` reçoit `--organisation` et `--activite`. Sans `--organisation`, une installation qui porte plusieurs organisations refuse de deviner.
- Les scripts s'exécutent sur le serveur, par la personne qui l'exploite : ils ne consultent pas les limites.
- Un jeton `JETON_ADMINISTRATION`, facultatif dans l'environnement, ouvre les mêmes actions par GraphQL. La requête `organisations` renvoie slug, nom, statut, limites et date de création. Elle liste aussi les activités et leurs périodes non archivées (nom, statut, début, fin). Aucune donnée personnelle n'y figure. Les mutations sont `creerOrganisation`, `inviterPremierAdmin`, `modifierOrganisationInstallation` et `demanderExport`.
- Le serveur compare le jeton en temps constant. Une requête porteuse du jeton ignore toute session, et un jeton faux donne une requête anonyme. Aucune route de Better Auth ne s'ouvre. Ces champs ne sont pas publics (invariant 14).
- L'invitation du premier admin refuse un compte archivé : le rétablir lui rendrait l'accès à ses autres organisations.
- L'export (`demanderExport`, script `organisation:exporter`) écrit un fichier JSON versionné dans `EXPORTS_DIR`, volume `exports` de la pile de référence. Le fichier porte les activités, les périodes, les périmètres, les fiches et leur historique, les tâches, les membres et leurs affectations. Il contient des noms et des adresses : il ne transite jamais par l'API et se remet à l'organisation. Sa réimportation fera l'objet d'un chantier ultérieur.
- `Organisation.statut` prend `ACTIVE`, `LECTURE_SEULE`, `SUSPENDUE` ou `ARCHIVEE`. En lecture seule, les membres lisent fiches et périodes, et aucune mutation de données ne passe. L'export par l'administration reste possible dans tous les statuts.

### Limites

- `Organisation.limites` est un objet JSON (`{ activites?: number, periodesOuvertes?: number }`), nul par défaut. Une valeur nulle ou vide signifie qu'aucune limite ne s'applique. Seule l'administration de l'installation le modifie.
- `activites` plafonne le nombre d'activités non archivées. `periodesOuvertes` plafonne le nombre de périodes non archivées, toutes activités confondues. Un hébergeur peut ainsi vendre l'ouverture d'une période plutôt qu'un abonnement au mois ou à l'année.
- `creerActivite`, `creerEdition` et l'import refusent une création au-delà d'une limite. Le message renvoie vers `CONTACT_HEBERGEUR`, adresse ou URL facultative de l'installation. Sans cette variable, le message renvoie vers un admin.
- Une limite ne bloque jamais la lecture. Les périodes archivées, les fiches et l'historique restent consultables, et l'export reste possible. Le plafond porte sur l'ouverture, pas sur la consultation.
- L'organisation garde la main sur les noms et les dates de ses périodes. L'administration de l'installation ne fixe que des nombres.
- Une organisation auto-hébergée n'a aucune limite. Les limites sont une option générique au sens de l'ADR 0007 : le logiciel reste le même pour tout le monde.

### Contenu

- La disposition plate actuelle reste valide. Elle décrit une activité implicite, de nature `EVENEMENT`, au slug de l'organisation, avec les groupes `sport` et `pole`.
- Au premier import d'un dépôt en disposition `activites/`, l'activité d'amorçage `defaut` créée par la migration est retirée si elle est vide et que le dépôt ne la décrit pas.
- Plusieurs activités se déclarent dans `contenu/activites/<slug>/`, avec `activite.yaml` (slug, nom, sigle, nature, groupes, ordre), `perimetres.yaml`, `fiches/` et `taches/`. Les deux dispositions ne se mélangent pas.
- `perimetres.yaml` accepte `groupe`. `type` reste accepté et converti.
- `orga:importer` exige `--organisation <slug>` dès que plusieurs organisations existent, accepte `--activite <slug>` et refuse une activité au-delà des limites. `orga:exporter` filtre par organisation et écrit dans la disposition du dépôt cible.
- `content/exemple` gagne une activité de nature `SAISON`. Le gabarit `relaytour/organisation-modele` documente `activites/` et les natures.

### Espace organisateur

- Les routes prennent l'activité en préfixe (`/:activite/…`). Une adresse sans activité (l'accueil, une adresse d'avant, un lien de mail) mène à la même page de l'activité par défaut : la dernière affichée par le navigateur, sinon la première ouverte. Les liens des mails portent le slug de l'activité.
- L'espace organisateur envoie l'activité affichée dans l'en-tête `X-Relaytour-Activite`. Une requête qui ne précise pas d'activité porte sur celle-ci, sinon sur la première activité ouverte. Changer d'activité ou d'organisation vide le cache du client.
- Un slug d'activité ne peut pas prendre un premier segment d'adresse de l'espace organisateur (`admin`, `fiches`, `perimetres`, `preferences`, `retroplanning`, `connexion`, `api`, `assets`, `graphql`).
- La requête `mesOrganisations`, ouverte à toute personne connectée même sans organisation active, liste ses organisations. Sans organisation active, l'espace organisateur fait choisir l'organisation.
- Sans session, la requête publique `organisation(slug)` sert le thème de l'organisation que le navigateur a mémorisée. Une installation à plusieurs organisations, sans slug connu, sert l'identité d'amorçage de l'environnement : l'écran de connexion n'affiche la marque d'aucune organisation.
- L'organisation active se choisit dans le menu du compte et part dans l'en-tête de chaque requête. Le sélecteur reste masqué avec une seule appartenance. Le sélecteur d'activité reste masqué avec une seule activité.
- Le choix de période lit `editions(activiteId)` et affiche le libellé de la nature. Les groupes de périmètres se rendent depuis `activite.groupes`.
- Une page d'administration liste, crée, modifie et archive les activités. Elle affiche le message de limite atteinte, comme la création d'une période quand `periodesOuvertes` est atteint.
- En lecture seule, l'espace organisateur affiche un bandeau et masque les actions d'écriture.

### Worker

- Un seul préfixe BullMQ existe par installation. Les identifiants des jobs planifiés et des résumés portent l'organisation. Les clés de limite de la connexion restent par adresse : la connexion vaut pour le compte, pas pour une organisation.
- Un mail porte le nom et les couleurs de l'organisation de son job, sinon de l'unique organisation de la personne, sinon de la première organisation de l'installation.
- Une personne membre de plusieurs organisations reçoit le résumé de chacune. La date du dernier résumé se note par organisation (migration `resumes_par_organisation`).
- Un planificateur horaire crée et retire un scheduler `rappels` et un scheduler `resumes` par organisation active, avec son fuseau horaire.
- `genererRappels` et `personnesAResumer` reçoivent une organisation. `periodeEdition` cherche la période précédente dans la même activité. `aujourdhuiParis` devient `aujourdhui(fuseau)`.

### Frontière des extensions

- Le serveur ne charge aucun module tiers. Un module chargé dans le processus formerait une œuvre combinée, et serait la couche réservée que l'ADR 0005 refuse.
- Un besoin d'hébergeur entre dans le dépôt public par l'API d'administration de l'installation, sous forme générique.
- Un portail client, une facturation, un paiement ou des paliers sont des programmes séparés. Ils parlent à Relaytour par cette API et vivent chez chaque hébergeur, sous la licence de son choix.

### Migrations

Cinq migrations additives (invariant 8), dans cet ordre :

1. `activites` : renommage du journal, table `Activite`, table `Appartenance`, `Organisation.statut` et `Organisation.limites`, colonnes `activiteId` et `Perimetre.groupe` nullables.
2. `activites_remplissage` : une activité `EVENEMENT` par organisation, remplissage des clés, `groupe` tiré de `type`, appartenances créées depuis `isAdmin`.
3. `activites_obligatoire` : `activiteId` obligatoire, retrait des trois contraintes uniques globales, contraintes composées. Élargir une contrainte est l'assouplissement prévu par l'ADR 0006, pas un changement de sens.
4. `droits_redaction_organisation` : clé d'organisation du droit de rédaction, remplie depuis le périmètre ou la première appartenance de la personne, puis obligatoire.
5. `resumes_par_organisation` : date du dernier résumé par organisation, colonne JSON nullable.

### Tests

- Chaque test d'intégration crée son organisation, son activité et sa période.
- Un test de refus croisés vérifie chaque opération avec la session d'une autre organisation, puis avec une autre activité et avec une organisation suspendue. Il vérifie aussi le jeton sur une requête de données, le jeton absent sur `creerOrganisation`, la création d'une activité ou d'une période au-delà des limites, et une mutation en lecture seule. L'export par jeton réussit dans tous les statuts.
- Le worker et l'importateur ont leurs preuves. Les rappels d'une organisation n'ont aucun effet sur l'autre. Les dispositions plate et `activites/` s'importent avec leurs groupes.

### Revue de sécurité

La revue du 22 septembre 2026 a parcouru chaque accès par identifiant des résolveurs. Chacun passe par un contrôle d'organisation préalable : `exigerEdition`, `exigerActivite`, `exigerEcriture`, `exigerMembre`, une lecture filtrée par organisation, ou le jeton d'administration. Le fichier `refus-croises.integration.test.ts` appelle chaque requête et chaque mutation qui reçoit un identifiant avec les identifiants d'une autre organisation. Il vérifie le refus et l'absence de tout changement. Un garde-fou du même fichier échoue si une opération nouvelle qui reçoit un identifiant n'entre pas dans la table.

Limites connues, acceptées :

- Une session vaut pour le compte, pas pour une organisation. Les en-têtes `X-Relaytour-Organisation` et `X-Relaytour-Activite` choisissent parmi les appartenances ; ils ne donnent aucun droit.
- La requête publique `organisation(slug)` sert le nom et le thème d'une organisation non archivée à qui connaît son slug. Ces champs sont publics par nature : l'écran de connexion les affiche.
- Le jeton d'administration est un secret unique par installation. Il se change par l'environnement et un redémarrage de l'API.
- Le fichier d'export contient des noms et des adresses. Il reste sur le serveur jusqu'à sa remise à l'organisation.

## Plan de mise en œuvre

Un chantier par session, dans cet ordre.

| Chantier |
|---|
| Schéma, renommage du journal, trois migrations, régénération des contrats |
| Contexte, scopes, droits, filtre sur tous les résolveurs, limites |
| Appartenances, invitations, `organisation:creer`, jeton, compteurs |
| Modèles, importateur, exportateur, validation, groupes, gabarit, exemple |
| Worker, planification, score, clés de limite |
| Espace organisateur : routes, sélecteurs, groupes, libellés de période, page des activités |
| Preuves de refus croisés, worker, importateur, revue de sécurité |
| Documentation, glossaire, notes de version |

## Conséquences

- L'ADR 0006 reste acceptée : son lot multi se réalise ici, avec l'activité en plus.
- Le glossaire gagne activité, nature, groupe, journal, administration de l'installation et limites. L'invariant 18 couvre la clé d'activité.
- Les URL de l'espace organisateur changent. La redirection et le générateur de liens des mails se livrent ensemble.
- Une personne membre de plusieurs organisations garde une seule cadence de résumé, commune à ses organisations : `PreferenceNotification` reste par personne.
- Le retrait de trois index uniques sur une base en service demande une courte interruption. Le remplissage précède toujours l'obligation.
- La décision sur le type générique de périmètre, différée par l'ADR 0006, est prise : les groupes sont du contenu.
- `CONTACT_HEBERGEUR` rejoint `infra/compose/.env.example`, vide par défaut.
- La transmission d'une période à la suivante (feuille de route) devient le premier chantier après celui-ci : elle donne sa valeur à la période.
