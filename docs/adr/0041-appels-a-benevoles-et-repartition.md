# ADR 0041 — Appels à bénévoles, candidatures et répartition

- **Statut** : proposée
- **Date** : 2026-10-21
- Complète l'ADR 0040 (programme du jour J). Remplace deux de ses règles : l'absence de tout mail aux bénévoles, et la lecture des noms des bénévoles réservée aux personnes qui lisent le programme. La section « Ce qui change dans l'ADR 0040 » les nomme.
- L'import d'une liste de bénévoles tenue hors de Relaytour relève d'une ADR suivante (0042).

## Contexte

Le programme du jour J (ADR 0040) place des membres de l'équipe et des bénévoles dans des séquences. Une fiche bénévole n'existe aujourd'hui que si une personne de l'équipe la saisit.

Les organisations recrutent leurs bénévoles par d'autres moyens : un formulaire en ligne, une billetterie gratuite, un tableur partagé. L'équipe ressaisit ensuite chaque personne, et ne voit pas les heures où il manque du monde.

Le besoin porte sur quatre points :

- laisser les bénévoles se proposer par une adresse publique, ouverte pendant une durée choisie par l'équipe ;
- garder la décision à l'équipe, comme pour une demande pour rejoindre l'équipe (ADR 0015) ;
- recueillir les disponibilités sous une forme qui se calcule ;
- montrer les manques et placer les bénévoles disponibles dans les séquences.

Deux moyens étaient demandés. Le premier est un lien vers une seule séquence. Le second est un lien vers le programme, où chaque personne choisit parmi les séquences qui cherchent des bénévoles.

## Décision

### Les notions

- Le **besoin en bénévoles** d'une séquence est le nombre de renforts qu'elle recherche. Une séquence sans besoin n'apparaît dans aucun appel.
- Les **consignes pour les bénévoles** sont un texte public de la séquence : la mission, le point de rendez-vous, la tenue. Elles se distinguent de la description de la séquence, qui reste interne.
- Un **appel à bénévoles** ouvre les candidatures sur une partie du programme d'une période. Il porte une adresse publique secrète, une date d'ouverture, une date de fermeture et un texte d'introduction.
- La **portée** d'un appel est la période entière, un périmètre, ou une seule séquence.
- Une **candidature** est le dépôt d'une personne sur un appel. Elle porte un nom, une adresse, un téléphone facultatif, les séquences choisies, des plages de disponibilité, des précisions et un message.
- Une **plage de disponibilité** est un intervalle (début, fin) où une personne peut aider, dans les jours de la période.
- Les **précisions de disponibilité** sont un texte libre donné par la personne : « à partir de 18 h, tout poste sauf la photo ».
- La **liste d'attente** d'une séquence réunit les choix déposés quand son besoin était déjà atteint.
- Une **place à confirmer** est une place de bénévole créée par l'équipe, que la personne n'a pas encore confirmée.
- Les **bénévoles à répartir** d'une séquence sont les personnes disponibles qui n'y sont pas placées. Ce sont les candidatures en attente, et les fiches qui ont des plages de disponibilité.
- L'**espace bénévole** est la page publique qu'ouvre le lien personnel d'une fiche.

### Besoin et consignes

- Une personne qui écrit une séquence (ADR 0040) fixe son besoin et ses consignes.
- Le besoin compte les places en renfort, qu'elles désignent un membre ou une fiche bénévole. Une place en responsabilité n'y compte pas.
- Une place à confirmer compte dans le besoin.

### Appel

- Un admin de l'activité ouvre un appel de toute portée. Une personne qui écrit dans un périmètre ouvre un appel de portée « périmètre » ou « séquence » pour son périmètre.
- Une séquence sans périmètre ne s'ouvre que par un admin de l'activité.
- L'appel reçoit les candidatures entre sa date d'ouverture et sa date de fermeture. La date de fermeture est obligatoire. Elle tombe au plus tard à la fin du dernier jour de la période.
- Une personne qui gère l'appel peut le fermer plus tôt, puis le rouvrir avant sa date de fermeture.
- Une séquence commencée ne reçoit plus de candidature.
- L'adresse publique a la forme `/benevoles/<jeton>`, avec un jeton aléatoire de 32 octets. Le serveur garde son empreinte SHA-256, comme pour les abonnements à l'agenda (ADR 0037).
- Renouveler l'adresse révoque l'ancienne. L'archivage de la période ferme ses appels.

