# Contribuer à Relaytour

[English summary](CONTRIBUTING.en.md)

Ce fichier fixe les règles du dépôt : décisions arrêtées, invariants techniques, style d'écriture, glossaire et pièges connus. Il doit rester lisible sans autre contexte.

## Paquets

- `packages/server` : API GraphQL (Express 5, Apollo Server 5, Pothos, un seul schéma), connexion Better Auth et worker BullMQ.
- `packages/orga` : espace organisateur, SPA React 19 + Vite + React Router 7 + Apollo Client 4 + antd 6. Types GraphQL générés dans `src/gql/`.
- `packages/tokens` : modèle de thème, thème par défaut et thème alternatif de Relaytour, contraste. Le serveur le lit pour valider et compléter le thème d'une organisation ; l'espace organisateur le lit pour le thème de repli (ADR 0006).
- `packages/commun` : règles pures partagées par le serveur et l'espace organisateur, comme le rapprochement des personnes d'un import (ADR 0042).
- `content/exemple-en` : la même organisation d'exemple en anglais, avec les mêmes identifiants. Les captures anglaises du site l'utilisent.
- `content/exemple` : organisation d'exemple, fictive et anonyme (`organisation.yaml`, deux activités, leurs périmètres, fiches et tâches types). Le contenu réel d'une organisation vit hors du dépôt (voir son README).
- `packages/database` : Prisma 6 sur MariaDB 11.8. Le client généré (`src/generated/`) n'est jamais commité.
- `infra/` : déploiement de référence minimal (Compose, Caddyfile d'exemple, étapes). L'exploitation réelle vit hors du dépôt (ADR 0007).
- `outils/verifier-licences.mjs` et `outils/verifier-publication.mjs` : contrôles de CI sur les licences des dépendances et sur l'absence de traces privées.
- `outils/versionner.mjs` et `notes/` : journal des changements et publication des versions (`noter`, `valider`, `compiler`, `publier`, `release`).
- `docs/adr/` : décisions d'architecture. `docs/design-system.md` : identité, matériau et composants.
- `site/` : site de présentation publié sur GitHub Pages. `outils/site.mjs` y écrit les jetons, les palettes et les polices ; la CI vérifie qu'il est à jour.
- `site/captures/` et `site/captures/mobile/` : les écrans des modes d'emploi, en version ordinateur et en version téléphone. `outils/captures.mjs` produit les deux. La version téléphone se prend dans l'application installée sur un simulateur iOS (macOS, Xcode et `cwebp`) : le script relaie l'espace organisateur à l'adresse de `--origine` et pilote l'application par ce relais. Le bouton « Ordinateur / Téléphone » du site (`site/bascule.js`) passe de l'une à l'autre. Les captures anglaises vivent dans `site/en/captures/` : `--langue en` les prend sur une instance au contenu `content/exemple-en`.
- `docs/feuille-de-route.md` et `docs/publication.md` : évolutions envisagées, liste de publication.

## Commandes

```bash
yarn setup        # installation, Docker, client Prisma, migrations, contrats
yarn dev          # API (4400), worker et espace organisateur (5305)
yarn workspace @relaytour/server admin:creer adresse@exemple.org "Prénom Nom"   # premier compte admin
yarn workspace @relaytour/server edition:creer 2027 "Rencontres 2027" 2027-06-05 2027-06-06   # première édition
yarn workspace @relaytour/server organisation:creer rencontres "Les Rencontres" --admin adresse@exemple.org --admin-nom "Prénom Nom"   # autre organisation (ADR 0008)
yarn workspace @relaytour/server organisation:exporter rencontres --dossier /tmp/exports   # export complet d'une organisation
yarn workspace @relaytour/server planification:lancer rappels|resumes|synchro|purge|espace-fichiers|export-fiches|acces-fournisseur [--organisation slug]   # lancer une tâche planifiée tout de suite ; synchro réaligne les planifications, purge supprime les demandes des périodes archivées, espace-fichiers renouvelle les accès et réconcilie l'export des fiches, acces-fournisseur vérifie les accès chez le fournisseur
yarn check        # lint, types, build
yarn test         # tests unitaires
yarn workspace @relaytour/server test:integration   # base locale, worker arrêté
yarn workspace @relaytour/server orga:exporter      # écrit tout le contenu de l'organisation dans le dossier de contenu (ADR 0009)
yarn workspace @relaytour/server equipe:importer --fichier equipe.yaml --activite rencontres --edition 2027 --simulation   # équipe d'une période (ADR 0013)
yarn codegen      # contrats commités
yarn workspace @relaytour/orga langues:extraire   # catalogues de traduction, après un texte ajouté ou modifié (ADR 0047)
yarn workspace @relaytour/server langues:extraire   # catalogues du serveur (mails, notifications, erreurs), extraits puis compilés
node outils/langues.mjs etat   # taux de traduction de chaque langue ; une langue se propose à 90 % (ADR 0047)
node outils/site.mjs   # site de présentation, après un changement des jetons
node outils/captures.mjs --origine http://localhost:5305   # captures du site, avec le contenu d'exemple et un compte fictif d'admin de l'organisation
node outils/captures.mjs --compte referent   # écrans d'un autre rôle : referent ou admin-activite, avec un compte de ce rôle
node outils/captures.mjs --seulement editions,equipe   # quelques écrans seulement
node outils/captures.mjs --compte referent --organisation rencontres-de-la-vallee   # un compte de plusieurs organisations : l'organisation à photographier
node outils/captures.mjs --compte admin-activite --appel <jeton> --espace <jeton>   # avec la page d'un appel à bénévoles et un espace bénévole, jetons copiés depuis l'écran « Bénévoles »
node outils/captures.mjs --largeur 375 --hauteur 812 --mobile --sortie /tmp/captures-mobile   # mêmes écrans dans un navigateur de téléphone, pour un contrôle rapide
node outils/captures.mjs --simulateur Relaytour --amont http://localhost:4571 --sortie site/captures/mobile   # captures téléphone du site, prises dans l'application installée sur un simulateur iOS
node outils/captures.mjs --langue en --origine http://localhost:5305   # captures anglaises (site/en/captures/), sur une instance au contenu content/exemple-en
yarn versionner valider
yarn versionner compiler   # journaux commités
yarn versionner publier --simulation   # numéro de la prochaine version, sans rien écrire
yarn versionner publier    # prépare la version : numéros, rattachement des notes, journaux
yarn versionner release --version 0.4.0   # texte de la release d'une version
yarn test:outils   # tests des outils du dépôt
```

## Décisions arrêtées

Ces décisions ne se rouvrent pas sans raison nouvelle.

| Sujet | Décision | Référence |
|---|---|---|
| Socle | Yarn 4, Node 24, tsup ESM, un seul schéma GraphQL sans gateway, abonnements compris | ADR 0001, 0017 |
| Connexion | Better Auth, code ou lien reçu par mail, inscription fermée (invitation par un admin, ou demande acceptée par un admin). Un code refusé reçoit la même réponse pour toute adresse ; une adresse reçoit au plus cinq codes par quart d'heure et vingt par jour, et le jeton de session ne voyage que dans le cookie, jamais dans le corps d'une réponse. | ADR 0002, 0015, 0035 |
| Modèles de l'espace organisateur | Fiches et tâches types dans un dossier de contenu propre à l'organisation, hors dépôt, importées en base par édition | ADR 0003 |
| Source de vérité du contenu | L'application porte le contenu d'une organisation : identité, activités, périmètres, fiches, tâches types, images. Le dossier de contenu en est l'archive et le point de départ. L'export est iso ; un import refuse d'écraser une modification faite dans l'application depuis le dernier export, sauf avec `--forcer`. | ADR 0009 |
| Identité et images | Une activité surcharge le contact, la page d'équipe, le logo, les couleurs et le fond de son organisation. Les images vivent en base (PNG obligatoire, SVG facultatif sans script) et se servent sous `/medias/`. Relaytour reste en signature, avec le lien vers le code source (`CODE_SOURCE_URL`). | ADR 0009 |
| Hébergement | Déploiement de référence : une pile Compose sur un VPS. Le dépôt produit une image et ne déploie rien ; l'exploitation vit dans un dépôt séparé qui consomme l'image. Aucun correctif privé. | ADR 0004, 0007 |
| Contenu d'une organisation | Un dépôt par organisation, créé depuis `relaytour/organisation-modele`, rattaché par un chemin (`CONTENU_ORGA`), un volume ou la CI de l'organisation | ADR 0003, 0007 |
| Dépendances | Licences compatibles avec l'AGPL seulement, liste blanche dans `outils/verifier-licences.mjs`. Valkey et non Redis. | ADR 0007 |
| Licence | AGPL-3.0, un seul code, multi-organisation comprise. Le contenu d'une organisation n'entre jamais dans le dépôt. | ADR 0005, 0006, 0008 |
| Activités et administration de l'installation | Une organisation porte une ou plusieurs activités (événement, saison, mandat), chacune avec ses périodes, ses périmètres rangés en groupes déclarés dans le contenu, ses fiches et ses tâches types. Les appartenances sont par organisation. L'administration de l'installation (créer, suspendre, limiter, exporter une organisation) passe par un script ou un jeton. Le jeton ne lit aucune donnée des membres par l'API ; l'export qu'il demande contient leurs noms et leurs adresses, et il nomme le premier admin d'une organisation qui n'en a pas. | ADR 0008, 0035 |
| Administration de l'équipe | Une équipe se saisit dans l'espace organisateur, ou s'importe par la commande `equipe-importer` dans le conteneur, additive et sans mail par défaut. Le jeton de l'hébergeur n'invite ni n'affecte les membres d'une équipe : il ne nomme que le premier admin d'une organisation qui n'en a pas. `JETON_ADMINISTRATION_LOCAL`, vrai par défaut, le limite aux requêtes locales : sans en-tête de proxy, depuis une adresse locale ou privée. Dix jetons refusés en quinze minutes ferment l'API d'administration à l'adresse. | ADR 0013, 0035 |
| Extensions | Aucun chargeur de modules dans le serveur. Un besoin d'hébergeur entre par l'API d'administration de l'installation ; portail client, paiement et paliers restent chez l'hébergeur. | ADR 0007, 0008 |
| Configuration d'organisation | Un seul objet (`packages/server/src/lib/organisation.ts`), lu dans la ligne `Organisation` en base, sinon dans les variables d'amorçage. `organisation.yaml` du dépôt d'organisation la porte ; l'import la met à jour, et les admins la modifient dans l'espace organisateur (ADR 0009). L'expéditeur des mails et l'origine de l'espace organisateur restent dans l'environnement. | ADR 0006 |
| Rôles V1 | Admin de l'organisation, admin d'activité et référent·e. Une personne voit les activités qu'elle administre ou où elle est affectée, et y consulte chaque périmètre. Elle découvre en plus les activités où elle est rattachée ou a un souhait : la page « Tous les périmètres » seulement. Une activité où elle n'a aucun lien n'existe pas pour elle, même ouverte aux souhaits. Le rôle bénévole viendra après la V1. | ADR 0006, 0008, 0010, 0012, 0014, 0045 |
| Personnes d'une activité | L'admin de l'organisation lit l'annuaire. Un admin d'activité lit l'équipe de ses activités seulement, noms et adresses, et n'agit que sur elle. Il y fait entrer une personne par son adresse, dans l'une de ses activités, avec ou sans périmètre : le serveur crée le compte ou rattache le compte existant, sans dire lequel. Chaque entrée dans une activité (affectation, invitation, demande acceptée, import) y rattache la personne. Un admin de l'activité retire le rattachement d'une personne sans affectation en cours ni rôle d'admin. L'adresse d'une personne se lit par elle-même, par l'admin de l'organisation et par les admins de ses activités, ou dans un organigramme avec son accord (ADR 0036). | `packages/server/src/lib/appartenances.ts`, `packages/server/src/lib/rattachements.ts`, ADR 0018, 0019, 0045 |
| Admins | Un admin d'activité lit le nom des admins de l'organisation et n'agit jamais sur leur compte. Il nomme et retire les admins de ses activités, parmi les personnes de ses équipes, sans retirer son propre rôle. Seul un admin de l'organisation nomme un admin de l'organisation, depuis l'écran « Admins ». | `packages/server/src/lib/appartenances.ts`, ADR 0019 |
| Score de participation | Visible par la personne concernée et par les admins seulement. Calculé à partir de l'état actuel (une tâche rouverte perd ses points) : tâche réalisée 3 points (+1 à temps, crédités à la personne réalisatrice indiquée, sinon à celle qui a coché), tâche créée 1, fiche créée 3, fiche modifiée 2 une fois par jour. Un palmarès public se décide en fin d'édition. Barème validé le 16 septembre 2026. | `packages/server/src/lib/score.ts` |
| Tâches | Une tâche ne se supprime pas, elle s'abandonne. Une personne qui écrit dans un périmètre assigne une tâche à toute personne affectée à ce périmètre pour la période, ou l'en retire (ADR 0028). Modifier la tâche d'une autre personne exige une confirmation et la prévient par mail. Une modification porte la version lue, et un changement de statut le statut vu : le serveur refuse d'écraser ce qu'une autre personne a écrit entre-temps (`CONFLIT_VERSION`), et l'interface propose de recharger ou d'écraser. Qui a coché et qui a réalisé une tâche n'est visible que par la personne qui a coché et par les admins : un conflit de statut, une notification et un mail qui annoncent un passage à « faite » ne nomment donc personne. | `packages/server/src/schema/taches.ts`, ADR 0028 |
| Commentaires | Une tâche porte un fil : ses commentaires et les événements de son journal. Un commentaire est un texte simple, daté et signé, de 4 000 caractères au plus. Une personne lit le fil quand elle lit le périmètre de la tâche ; une personne en consultation ne le lit pas. Une personne qui écrit dans le périmètre commente. L'auteur modifie et supprime son commentaire, un admin de l'activité supprime tout commentaire. Un commentaire prévient les personnes assignées dans l'application et en push, sans mail immédiat, et sa notification ne porte jamais son texte. Le fil se lit dans une requête à part (`filTache`), le nombre de commentaires aussi (`commentairesDeLaPeriode`). Un commentaire vit en base seulement, entre dans l'export complet, et ne donne aucun point. | `packages/server/src/schema/commentaires.ts`, ADR 0029 |
| Phases | Une activité déclare ses phases dans son contenu, comme ses groupes : un libellé et un dernier jour, compté depuis le premier jour de la période. La dernière phase n'a pas de borne. Une tâche ne porte aucune phase : elle s'y range par son échéance, dans l'espace organisateur. Une tâche sans échéance n'appartient à aucune phase. Les admins de l'activité règlent les phases dans l'écran « Activités ». Une activité qui ne déclare rien garde quatre phases par défaut. La tâche ne reçoit ni étiquette libre, ni champ de priorité. | `packages/server/src/lib/phases.ts`, `packages/orga/src/lib/regroupement.ts`, ADR 0025 |
| Tâches partagées | Une tâche d'un périmètre se décline dans d'autres périmètres de son activité : chaque périmètre cible reçoit une déclinaison, avec son statut, ses personnes assignées et son échéance. Une personne qui écrit dans le périmètre d'origine la propose ; une personne qui écrit dans le périmètre cible l'accepte ou la refuse. Un admin de l'activité l'ajoute sans accord, même après un refus, et lit l'historique de chaque accord. Une déclinaison qui n'est pas acceptée ne compte ni dans les tâches du périmètre, ni dans son avancement, ni dans les rappels, ni dans le score. Une déclinaison cite la fiche de sa tâche partagée : une fiche du périmètre d'origine devient connexe pour la cible une fois la déclinaison acceptée (ADR 0039). Le statut d'une tâche partagée reste manuel : l'abandonner ou la modifier ne change aucune déclinaison. Le lien garde un seul niveau, et un import ne le déplace jamais. Une déclinaison ne donne aucun point de création, et ses notifications restent dans l'application. | `packages/server/src/lib/declinaisons.ts`, `packages/server/src/schema/taches.ts`, ADR 0026 |
| Fiches | Une version ne se modifie ni ne se supprime ; restaurer crée une nouvelle version. L'historique est réservé aux admins. Rédiger exige un droit accordé par un admin (un périmètre, ou toutes les fiches). Un enregistrement porte la version lue avant la rédaction : le serveur refuse d'écraser une version écrite entre-temps (`CONFLIT_VERSION`), et l'éditeur garde le texte. L'éditeur garde aussi un brouillon dans le navigateur, effacé à l'enregistrement, à l'abandon et à la déconnexion. Une fiche de périmètre se lit, sans s'y modifier, dans les périmètres de sa liste « Concerne aussi », dans ceux des groupes de cette liste et dans ceux d'une déclinaison acceptée qui la cite. Un périmètre cible masque une fiche connexe de sa liste, sans la rendre illisible. | `packages/server/src/schema/fiches.ts`, `packages/server/src/lib/fiches-connexes.ts`, ADR 0039 |
| Notifications | Une notification ne stocke que des identifiants ; son texte se compose à la lecture. Mail immédiat : modification d'une tâche assignée, rappels à 7 jours et à la veille, retards. Mail d'équipe regroupé par fenêtre de dix minutes : nouvelle affectation, nomination comme admin d'une activité ou de l'organisation ; rien pour un souhait, un contact principal ou un retrait (ADR 0012). Une demande reçue prévient les admins de l'activité dans l'application, une fois par jour au plus (ADR 0015), et par un mail regroupé par fenêtre d'une heure, qui porte un nombre et aucun nom (ADR 0016). Les autres référentes et référents d'un périmètre apprennent dans l'application, sans mail, ce qu'une personne fait sur ses tâches et ses fiches ; un passage à « faite » ne nomme personne, et une clé par tranche de dix minutes évite le bruit. Un commentaire prévient les personnes assignées à sa tâche à chaque fois, dans l'application et en push (ADR 0029). Une fiche connexe prévient les référentes et référents du périmètre cible dans l'application, une fois par fiche et par tranche de dix minutes (ADR 0039). Le reste passe par le résumé (hebdomadaire par défaut, le lundi à 7 h, valeur validée le 16 septembre 2026). Le worker vérifie les préférences au moment de l'envoi. Les préférences se règlent dans chaque organisation (ADR 0032). Chaque notification a un niveau : référent·e dans la cloche, admin d'activité ou de l'organisation dans l'écran « Notifications d'admin » (ADR 0033). La cloche range par activité, l'écran des admins par activité puis par périmètre. Une action ne prévient jamais son auteur, et une invitation refusée ou expirée ne prévient personne (ADR 0030). Un mail nomme l'organisation puis l'activité dans son sujet (« TIMM · Rencontres : … »), et chaque lien de mail désigne son organisation. | `packages/server/src/lib/notifications.ts`, `src/jobs/planification.ts`, `src/lib/composition-notifications.ts`, `src/lib/notifications-admin.ts`, ADR 0032, 0033 |
| Accès aux périmètres | Consultation (tâches, avancement, équipe, sans fiche ni écriture) pour toute personne qui voit l'activité du périmètre ; lecture (tâches et fiches) pour toute personne affectée au périmètre dans au moins une édition, qui lit aussi ses fiches connexes (ADR 0039) ; écriture pour les personnes affectées à l'édition concernée, tant qu'elle n'est pas archivée ; tout pour les admins de l'activité du périmètre. Une activité invisible vaut une activité d'une autre organisation. | `packages/server/src/lib/droits.ts`, ADR 0010, 0014 |
| Contact principal | Un périmètre a au plus un contact principal par édition, désigné par un admin de son activité parmi les personnes affectées. C'est une information : le contact principal a les mêmes droits que les autres référentes et référents. | ADR 0011 |
| Organigramme | Chaque activité a une page « Organigramme » : le contact de l'activité, ses admins, puis le contact principal et les référentes et référents de chaque périmètre pour la période en cours. Une personne en découverte n'y lit que les admins et les contacts principaux. Une adresse personnelle s'y affiche seulement pour une personne qui voit l'activité, avec deux accords : le réglage de l'activité (aucune, admins et contacts principaux, ou toute l'équipe des périmètres) et l'accord de la personne, donné par organisation dans ses préférences et fermé par défaut. | `packages/server/src/schema/organigramme.ts`, ADR 0036 |
| Demandes | Une demande porte le nom et l'adresse d'une personne qui veut rejoindre l'équipe d'une période. Une personne affectée à un périmètre la propose pour ce périmètre, ou la personne la dépose elle-même par le formulaire public, qu'un admin ouvre et règle par activité. Aucun compte n'existe avant qu'un admin de l'activité l'accepte : la personne est alors rattachée à l'activité, l'admin choisit ses affectations, et les autres périmètres demandés deviennent des souhaits. Une demande s'accepte sans périmètre. Les admins de l'activité lisent les demandes ; la personne qui propose ne relit que ses propositions, sans adresse. Une demande ne donne aucun accès et n'est jamais exportée dans Git. Une purge planifiée supprime les demandes d'une période archivée. | `packages/server/src/lib/demandes.ts`, ADR 0015, 0016 |
| Souhaits | Un souhait note l'intérêt d'une personne pour un périmètre d'une édition. Un admin le note, ou la personne le formule dans « Tous les périmètres » quand l'activité est ouverte aux souhaits. Il est visible des admins et de la personne concernée, ne donne accès ni aux tâches ni aux fiches, et n'est jamais exporté dans Git. Il est satisfait quand l'affectation correspondante existe. | `packages/server/src/lib/souhaits.ts`, ADR 0012 |
| Messages | Un admin prépare un message dans l'espace organisateur, à partir d'un modèle, puis l'envoie depuis sa propre messagerie : l'application n'envoie rien. Un message d'une activité s'adresse à des personnes de son équipe ; un message de l'annuaire, écrit par un admin de l'organisation, à des membres de l'organisation. Le serveur vérifie chaque destinataire et garde le message, ses destinataires (des comptes, jamais des adresses) et le statut que l'auteur déclare : en cours, envoyé ou annulé. Les admins de l'activité relisent ses messages dans l'écran « Messages », les admins de l'organisation relisent tout dans l'annuaire. Un message n'est jamais exporté dans Git. L'admin choisit la messagerie qui s'ouvre : celle de son appareil (`mailto:`), une messagerie en ligne ou une application. Ce choix se garde dans son navigateur, jamais sur le serveur, et une application ne s'enregistre qu'après un essai confirmé. Les adresses copiées se séparent par une virgule, ou par un point-virgule pour Outlook ; l'admin change ce signe à côté des boutons de copie. | `packages/server/src/schema/messages.ts`, `packages/orga/src/lib/messages.ts`, `packages/orga/src/lib/messagerie.ts`, ADR 0020, 0022, 0027 |
| Flux des changements | Une écriture publie un signal, sans donnée : une entité et des identifiants. Le serveur le pousse en SSE sur `/graphql` aux personnes qui peuvent lire l'objet, et le navigateur relit ses écrans par GraphQL. Le flux est un accélérateur : l'application fonctionne sans lui, et le pub/sub de Valkey n'est pas durable. Une mutation nouvelle publie son signal, et une entité nouvelle nomme les requêtes à relire dans `packages/orga/src/lib/flux.ts`. L'espace organisateur tient le flux ouvert sur un onglet visible et en ligne ; sa relecture périodique passe alors d'une minute à cinq. | `packages/server/src/lib/flux.ts`, ADR 0017 |
| Mobile et application installable | Chaque écran reste utilisable à 375 pixels de large ; les écrans des référentes et référents sont adaptés au téléphone. L'espace organisateur s'installe sur l'écran d'accueil avec l'identité de l'organisation : le serveur sert un manifest par organisation sous `/medias/`. Le service worker garde la coquille de l'application et aucune donnée. Sans réseau, l'application affiche un écran « Hors connexion ». Une nouvelle version s'annonce par un avis, sans rechargement automatique. | `docs/design-system.md`, ADR 0023 |
| Notifications push | Canal facultatif, ouvert par les trois variables VAPID de l'exploitant. Une personne l'active par appareil, depuis ses préférences, et en règle les familles dans chaque organisation (ADR 0032) ; la déconnexion retire l'abonnement de l'appareil. Une notification push reprend une notification de l'application adressée à la personne : tâche assignée ou retirée, modification d'une de ses tâches, commentaire sur une de ses tâches, échéance, retard, demande reçue. Les annonces faites à tout un périmètre n'y passent pas. La file `push` ne porte que l'identifiant de la notification, et le worker relit les préférences à l'envoi. L'adresse d'un abonnement désigne le service de push d'un navigateur connu, jamais une autre adresse. | `packages/server/src/lib/push.ts`, `src/jobs/processors/push.processor.ts`, ADR 0024 |
| Agenda | Chaque activité a un agenda global, géré par ses admins, et chaque périmètre a le sien, écrit par les personnes qui écrivent dans ce périmètre. Une réunion ne se supprime pas, elle s'annule ; elle lie jusqu'à vingt tâches de la période. Une convocation vise un compte de l'équipe, jamais une adresse : l'application envoie un mail avec un fichier iCalendar, et la personne répond dans l'application. En consultation, une réunion de périmètre ne montre que son titre et son horaire. Une personne retirée d'un périmètre quitte ses réunions à venir. Un abonnement iCalendar est une adresse secrète en lecture seule, dont le serveur garde l'empreinte et revérifie les droits à chaque lecture. | `packages/server/src/schema/agenda.ts`, ADR 0037 |
| Appels à bénévoles | Une séquence fixe les renforts qu'elle recherche et des consignes publiques. Un admin de l'activité ouvre un appel sur toute la période. Une personne qui écrit dans un périmètre l'ouvre sur ce périmètre ou sur une de ses séquences. L'adresse secrète d'un appel se recalcule à la demande : le serveur garde un sel et une empreinte, jamais le jeton. Le formulaire public de l'équipe affiche l'adresse de l'appel ouvert sur toute la période (ADR 0046). Le dépôt n'envoie aucun mail et ne dit pas si l'adresse a déjà candidaté. Une séquence dont les renforts sont atteints reçoit les choix suivants en liste d'attente. L'équipe accepte chaque séquence, et la fiche bénévole reçoit une place à confirmer. Une fiche joignable (une adresse et l'option « Prévenir par mail ») reçoit un seul mail à sa première place, avec un lien personnel qui ne change pas. La personne confirme par un bouton de son espace : ouvrir le lien ne confirme rien. La vue « Répartition » du programme place les bénévoles disponibles. Les candidatures d'une période disparaissent à son archivage. | `packages/server/src/schema/appels.ts`, `packages/server/src/schema/candidature-publique.ts`, `packages/server/src/schema/espace-benevole.ts`, ADR 0041, 0046 |
| Import de bénévoles | Un admin de l'activité importe une liste pour tout le programme ; une personne qui écrit dans un périmètre l'importe pour ce périmètre. Le navigateur lit le fichier (CSV ou XLSX, 2 Mo et 5 000 lignes au plus), et seules les colonnes associées partent vers le serveur. Une colonne de genre, de santé ou de paiement reste ignorée. Une correspondance d'import garde les en-têtes et les associations, jamais de donnée personnelle. Le serveur revalide tout, simule avant d'écrire et écrit par lots de 500 personnes. Un identifiant externe rend l'import rejouable. Le mode « à répartir » crée des candidatures dans un appel sans adresse publique, un par source ; le mode « places directes » crée des places à confirmer. Aucun mail ne part à l'import. Un non-admin ne se rapproche que des fiches dont il lit les coordonnées. Seuls les admins de l'activité fusionnent des fiches ; le lien personnel et la confirmation suivent l'adresse gardée. | `packages/server/src/schema/import-benevoles.ts`, `packages/commun/src/rapprochement.ts`, ADR 0042 |
| Fournisseur cloud | Facultatif, ouvert par l'exploitant (clé de chiffrement et application du fournisseur). SharePoint, Google Drive, Dropbox et Nextcloud se connectent par le compte d'un admin ; un compte Dropbox d'équipe se parcourt depuis l'espace de l'équipe, qui contient le dossier du membre ; un Nextcloud se désigne par son adresse, parmi les hôtes que l'exploitant admet (`NEXTCLOUD_HOTES`), et le serveur n'y joint jamais une adresse privée sauf hôte nommé ; Google Drive aussi par un compte de service dont l'organisation dépose la clé, chiffrée en base, et qui n'écrit que dans un Drive partagé. Un changement de fournisseur efface le dossier d'export de l'ancien fournisseur. `espace-fichiers` reste le nom technique du code et des adresses. Un admin de l'organisation connecte le fournisseur cloud de l'association avec son compte, puis lie des dossiers à toute l'activité ou à une liste de périmètres et de groupes, et modifie ces lecteurs ensuite ; une bibliothèque entière ne se lie pas, et un dossier se lie une seule fois par activité. Une modification garde un périmètre archivé ou un groupe vide que le lien nomme déjà. Un dossier lié se lit comme les fiches de ses périmètres et des périmètres non archivés de ses groupes, ou comme les fiches communes ; un partage de fiche ne l'ouvre pas. Relaytour lit le fournisseur et relaie un document à la demande, sans copie ; un élément s'adresse depuis son dossier lié par un chemin de noms qui n'en sort pas. La liseuse affiche un PDF, une image, un texte ou du Markdown, et ne rend jamais le HTML ni le SVG. Le jeton de rafraîchissement est chiffré en base et ne sort jamais du serveur. Une personne qui rédige une fiche y lie des dossiers ou des fichiers d'un dossier lié qui sert son périmètre, directement, par son groupe ou pour toute l'activité, trente au plus ; ces documents liés vivent en base, et un admin de l'organisation ouvre un document à toutes les personnes qui lisent sa fiche, partage compris, sans ouvrir le reste de son dossier ni le dossier lié entier ; ils restent hors du Markdown. Après le déplacement d'une fiche ou un changement des lecteurs du dossier, Relaytour masque et referme les documents d'un dossier qui ne sert plus la fiche. Un admin de l'organisation choisit où Relaytour crée le dossier « Fiches Relaytour » ; ce dossier, ses parents et ses sous-dossiers ne se lient jamais. Relaytour y exporte les fiches en Markdown, toujours dans ce sens, une minute après une modification puis chaque nuit, où il renouvelle aussi l'accès ; il ne réécrit pas une fiche inchangée, retire une fiche archivée ou déplacée, réécrit et signale une fiche modifiée à la main, et n'exporte pas une fiche qui porte une coordonnée personnelle. Le dossier d'export se relit chez le fournisseur à chaque contrôle : déplacé dans un dossier lié, il ne reçoit plus d'export et ce dossier ne le montre pas. Les contrôles comparent les identifiants quel que soit l'emplacement, et les noms sans tenir compte de la casse. Un admin de l'organisation active la vérification des accès, par une nouvelle connexion chez SharePoint et Dropbox. Relaytour lit alors l'annuaire et les groupes du fournisseur, et n'y cherche que les adresses des membres attendus par un dossier lié : tous les membres de ses périmètres pour la période, ou les contacts principaux seulement. Il lit les droits du dossier, puis range chaque personne par équipe ; des droits illisibles laissent la personne « Inconnu ». Il garde des autres comptes un nom, sans adresse. La vérification se lance à la demande, après un changement des lecteurs ou d'une équipe, et chaque nuit. Avec la gestion des accès, un dossier lié propose un partage du dossier ou l'entrée dans un groupe qui a déjà un droit sur lui : Relaytour propose les ajouts et les retraits, un admin de l'organisation les applique ou les écarte, et un réglage du dossier applique les ajouts sans attendre. Relaytour ne retire que les droits qu'il a lui-même créés, tels qu'il les a créés ; un retrait attend toujours un admin. Relaytour oublie un droit modifié à la main, et il ne sort pas d'un groupe une personne qu'un autre dossier du groupe attend. Un admin ne délie un dossier qui porte des droits créés qu'en acceptant de les laisser sans suivi. Relaytour cherche les comptes dans l'annuaire de SharePoint et de Nextcloud ; chez Google Drive et Dropbox, il compare les adresses. Chez Nextcloud, Relaytour ne partage qu'avec un compte et ne touche jamais au groupe `admin`. Chez Dropbox, il ne partage que le dossier lié lui-même. Un admin active la vérification sans reconnexion chez Google Drive et Nextcloud. La vérification supprime les comptes des anciens membres. Un admin de l'organisation importe les fiches que l'association range déjà chez le fournisseur, un dossier source par périmètre, en simulation d'abord : Markdown et texte tels quels, Word converti en Markdown ; l'import suit les règles de `orga:importer`, et une version importée porte la source `ESPACE_FICHIERS`, que l'import du dépôt ne remplace pas. | `packages/server/src/espace-fichiers/`, `packages/server/src/schema/ressources-fiche.ts`, `packages/server/src/schema/acces-fournisseur.ts`, ADR 0038, 0043, 0044 |

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
9. **Les contrats générés sont commités et vérifiés en CI** : `packages/server/schema.graphql`, `packages/server/src/courriel/gabarits.genere.ts`, `packages/orga/src/gql/`, `packages/orga/src/locales/`, `packages/server/src/locales/`, `notes/notes-de-version.*.json`.
10. **L'image ne contient pas le code source** : cartes sans `sourcesContent`, `.dockerignore` sans `.env`.
11. **Un contrôle d'accès se prouve par le refus** (requête sans session, avec la session d'un autre périmètre), pas par la réussite avec la bonne session.
12. **`env.ts` valide l'environnement à l'import.** Les modules que charge le schéma importent la file et la connexion Redis de façon paresseuse, sinon `yarn codegen` échoue sans `.env`.
13. **Le schéma GraphQL n'importe jamais `auth.ts`.** Better Auth charge `env.ts` : le serveur résout la session, puis la passe à `buildContext`.
14. **Une requête lue sans session ne demande que des champs publics.** Un champ protégé dans la même requête transforme la réponse en erreur.
15. **Toute nouvelle route de Better Auth s'ouvre explicitement** dans `ROUTES_OUVERTES` (`packages/server/src/auth.ts`). Les autres répondent 404.
16. **Aucune coordonnée personnelle dans un dossier de contenu.** La validation (`orga:valider`) et l'export refusent les numéros et les adresses qui ne sont pas des adresses de rôle : hors des `domainesCourrielAutorises` de l'organisation, et hors de ses `adressesRoleAutorisees`. Un domaine de messagerie grand public n'est jamais un domaine de rôle (ADR 0009) ; les contacts s'écrivent sous forme de rôles.
17. **Tout appel à Redis sur le chemin d'une requête est borné dans le temps** (`lib/delai.ts`). La connexion de BullMQ attend Redis sans limite : la première CI, sans Redis, a bloqué deux tests jusqu'à leur délai de 30 s.

