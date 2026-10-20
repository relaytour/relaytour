# ADR 0038 — Programme du jour J, séquences et bénévoles

- **Statut** : proposée
- **Date** : 2026-10-20
- Complète l'ADR 0037 (agenda). Précède le rôle bénévole avec compte, prévu dans la feuille de route.

## Contexte

L'agenda (ADR 0037) prépare la période : phases, dates clés, réunions. Le jour J obéit à une autre logique. Une activité se déroule en même temps sur plusieurs lieux : un tournoi de football sur le terrain 2, la natation au bassin, l'accueil à l'entrée. Chaque moment demande des personnes en responsabilité et des renforts.

Aujourd'hui, ce planning vit dans un tableur tenu à côté. Il mélange les membres de l'équipe et des bénévoles venus pour la journée, qui n'ont pas de compte. Leurs numéros de téléphone circulent dans ce fichier sans contrôle.

Le besoin porte sur trois points :

- décrire le programme du jour J : des séquences, chacune avec un lieu, un horaire et un périmètre ;
- répartir les membres de l'équipe et les bénévoles dans ces séquences ;
- lire ce programme par lieu et par heure, par personne et par périmètre.

Le mot « événement » désigne déjà une nature d'activité (ADR 0008). Ce chantier emploie « programme » et « séquence ».

## Décision

### Les notions

- Le **programme** d'une période réunit ses séquences. Il n'a pas d'existence propre : une période a un programme dès qu'elle a une séquence.
- Une **séquence** est un moment du programme : un titre, un début et une fin, un lieu facultatif, un périmètre facultatif et une description. Une séquence sans périmètre appartient à l'activité entière (l'accueil, la cérémonie).
- Un **lieu** est un endroit de l'activité : un terrain, un bassin, une salle. Les lieux appartiennent à l'activité et servent d'une période à l'autre. Un lieu porte un nom, une description facultative et un ordre d'affichage.
- Une séquence reçoit des **personnes**, en responsabilité ou en renfort. Une personne est un membre de l'équipe de l'activité (ADR 0018) ou une ou un bénévole.
- Une **fiche bénévole** décrit une personne qui aide l'activité sans compte dans l'application. Elle porte un nom, une adresse et un téléphone facultatifs, et une note. Elle appartient à l'activité.

### Droits

- Les admins de l'activité et de l'organisation gèrent les lieux.
- Les admins de l'activité écrivent toute séquence. Une personne qui écrit dans un périmètre (ADR 0014) écrit les séquences de ce périmètre et y place des personnes.
- Une période archivée passe en lecture seule.
- Toute personne qui voit l'activité lit son programme, avec le nom des personnes placées dans chaque séquence. Une fiche bénévole n'y montre que son nom.
- Les admins de l'activité et les personnes qui écrivent dans un périmètre de l'activité créent une fiche bénévole. Les admins de l'activité modifient et suppriment toute fiche ; la personne qui a créé une fiche la modifie aussi.
- Les coordonnées d'une ou d'un bénévole (adresse, téléphone, note) se lisent par les admins de l'activité et par les personnes qui écrivent dans un périmètre où cette personne est placée. Elles ne sortent jamais du serveur dans une autre réponse (invariant 1).

### Données personnelles des bénévoles

- Une fiche ne s'enregistre qu'avec l'accord de la personne. La personne qui crée la fiche le déclare par une case à cocher, datée en base.
- Une fiche vit en base seulement. Elle n'entre jamais dans un dossier de contenu ni dans Git (invariants 2 et 16). L'export complet de l'organisation la reprend.
- L'application n'envoie rien aux bénévoles dans ce chantier : ni mail, ni notification.
- Supprimer une fiche la retire de toutes les séquences.
- Une purge planifiée supprime chaque nuit les fiches qu'aucune séquence d'une période non archivée n'utilise, et qui n'ont pas changé depuis 24 mois.

### Vues

- L'écran « Programme » présente la période en **grille** : une colonne par lieu, puis une colonne « Sans lieu », et une ligne par heure. Chaque séquence montre son titre, son périmètre et ses personnes. Sur un téléphone, la grille devient une liste par lieu et par heure. La page s'imprime.
- La vue **« Mon jour J »** liste les séquences où la personne connectée est placée, dans l'ordre de la journée.
- La page d'un **périmètre** liste ses séquences du jour J et leurs personnes.
- L'abonnement personnel à l'agenda (ADR 0037) reprend les séquences où la personne est placée.

## Conséquences

- Une migration additive crée les tables `Lieu`, `Sequence`, `PlaceSequence` et `Benevole`. Chaque table porte `organisationId` et `activiteId` ; chaque unicité est bornée par un parent (invariant 18).
- Une place de séquence désigne soit un compte, soit une fiche bénévole, jamais les deux.
- Une séquence dure 24 heures au plus. Une période compte 1 000 séquences au plus, une séquence 50 places au plus.
- La table des refus croisés couvre chaque requête et chaque mutation. Les tests prouvent qu'une coordonnée de bénévole reste nulle pour une personne qui ne la lit pas (invariant 11).
- Le flux des changements reçoit l'entité `PROGRAMME` (ADR 0017).
- Le glossaire reçoit les mots programme, séquence, lieu et fiche bénévole. Le mot « bénévole » y prend son sens de personne sans compte.
- Le rôle bénévole avec compte, prévu dans la feuille de route, partira de ces fiches.

## Revue de sécurité

- Le programme publie des noms à toute l'équipe de l'activité, jamais à une autre activité ni à une autre organisation. Une activité invisible reçoit le même refus qu'une activité inconnue.
- Les coordonnées d'une ou d'un bénévole suivent le besoin d'organiser : les admins de l'activité, et les personnes qui travaillent avec elle dans un périmètre.
- Une fiche n'existe qu'avec un accord déclaré. Elle se supprime d'un geste, et la purge efface les fiches qui ne servent plus.
- Aucun champ d'une fiche n'est une adresse de connexion : une fiche ne donne aucun accès à l'application.