### Page publique et dépôt

- La page présente l'organisation, l'activité, la période et l'introduction de l'appel. Elle liste ensuite les séquences de sa portée qui ont un besoin, par jour et par lieu.
- Chaque séquence montre son titre, son horaire, son lieu, son périmètre, ses consignes et l'état de son besoin : « 3 places recherchées », ou « complète, liste d'attente ».
- La page ne montre aucun nom de personne placée. Des consignes ou une description de lieu qui contiennent une coordonnée personnelle ne sont pas publiées.
- Une séquence s'y désigne par une référence calculée à partir du secret du serveur. Aucun identifiant de la base n'en sort, comme pour le formulaire public (ADR 0015).
- La personne choisit une ou plusieurs séquences. Dans un appel de portée « période », elle peut aussi déclarer qu'elle aide là où il manque du monde, sans choisir de séquence.
- La page signale deux séquences choisies qui se chevauchent, sans bloquer le dépôt.
- La personne ajoute ses plages de disponibilité sur les jours de la période, et des précisions facultatives.
- Elle coche l'accord pour l'enregistrement de ses données. La mention annonce la durée de conservation et l'adresse de contact de l'organisation.
- Le dépôt reprend les protections du formulaire public. Il borne les dépôts par adresse IP, par adresse mail et par appel. Il ajoute un champ piège, borne les tailles et refuse les liens.
- Le dépôt n'envoie aucun mail. Un message à l'écran confirme la réception.
- Une adresse a au plus une candidature en attente par appel. Un second dépôt complète la première candidature. La réponse ne dit pas qu'une candidature existait.

### Jauge et liste d'attente

- Au dépôt, chaque séquence choisie passe en attente si ses places en renfort restent sous le besoin. Sinon, le choix passe en liste d'attente.
- Ce calcul se fait sous le verrou de la séquence. Deux dépôts simultanés ne dépassent pas le besoin.
- L'équipe accepte un choix en attente ou en liste d'attente, même au-delà du besoin. L'écran signale le dépassement.
- Une place libérée ne fait monter personne de la liste d'attente sans décision de l'équipe. La file de revue présente la liste d'attente en tête de la séquence.

### Traitement par l'équipe

- Les admins de l'activité lisent toutes ses candidatures, avec l'adresse et le téléphone.
- Une personne qui écrit dans un périmètre lit les candidatures qui choisissent une séquence de ce périmètre. Elle n'en voit que les choix de son périmètre.
- Une candidature sans séquence choisie se lit par les admins de l'activité. Elle se lit aussi par les personnes qui écrivent dans un périmètre de la portée de l'appel.
- Accepter un choix crée la fiche bénévole, ou rattache la fiche de l'activité qui porte la même adresse. La fiche reçoit l'accord daté du dépôt, les plages de la candidature et une place à confirmer en renfort. Tout s'écrit dans une transaction.
- Une personne qui écrit dans le périmètre d'une séquence y accepte un choix. Une séquence sans périmètre relève des admins de l'activité.
- La personne qui accepte peut placer la candidate ou le candidat dans une autre séquence qu'elle écrit.
- Refuser un choix n'écrit aucune fiche et n'envoie aucun mail, comme le refus d'une demande (ADR 0015).
- Une candidature reçue crée une notification pour les personnes qui peuvent la traiter. Chaque personne en reçoit au plus une par activité et par jour. Elle ne nomme pas la candidate ou le candidat et mène à la file de revue.

### Confirmation et mails

- Seule une décision de l'équipe déclenche un mail. Une adresse saisie dans la page publique ne reçoit rien avant l'acceptation d'un choix.
- La première acceptation d'une candidature envoie un seul mail. Il nomme l'organisation, l'activité et les séquences acceptées, et porte le lien personnel.
- Ce mail précise : « Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message. Vos données seront supprimées. »
- Une acceptation suivante, avant la confirmation, n'envoie rien. La page du lien montre toutes les places.
- Le lien ouvre une page où la personne confirme sa participation par un bouton. L'ouverture du lien ne confirme rien, car les messageries ouvrent parfois les liens d'un mail pour les analyser.
- La confirmation date l'adresse de la fiche comme confirmée, et confirme toutes ses places à confirmer.
- La personne peut aussi décliner une place, ou toutes. Une fiche qu'aucune place ne retient alors est supprimée.
- Tant que l'adresse n'est pas confirmée, aucun autre mail ne part. L'équipe peut relancer la personne une seule fois.
- Une place peut rester à confirmer sept jours après l'acceptation, ou jusqu'à la veille de sa séquence si elle arrive avant. Elle apparaît alors « non confirmée » dans les vues de l'équipe. L'équipe décide de la libérer ou de la garder.
- Une adresse confirmée reçoit un mail à chaque changement de ses places : une place ajoutée, retirée, ou dont l'horaire change. Les changements se regroupent pendant deux minutes, comme les convocations (ADR 0037).
- Une place ajoutée à une adresse confirmée reste à confirmer. La personne la confirme dans son espace.
- Une fiche saisie à la main ne reçoit jamais de mail. Ses places naissent confirmées.
- Ces mails comptent dans le plafond quotidien des mails de l'installation (ADR 0034).