18. **Aucune nouvelle contrainte d'unicité globale sans clé d'organisation ou d'activité, aucune nouvelle requête qui parcourt toute la base sans filtre, aucune marque en dur** (ADR 0005, 0006 et 0008).

## Écriture

- **Style neutre** pour tout texte : copie, mails, docs, commits, PR. Chaque phrase a un sujet et un verbe conjugué, une idée par phrase, 25 mots au plus, « vous » pour l'utilisateur, « nous » pour l'organisation, pas de « on », pas de tiret d'incise.
- **Écriture inclusive obligatoire**, sur toutes les éditions : doublet dans une phrase (« les référentes et référents »), point médian seulement là où la place manque (« Devenir référent·e »), un seul point médian par mot, jamais de point simple. Préférer une tournure épicène quand elle existe.
- Commentaires et messages de commit en français, commits conventionnels (`feat(server):`, `fix(orga):`).
- Le dépôt garde le français comme langue de travail : code, identifiants, commentaires, ADR et titres de commit. Les issues et les PR s'écrivent en français ou en anglais (ADR 0047).

### Glossaire

Un seul mot par notion. La colonne « Anglais » fixe le terme du catalogue anglais et de la documentation anglaise (ADR 0047).

| Mot | Anglais | Sens |
|---|---|---|
| organisation | organization | L'association ou le collectif qui utilise une installation de Relaytour. Elle porte une ou plusieurs activités. Une installation peut porter plusieurs organisations (ADR 0008). |
| activité | activity | Ce qu'une organisation fait dans la durée : un événement, une section, une instance. Une activité porte ses périodes, ses périmètres, ses fiches et ses tâches types (ADR 0008). |
| nature | kind | Événement, saison ou mandat. La nature d'une activité fixe le libellé de sa période. |
| édition | edition | Une période d'une activité : l'édition d'un événement (2025, 2027), la saison d'une section, le mandat d'une instance. `Edition` reste le nom technique. |
| périmètre | area | Une sous-partie d'une activité (un sport, un pôle, une commission…), rangée dans un groupe. |
| groupe | group | Catégorie de périmètre déclarée par l'activité dans son contenu. Le gabarit propose sport et pôle. |
| pôle | department | Groupe de périmètres transverses (coordination, logistique, trésorerie…), proposé par défaut. Les pôles sont listés dans le `perimetres.yaml` de l'activité. |
| phase | phase | Partie de la période d'une activité, bornée en jours depuis son premier jour. L'activité déclare ses phases ; une tâche s'y range par son échéance, sans la déclarer (ADR 0025). |
| agenda | calendar | Calendrier d'une activité pour une période : ses phases, ses dates clés, ses réunions et, en option, les échéances. L'agenda global appartient à l'activité ; chaque périmètre a aussi le sien (ADR 0037). |
| date clé | key date | Jour, ou suite de jours, qu'un admin de l'activité place dans l'agenda d'une période (ADR 0037). |
| réunion | meeting | Rendez-vous de l'agenda global ou de l'agenda d'un périmètre, avec un horaire, un lieu et un lien de visio facultatifs. Elle ne se supprime pas, elle s'annule (ADR 0037). |
| convocation | meeting notice | Appel d'une personne de l'équipe à une réunion. L'application l'envoie par mail avec un fichier iCalendar ; la personne répond dans l'application. Ne pas confondre avec une invitation en attente (ADR 0037). |
| abonnement | calendar subscription | Adresse secrète qui sert un agenda au format iCalendar, en lecture seule, à un agenda externe. Une personne a son abonnement personnel ; une activité peut avoir le sien (ADR 0037). Ne pas confondre avec l'abonnement d'un appareil aux notifications push. |
| sondage | poll | Choix d'un créneau pour une réunion : les personnes visées répondent oui, si besoin ou non à chaque créneau proposé (ADR 0037). |
| référent·e | coordinator | Personne membre de l'organisation, désignée pour un périmètre et une édition. |
| affectation | appointment | Lien entre une personne, un périmètre et une édition. |
| contact principal | main contact | Référent·e désigné·e par un admin comme première personne à solliciter pour un périmètre et une édition. Une information seulement, sans droit supplémentaire (ADR 0011). |
| organigramme | org chart | Page qui présente l'équipe d'une activité : son contact, ses admins, puis les personnes de chaque périmètre pour la période en cours (ADR 0036). |
| signal | signal | Message du flux des changements : il dit qu'un objet a changé, sans porter de donnée (ADR 0017). |
| consultation | read-only access | Lecture des tâches, de l'avancement et de l'équipe d'un périmètre par une personne de l'activité qui n'y est pas affectée. Elle n'ouvre ni les fiches ni l'écriture (ADR 0014). |
| effectif | target headcount | Nombre de référentes et de référents souhaité pour un périmètre et une édition. |
| poste à pourvoir | open seat | Place de référent·e encore libre : l'effectif moins les affectations. |
| souhait | interest | Intérêt d'une personne pour un périmètre d'une édition, noté par un admin ou formulé par la personne. |
| demande | join request | Nom et adresse d'une personne qui veut rejoindre l'équipe d'une période, avec les périmètres qui l'intéressent. Elle attend la décision d'un admin : aucun compte n'existe avant (ADR 0015). |
| proposition | referral | Demande faite par une personne affectée à un périmètre, pour ce périmètre. Ne pas confondre avec une proposition d'accès. |
| proposition d'accès | access proposal | Ajout ou retrait d'un accès chez le fournisseur cloud, que Relaytour prépare et qu'un admin de l'organisation applique ou écarte. Un réglage du dossier lié applique les ajouts sans attendre (ADR 0044). |
| invitation en attente | pending invitation | Proposition faite à une personne qui a déjà un compte hors de l'organisation de la rejoindre, avec un rôle et des périmètres. Rien n'est créé en son nom avant son accord, et l'organisation ne lit rien de son compte (ADR 0030). |
| message | message | Texte qu'un admin prépare dans l'espace organisateur et envoie depuis sa propre messagerie, à une ou plusieurs personnes. L'application ne l'envoie pas (ADR 0020). Ne pas confondre avec un mail, que l'application envoie elle-même. |
| messagerie | mail app | Le logiciel ou le service de mail de l'admin, que l'application ouvre avec le message préparé : l'application par défaut de son appareil, une messagerie en ligne ou une application choisie (ADR 0022). |
| modèle | template | Texte de départ d'un message, que l'application complète avec ses informations : période, périmètre, tâches, adresses. |
| formulaire public | public form | Page lisible sans session où une personne dépose une demande pour rejoindre l'équipe d'une activité. Un admin l'ouvre, et règle son introduction, sa question complémentaire et ses paliers de disponibilité (ADR 0015). |
| ouverte aux souhaits | open to interests | Réglage d'une activité : les personnes de son équipe formulent elles-mêmes leurs souhaits dans « Tous les périmètres » (ADR 0012, 0045). Le réglage ne rend l'activité visible à personne. |
| rattachement | affiliation | Lien entre une personne et une activité, sans périmètre ni période. Il fait entrer la personne dans l'équipe de l'activité et lui ouvre la page « Tous les périmètres » (ADR 0045). |
| tâche | task | Action datée d'un périmètre pour une édition. |
| tâche partagée | shared task | Tâche d'un périmètre, déclinée dans d'autres périmètres de la même activité pour la même période. Elle garde son statut propre et montre l'état de ses déclinaisons (ADR 0026). |
| déclinaison | derived task | Tâche créée dans un périmètre cible depuis une tâche partagée. Elle vit comme toute tâche de ce périmètre : statut, personnes assignées, échéance (ADR 0026). |
| accord | approval | Réponse d'un périmètre cible à une déclinaison proposée : acceptée ou refusée. Un admin de l'activité impose une déclinaison sans accord (ADR 0026). |
| reprise des tâches | carry-over | Copie, dans une période, des tâches choisies d'une autre période de la même activité. Chaque échéance garde son écart avec le premier jour, et la tâche reprise repart à faire (ADR 0048). |
| commentaire | comment | Texte daté et signé qu'une personne écrit sur une tâche de son périmètre : un compte rendu, une information, une question (ADR 0029). Ne pas confondre avec une note de version. |
| fil | thread | Les commentaires d'une tâche et les événements de son journal, du plus ancien au plus récent (ADR 0029). |
| fiche | sheet | Fiche méthode (« comment faire ») d'un périmètre ou commune. Les fiches et les documents d'une activité forment l'écran « Ressources » (ADR 0043). |
| fournisseur cloud | cloud provider | Le service en ligne où l'association range ses documents (SharePoint, OneDrive, Google Drive, Dropbox ou Nextcloud), connecté par un admin de l'organisation. Le code le nomme `espace-fichiers` (ADR 0038, 0043). |
| vérification des accès | access check | Comparaison, faite par Relaytour, entre les personnes qu'un dossier lié attend et les droits de ce dossier chez le fournisseur cloud. Relaytour lit l'annuaire et les groupes ; seules les propositions d'accès changent des droits (ADR 0044). |
| accès en trop | extra access | Compte qui a un droit sur un dossier lié sans être attendu. Relaytour n'en garde que le nom (ADR 0044). |
| compte de service | service account | Compte technique Google qu'une organisation crée, et avec lequel elle partage ses dossiers. Relaytour lit Google Drive par lui quand l'organisation dépose sa clé (ADR 0038). |
| dossier lié | linked folder | Dossier du fournisseur cloud qu'un admin de l'organisation lie à une activité, pour toute l'activité ou pour une liste de périmètres et de groupes : ses lecteurs. Il se lit comme les fiches correspondantes (ADR 0038, 0043). |
| document | document | Fichier d'un dossier lié, lu dans Relaytour sans copie. Ne pas confondre avec une fiche, que Relaytour garde et versionne. |
| document lié | linked document | Dossier ou fichier du fournisseur cloud qu'une personne qui rédige une fiche y lie. Ses lecteurs l'ouvrent depuis la fiche (ADR 0038, 0043). |
| fiche connexe | related sheet | Fiche d'un périmètre qui concerne aussi d'autres périmètres de la même activité. Elle s'y lit sans s'y modifier (ADR 0039). |
| mention | mention | `@` suivi de l'identifiant d'un périmètre, ou `@groupe:` suivi de la clé d'un groupe, dans le texte d'une fiche. Elle s'affiche comme une étiquette et ne donne aucun accès (ADR 0039). |
| mode d'emploi | user guide | Page publique du site (`site/modes-d-emploi/`) qui décrit les écrans d'un rôle : admin de l'organisation, admin d'activité, référent·e. Une page peut aussi traiter un point précis, commun à plusieurs rôles : la messagerie, l'installation de l'application. Ne pas confondre avec une fiche. |
| admin de l'organisation | organization admin | Membre du bureau qui gère toutes les activités, les comptes et l'identité de l'organisation. Il nomme les admins de l'organisation et les admins d'activité. |
| admin d'activité | activity admin | Personne qui gère une activité : ses périodes, ses périmètres, ses affectations et ses fiches. Elle ne voit ni les autres activités (ADR 0010), ni les personnes hors de son équipe (ADR 0018). Elle nomme les autres admins de son activité (ADR 0019). |
| note de version | release note | Texte qui décrit un changement visible d'une version. Les notes d'audience `organisateurs` se lisent dans l'espace organisateur, selon le rôle de la personne (ADR 0021). |
| support | support | Aide demandée depuis le menu du compte : un mail à l'adresse de support de l'organisation, sinon l'action indiquée par l'hébergeur (ADR 0021). |
| équipe | team | Les membres de l'organisation liés à une activité par un rattachement, une affectation, un souhait ou un rôle d'admin, toutes périodes confondues (ADR 0018, 0045). |
| annuaire | directory | La liste de tous les membres de l'organisation, lue par ses admins seulement (ADR 0018). |
| journal | activity log | Trace de qui a fait quoi, et quand. Le journal alimente les notifications et le score de participation. |
| administration de l'installation | instance administration | Actions d'hébergement, par script ou par jeton, sans accès aux données : créer, suspendre, limiter, exporter une organisation. |
| identité | identity | Nom, sigle, contacts, logo, favicon et thème d'une organisation. Une activité en surcharge les contacts, le logo, les couleurs et le fond (ADR 0009). |
| adresse de rôle | role address | Adresse d'une boîte partagée de l'organisation, jamais d'une personne : une adresse d'un domaine de rôle, ou une adresse déclarée une par une. Relaytour la publie sans la signaler comme donnée personnelle. |
| image | image | Logo ou favicon d'une organisation ou d'une activité, gardé en base et désigné par son empreinte. |
| limites | limits | Plafonds d'une organisation (nombre d'activités, nombre de périodes ouvertes), fixés par l'administration de l'installation. Une limite ne bloque jamais la lecture ni l'export. Une organisation auto-hébergée n'en a aucune. |
| bénévole | volunteer | Personne qui aide l'activité sans compte dans l'application. Une fiche bénévole porte son nom et ses coordonnées, avec son accord (ADR 0040). |
| programme | schedule | L'ensemble des séquences d'une période : le déroulé du jour J, par lieu et par heure (ADR 0040). |
| séquence | slot | Moment du programme : un titre, un horaire, un lieu et un périmètre facultatifs, et les personnes placées en responsabilité ou en renfort (ADR 0040). Ne pas confondre avec une réunion. |
| lieu | venue | Endroit d'une activité où se tient une séquence : un terrain, un bassin, une salle. Il sert d'une période à l'autre (ADR 0040). |
| besoin en bénévoles | volunteer need | Nombre de renforts qu'une séquence recherche. Les places en renfort d'un membre ou d'une fiche bénévole y comptent (ADR 0041). |
| consignes pour les bénévoles | volunteer instructions | Texte public d'une séquence : la mission, le point de rendez-vous, la tenue. Ne pas confondre avec sa description, qui reste interne (ADR 0041). |
| appel à bénévoles | volunteer call | Ouverture des candidatures sur une partie du programme : la période, un périmètre ou une séquence. Il a une adresse publique secrète et des dates d'ouverture et de fermeture (ADR 0041). Le formulaire de l'équipe affiche l'adresse de l'appel ouvert sur toute la période (ADR 0046). |
| candidature | application | Dépôt d'une personne sur un appel à bénévoles : ses coordonnées, les séquences choisies et ses disponibilités. Elle attend la décision de l'équipe (ADR 0041). Ne pas confondre avec une demande. |
| plage de disponibilité | availability window | Intervalle, avec un début et une fin, où une personne peut aider pendant la période (ADR 0041). Ne pas confondre avec le créneau d'un sondage. |
| précisions de disponibilité | availability notes | Texte libre où une personne décrit ses disponibilités : « à partir de 18 h, tout poste sauf la photo » (ADR 0041). |
| liste d'attente | waiting list | Les candidatures déposées sur une séquence dont le besoin était déjà atteint. L'équipe peut les accepter (ADR 0041). |
| place à confirmer | unconfirmed place | Place de bénévole créée par l'équipe, que la personne n'a pas encore confirmée (ADR 0041). |
| bénévoles à répartir | unplaced volunteers | Personnes disponibles qui ne sont pas placées dans une séquence donnée : candidatures en attente, fiches avec des plages de disponibilité (ADR 0041). |
| espace bénévole | volunteer page | Page publique ouverte par le lien personnel d'une fiche bénévole : ses places, ses consignes, la confirmation et le retrait. Le lien reste le même d'un mail à l'autre (ADR 0041). |
| import de bénévoles | volunteer import | Entrée des personnes d'un fichier CSV ou Excel dans une période d'une activité, pour le programme entier ou pour un périmètre. Le fichier se lit dans le navigateur et ne se garde nulle part (ADR 0042). |
| correspondance d'import | import mapping | Association enregistrée des colonnes d'un fichier aux champs de Relaytour, réutilisée pour un fichier aux mêmes en-têtes (ADR 0042). Ne pas confondre avec le modèle d'un message. |
| source d'import | import source | Libellé donné à un import par la personne qui importe : « billetterie du 7 août ». Il reste sur chaque fiche et chaque candidature (ADR 0042). |
| identifiant externe | external ID | Valeur qui désigne une ligne dans l'outil d'origine, comme un numéro de billet. Elle rend un import rejouable (ADR 0042). |
| rapprochement | match | Lien proposé entre une personne d'un fichier et une fiche bénévole, ou entre deux fiches : même adresse, même téléphone ou nom proche (ADR 0042). |
| fusion de fiches | record merge | Réunion de deux fiches bénévoles en une seule, avec leurs places, leurs plages et leurs candidatures. Réservée aux admins de l'activité (ADR 0042). |
| fiche joignable | reachable record | Fiche bénévole qui porte une adresse et l'option « Prévenir par mail ». Sa première place lui envoie son lien personnel (ADR 0041). |
| application installée | installed app | L'espace organisateur ajouté à l'écran d'accueil d'un téléphone ou d'un ordinateur. Elle s'ouvre sans barre d'adresse et porte le nom et l'icône de l'organisation (ADR 0023). |
| icône d'application | app icon | Image carrée de 512 pixels qu'une organisation déclare pour son application installée (ADR 0023). |
| hors connexion | offline | État de l'appareil sans réseau. L'application affiche alors un écran d'attente et ne montre aucune donnée (ADR 0023). |
| notification push | push notification | Notification affichée par le système de l'appareil, application fermée. Elle reprend une notification de l'application (ADR 0024). Ne pas confondre avec un mail. |
| niveau de notification | notification level | À quel titre une personne reçoit une notification : référent·e, admin d'activité ou admin de l'organisation (ADR 0033). |
| notification d'admin | admin notification | Notification d'un niveau d'admin : une demande, une invitation acceptée, une nouvelle de l'équipe. Elle se lit dans l'écran « Notifications d'admin », à part de la cloche (ADR 0033). |

## Proposer une modification

Relaytour accueille les contributions : correctifs, évolutions, documentation, traductions de l'interface et de la documentation ([TRADUIRE.md](TRADUIRE.md)). Ouvrez d'abord un ticket pour une évolution importante, afin d'en discuter avant d'écrire le code.

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
- Une note d'audience `organisateurs` peut porter sa version anglaise dans un bloc `en:`, avec les mêmes champs que `fr:` (ADR 0047). L'option `--titre-en` de `noter` l'amorce. Sans ce bloc, l'espace organisateur affiche la note en français aux personnes qui lisent l'anglais, et `yarn versionner valider` le signale sans échouer.
- Une note d'audience `organisateurs` s'affiche dans l'espace organisateur (ADR 0021). Son champ `role` désigne le rôle le moins étendu qu'elle concerne : `referent` (valeur par défaut, lue par tous), `admin-activite` ou `admin-organisation`. L'option `--role` de `noter` l'écrit. Les audiences `interne` et `public` ne s'affichent pas dans l'application.
- Un changement d'interface joint une capture de l'écran, faite avec le contenu d'exemple (`content/exemple`) et des comptes fictifs.
- Un changement d'interface respecte les règles de la section « Mobile » de `docs/design-system.md`. Quand l'écran figure dans les modes d'emploi, la PR met à jour ses deux captures du site, `site/captures/` et `site/captures/mobile/`, et les cite dans sa description. Les captures anglaises de `site/en/captures/` se reprennent avec `--langue en`.
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