### Espace bénévole

- L'espace bénévole a la forme `/benevole/<jeton>`. Seule une fiche née d'une candidature en a un.
- Le serveur garde l'empreinte du jeton sur la fiche. Le jeton se révoque à l'archivage de la dernière période où la fiche est placée.
- L'équipe peut renouveler le lien. Le renouvellement renvoie le mail et compte comme la relance.
- L'espace montre le nom de la personne et ses places à venir, avec leurs lieux, leurs horaires et leurs consignes. Il montre aussi ses plages de disponibilité. Il ne montre ni l'adresse ni le téléphone.
- La personne y télécharge ses places au format iCalendar.
- Elle s'y retire d'une place à venir. Le retrait notifie les personnes qui écrivent dans le périmètre de la séquence, ou les admins de l'activité.
- Elle y supprime sa fiche, après une seconde confirmation, quand aucune place à venir ne la retient. Sinon, elle se retire d'abord de ses places.

### Vue « Répartition »

- L'écran « Programme » reçoit une vue « Répartition ». Elle sert à une personne qui écrit dans un périmètre à plusieurs séquences, et à un admin qui gère plusieurs périmètres.
- Un filtre choisit les périmètres. Un admin de l'activité peut en choisir plusieurs. Une personne qui écrit dans un périmètre voit d'abord les siens.
- Un bandeau découpe chaque jour en tranches de 30 minutes. Chaque tranche montre la somme des besoins, les places confirmées, les places à confirmer et le nombre de bénévoles à répartir. Une tranche en manque se signale.
- Une frise montre les séquences sur l'axe des heures, regroupées par périmètre ou par lieu. Chaque séquence montre sa jauge et ses personnes placées.
- Un panneau « Bénévoles à répartir » montre chaque personne avec ses plages de disponibilité, sur le même axe des heures.
- Quand une séquence est choisie, le panneau classe les personnes en trois rangs. Une plage couvre toute la séquence, ou une plage en couvre une partie, ou la personne n'a donné que des précisions. Des marques signalent un choix de cette séquence, une liste d'attente, ou une place déjà tenue à la même heure.
- Le survol d'une personne montre ses précisions de disponibilité, son message, l'origine de sa candidature, ses choix et ses places. La note de la fiche s'y ajoute pour une personne qui la lit (ADR 0040).
- L'équipe place une personne par glisser-déposer, ou par un bouton « Placer » accessible au clavier. Placer une candidature accepte un choix. Placer une fiche ajoute une place.
- Un placement hors des plages de la personne, en chevauchement avec une autre place, ou au-delà du besoin, affiche un avertissement sans bloquer.
- Sur un téléphone, la vue liste les séquences en manque. Chacune ouvre la liste des bénévoles à répartir, avec le bouton « Placer ».
- Une personne qui peut modifier une fiche (ADR 0040) ajoute ou modifie aussi ses plages de disponibilité.

### Qui voit les bénévoles à répartir

- Les bénévoles à répartir d'un appel de portée « période » se lisent par les admins de l'activité. Ils se lisent aussi par toute personne qui écrit dans un périmètre de l'activité.
- La même règle vaut pour les fiches qui ont des plages de disponibilité.
- Ces personnes y lisent le nom, les plages, les précisions de disponibilité, les choix et les places.
- Les bénévoles à répartir d'un appel de portée « périmètre » ou « séquence » se lisent par les admins de l'activité. Ils se lisent aussi par les personnes qui écrivent dans ce périmètre.
- L'adresse, le téléphone et la note d'une fiche suivent la règle de l'ADR 0040. Une place à confirmer compte comme une place pour cette règle.