### Un seul numéro

- Relaytour porte un seul numéro de version, celui du `package.json` racine. Les paquets `packages/server` et `packages/orga` en portent une copie, et `yarn versionner valider` refuse tout écart.
- Une installation choisit une seule étiquette d'image pour ses trois images. Ce numéro est donc celui de l'installation.
- `packages/tokens`, `packages/commun` et `packages/database` sont internes au dépôt. Leur numéro ne se publie pas.
- Les notes gardent leur cible : `notes/notes-de-version.serveur.json` et `notes/notes-de-version.orga.json` groupent les fragments de `notes/fragments/` par version, la prochaine version en tête.

### Numérotation

- Les numéros suivent la forme `x.y.z` du versionnage sémantique.
- Avant la version 1.0, une fonctionnalité ou une rupture fait monter le deuxième chiffre (0.3.0 devient 0.4.0) et tout le reste le troisième (0.4.0 devient 0.4.1).
- À partir de la 1.0, une rupture fait monter le premier chiffre.
- Une rupture (fragment de type `rupture`) porte une consigne de migration. La release la reprend en tête, quelle que soit son audience.

### Une PR ordinaire ne change pas de numéro

Une PR de correctif ou d'évolution apporte seulement son fragment de note, sans champ `version`. Elle ne modifie jamais le champ `version` d'un `package.json`. Deux PR ouvertes en même temps se disputeraient sinon le même numéro.