### Ce qui change dans l'ADR 0040

- L'ADR 0040 excluait tout envoi aux bénévoles. Cette décision permet les mails décrits plus haut, et seulement vers une adresse que la personne a déposée elle-même.
- L'ADR 0040 réservait les noms des bénévoles aux personnes qui lisent le programme. Les personnes qui écrivent dans un périmètre lisent aussi les bénévoles à répartir, selon la section précédente.

### Conservation

- Une candidature vit en base seulement. Elle n'entre jamais dans un dossier de contenu ni dans Git (invariants 2 et 16).
- Les candidatures d'une période sont supprimées à son archivage, quel que soit leur état, comme les demandes (ADR 0015).
- Les plages de disponibilité d'une fiche appartiennent à une période. Elles sont supprimées à son archivage.
- Une fiche née d'une candidature suit la purge de l'ADR 0040.
- L'export complet de l'organisation reprend les appels, les candidatures et les plages.

### Limites

- Une séquence recherche 200 renforts au plus.
- Une candidature choisit 30 séquences au plus et porte 20 plages au plus.
- Une plage dure 24 heures au plus et tombe dans les jours de la période.
- Un appel compte 500 candidatures en attente au plus. Une période compte 20 appels ouverts au plus.
- Les précisions comptent 600 caractères au plus, et le message 600 caractères au plus.

## Conséquences

- Une migration additive ajoute à `Sequence` le besoin et les consignes, et à `PlaceSequence` sa date de confirmation.
- Elle ajoute à `Benevole` son origine, la date de confirmation de l'adresse, l'empreinte du lien, et les dates d'envoi et de relance.
- Elle crée les tables `AppelBenevoles`, `Candidature`, `ChoixCandidature` et `PlageDisponibilite`. Chaque table porte `organisationId` ou s'y rattache par son parent. Chaque unicité est bornée par un parent (invariant 18).
- Une plage appartient soit à une candidature, soit à une fiche. Le code porte cette règle et un test la prouve : une contrainte CHECK sur une clé étrangère en cascade échoue sous MariaDB (ADR 0040).
- Les places existantes reçoivent une date de confirmation égale à leur date de création.
- La table des refus croisés couvre chaque requête et chaque mutation. Des tests prouvent qu'une coordonnée reste nulle pour une personne qui ne la lit pas (invariant 11), et qu'aucun mail ne part au dépôt.
- Le flux des changements reçoit l'entité `CANDIDATURE` (ADR 0017).
- Les notifications reçoivent les types `CANDIDATURE_RECUE` et `BENEVOLE_RETIRE`.
- Les gabarits de mail `candidature-acceptee` et `places-modifiees` s'ajoutent.
- Les adresses `/benevoles/*` et `/benevole/*` sont des routes de l'espace organisateur. Un serveur web qui renvoie les chemins inconnus vers l'application les sert sans réglage.
- Le glossaire reçoit dix mots : appel à bénévoles, besoin en bénévoles, consignes pour les bénévoles, candidature, plage de disponibilité, précisions de disponibilité.
- Il reçoit aussi liste d'attente, place à confirmer, bénévoles à répartir et espace bénévole.

## Revue de sécurité

- La page publique ne publie aucun nom et aucun identifiant de la base. Elle donne seulement l'état du besoin de chaque séquence.
- L'adresse d'un appel est secrète et se renouvelle. Une adresse révoquée reçoit le même refus qu'une adresse inconnue.
- Le dépôt ne dit pas si une adresse a déjà une candidature, une fiche ou un compte.
- Aucun mail ne part vers une adresse saisie par un tiers sans décision humaine. Un robot qui remplit la page ne déclenche aucun envoi.
- Une personne qui reçoit un mail sans s'être inscrite l'ignore, et sa candidature reste sans suite. La purge l'efface à l'archivage de la période.
- La confirmation passe par un bouton. L'analyse automatique d'un lien ne confirme rien.
- Le jeton de l'espace bénévole donne accès à une seule fiche. L'espace n'affiche ni l'adresse ni le téléphone, et la suppression demande une seconde confirmation.
- Une candidature et ses coordonnées se lisent par les seules personnes qui peuvent la traiter. Les bénévoles à répartir n'exposent aux personnes qui écrivent dans un périmètre que le nom, les plages, les précisions, les choix et les places.
- Une activité invisible, un appel inconnu et un appel fermé reçoivent la même réponse publique.