### Publier une version

1. Une personne mainteneuse lance `yarn versionner publier` sur une branche partie de `develop`. La commande calcule le numéro d'après les types des fragments sans version, écrit ce numéro dans les fragments et dans les trois `package.json`, puis compile les journaux. `--version x.y.z` impose un autre numéro, `--simulation` montre le résultat sans rien écrire.
2. Elle ouvre la PR `chore(version): x.y.z` vers `develop`, qui passe par la CI comme toute autre PR.
3. Après sa fusion et la CI de `develop` au vert, elle avance `main` jusqu'à `develop` en avance rapide :
   ```bash
   git push origin develop:main
   ```
   Une fusion de PR par GitHub réécrirait les commits, en rebase comme en squash, et `main` divergerait de `develop`. Seul le rôle d'administration contourne la règle de PR de `main`.

Le workflow `publier.yml` fait le reste. À chaque poussée sur `main`, il construit les trois images et les publie sous l'empreinte du commit et sous `main`. Quand la version du `package.json` racine n'a pas encore de tag, il ajoute les étiquettes `:x.y.z`, `:x.y` et `:latest`, puis crée le tag `vx.y.z` et la release GitHub, dont le texte vient des notes de la version. Personne ne pose de tag à la main.

Une release ne se publie qu'après ses images : une relance du workflow ne crée donc pas de doublon. Pour voir le résultat sans rien publier, lancer `publier.yml` avec l'entrée `simulation`.

## Branches et CI

- `develop` est la branche d'intégration. `main` porte la dernière version publiée. L'historique de ces deux branches ne se réécrit pas.
- Pousser avec `git push origin <branche>`.
- Un correctif de CI s'ajoute comme étape de `ci.yml`, jamais comme job.
- Deux arrêts obligatoires : une migration destructive, et tout geste sur les secrets ou la production.

## Pièges connus

- La configuration d'une organisation se valide par un schéma qui refuse tout champ inconnu. Une version antérieure rencontre donc, après un retour arrière, un champ qu'elle ne connaît pas : la lecture en base (`lireDeclaration`) l'écarte et garde le reste. Le démarrage ne complète qu'une configuration vide, jamais une configuration illisible. Un champ nouveau de la déclaration reste facultatif, pour qu'une version antérieure lise encore la ligne.
- MJML 5 remplace en silence une inclusion refusée : `scripts/gabarits-courriel.ts` assemble les fragments lui-même et vérifie la présence du pied de page.
- MJML strict refuse une variable dans un attribut de couleur : les gabarits écrivent des couleurs sentinelles (`#010101` encre, `#020202` primaire, `#030303` accent, `#040404` sol), que `scripts/gabarits-courriel.ts` remplace par `{{couleur…}}` après compilation. Ne jamais utiliser ces quatre valeurs comme vraies couleurs.
- `mjml2html` est asynchrone en version 5 alors que ses types le décrivent synchrone.
- Sans `--target`, un `docker build` construit la dernière étape du Dockerfile : `runtime` doit rester la dernière.
- BullMQ refuse `:` dans un `jobId`.
- Apollo Client 4 passe `loading` à vrai pendant un `refetch()`, y compris après une mutation qui liste des `refetchQueries`. Un écran qui affiche son squelette sur `loading` seul démonte alors son contenu : tester `loading && !data`. La relecture des écrans (`packages/orga/src/lib/rafraichissement.ts`), périodique ou déclenchée par un signal du flux, ne passe pas par `refetch()` ; une requête ajoutée à sa liste doit garder son écran pendant un chargement.
- antd 6 déprécie plusieurs props : `message` sur `Alert` (`title`), `tip` sur `Spin` (`description`), `direction` sur `Space` (`orientation`), `size="default"` sur `Progress` (`medium`), `valueStyle` sur `Statistic` (`styles.content`).
- Prettier reformate le texte des requêtes `graphql()` : relancer `yarn workspace @relaytour/orga codegen` après un formatage, sinon les types deviennent `unknown`.
- Dans `Coquille`, le contenu principal porte `minWidth: 0` : sans lui, un tableau large élargit toute la page au-delà de l'écran.
- antd 6.6 déprécie aussi `List` : utiliser une liste HTML simple.
- antd 6.6 nomme `.ant-drawer-section` le conteneur du tiroir et `.ant-modal-container` celui de la fenêtre modale ; `.ant-drawer-content` et `.ant-modal-content` n'existent plus. Le verre dépoli de `global.css` les cible ainsi. Après une montée de version d'antd, vérifier ces classes dans le navigateur.
- antd 6 nomme `.ant-collapse-body` le contenu d'un panneau repliable ; `.ant-collapse-content-box` n'existe plus. Les groupes de notifications le ciblent dans `global.css`.
- Prettier ne lit `.prettierignore` que dans le dossier courant : le lancer depuis la racine, sinon il reformate `packages/orga/src/gql`.
- Le sol se pose sur `html` seul, jamais sur `body` : un fond sur `body` se peint au-dessus des halos en `z-index: -1` et les cache.
- Aucune couleur en dur dans `packages/orga` : les composants lisent les variables `--rt-*` (`var(--rt-primaire)`, `var(--rt-erreur)`, `var(--rt-encre-08)`…). Une couleur d'un périmètre vient de son contenu.
- Aucune police servie par un tiers : une famille s'ajoute par paquet fontsource dans `packages/orga/src/polices.ts` et dans `POLICES_DISPONIBLES`.
- Les tests d'intégration partagent la base de développement : une fonction qui parcourt toute la base (comme `genererRappels`) doit être restreinte aux données du test, sinon elle crée des notifications sur les données locales.
- Les tests d'intégration mettent de vrais jobs dans le Redis local. Un worker lancé en même temps les traite et journalise « Aucun destinataire » pour les comptes de test déjà supprimés.
- Le mode de développement de Vite recharge les requêtes `graphql()` avant la fin de `yarn workspace @relaytour/orga codegen` : une erreur « Expecting a parsed GraphQL document » disparaît au rechargement.
