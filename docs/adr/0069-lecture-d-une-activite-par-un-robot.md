# ADR 0069 — Lecture d'une activité par un robot

- **Statut** : proposée
- **Date** : 2026-11-20
- Option retenue le 2026-11-20 : la lecture de l'activité, attachée au rattachement d'un robot. Les autres options figurent sous « Options écartées ».
- Complète l'ADR 0064 (robots et jetons d'accès), l'ADR 0010 (visibilité des activités), l'ADR 0014 (consultation) et l'ADR 0045 (rattachement).
- Ne remplace aucune règle d'une ADR acceptée. Une personne garde les accès décrits par le tableau de l'ADR 0045.

## Contexte

Un robot (ADR 0064) porte les jetons d'une automatisation partagée. Un cas fréquent est un client en lecture : une application tierce lit les éditions, les lieux et le programme d'une activité. Elle se tient à jour par le flux des changements (ADR 0017), puis relit ce qui a changé.

Un admin de l'organisation crée le robot et le rattache aux activités choisies. Le rattachement ne donne que la découverte (ADR 0045) : la page « Tous les périmètres » et l'organigramme réduit. Les champs `editions`, `lieux`, `programme`, l'agenda et le flux exigent une activité visible (`activitesVisibles`). Une activité est visible pour les admins de l'activité et pour les personnes affectées à l'un de ses périmètres.

Un essai réel du 20 novembre 2026, sur `develop`, l'a montré. Le robot rattaché à une activité la découvre, mais chaque lecture de ses éditions répond `FORBIDDEN`.

Pour ouvrir la lecture, un admin doit aujourd'hui affecter le robot à un périmètre (`affecter`). Le code compte une affectation de toute période : une seule affectation suffit donc pour toutes les éditions. Ce contournement a pourtant plusieurs défauts :

- Le geste n'a aucun sens pour l'équipe. Un admin doit choisir un périmètre et une période qui n'ont rien à voir avec le besoin du programme.
- L'affectation donne plus que la lecture. Le robot écrit dans le périmètre pour la période de l'affectation, avec un jeton `LECTURE_ECRITURE`. Il lit les fiches de ce périmètre.
- L'affectation ouvre des données personnelles que le client en lecture ne demande pas. Une personne qui écrit dans un périmètre lit les coordonnées des bénévoles qui y sont placés, et les candidatures de l'activité (ADR 0040, 0041). Ce contrôle suit l'affectation, pas la portée du jeton.
- Le robot occupe une place de l'effectif. Le nombre de postes à pourvoir baisse, et la charge de la période le compte (ADR 0055).
- Le robot peut recevoir une tâche, une place au programme ou le rôle de contact principal. Il apparaît dans les listes de choix des référentes et référents.
- L'accès tient à une ligne qu'un autre geste supprime. Le retrait de l'affectation, la suppression de la période ou une purge future (issue 192) coupent la lecture. Seul un refus `FORBIDDEN` le signale au client en lecture, souvent le jour J.

Le besoin est donc un droit de lecture sur une activité entière, valable pour toutes ses éditions, sans aucun des effets d'une affectation.

## Décision

### La lecture de l'activité

- Le rattachement d'un robot à une activité porte un réglage nouveau : la **lecture de l'activité**. La colonne `RattachementActivite.lecture` le garde, fausse par défaut.
- Un robot qui a la lecture voit l'activité au sens de l'ADR 0010. `activitesVisibles` ajoute ses activités, et l'ensemble reste réduit par la liste d'activités du jeton.
- Le robot consulte alors chaque périmètre, pour chaque période, comme le prévoit l'ADR 0014. Il lit aussi les éditions, les lieux, le programme, l'agenda, les fiches communes et le flux des changements de l'activité.
- La lecture n'ajoute le robot à aucun ensemble d'écriture. `perimetresConnus`, `perimetresAffectes`, `activitesAdministrees` et `equipeAdministree` ne changent pas.

### Cloisonnement

- Le droit se calcule dans l'organisation active, comme tous les autres (ADR 0030). Un rattachement d'une autre organisation ne compte pas.
- Le droit vaut pour une activité et une seule. Il n'ouvre ni l'annuaire, ni les notifications d'admin, ni une autre activité de l'organisation.
- La table des refus croisés reçoit les deux mutations nouvelles. Un admin d'une autre activité ne donne pas la lecture d'une activité qu'il n'administre pas.

### Données personnelles

- Le robot lit ce que lit une personne en consultation (ADR 0014). Il lit le nom des référentes et des référents, des personnes assignées et du contact principal.
- Il lit aussi le nom des personnes placées au programme. Une fiche bénévole n'y montre que son nom (ADR 0040).
- Il ne lit ni les adresses des membres, ni les coordonnées des bénévoles, ni les candidatures, ni les demandes, ni les fiches de périmètre. Ces règles passent par l'écriture ou par l'administration, que la lecture n'ouvre pas.

### Révocation

- Un admin de l'activité retire la lecture en un geste. Le retrait du rattachement la retire aussi, puisqu'elle en fait partie.
- Les gestes de l'ADR 0064 restent valables : révoquer le jeton, archiver le robot, désactiver le module « API ».
- Le contexte relit les droits à chaque requête. Le flux des changements perd l'activité à sa prochaine relecture des droits.

### Règles

- La lecture de l'activité est réservée aux robots en v1. Une personne garde le tableau de l'ADR 0045. Une personne qui observe une activité sans y travailler reste un besoin à part.
- Un admin de l'organisation la donne à la création du robot, activité par activité (`creerRobot`), ou plus tard. Un admin de l'activité la donne et la retire dans son activité (`donnerLectureActivite`, `retirerLectureActivite`). Il peut déjà affecter le robot, ce qui ouvre davantage.
- La mutation refuse un compte qui n'est pas un robot, un robot archivé et un robot non rattaché à l'activité. Chaque refus a le même code qu'une activité d'une autre organisation.
- Un robot qui n'a que la lecture ne formule aucun souhait et ne se place pas au programme. Les mutations qui lui ouvriraient une écriture en découverte le refusent.
- La lecture ne compte ni dans l'effectif ni dans les postes à pourvoir. Le robot n'entre ni dans la charge, ni dans les listes d'assignation. Le classement et l'organigramme l'excluent déjà (ADR 0064).
- Le robot ne reçoit aucune notification au titre de la lecture.
- L'écran Équipe affiche l'étiquette « lecture » à côté du robot. Le panneau « API » de l'écran « Organisation » montre, pour chaque robot, les activités qu'il lit.
- Le don et le retrait de la lecture entrent au journal, avec leur auteur, et publient un signal du flux. Ils ne changent aucun jeton.
- Un robot déjà affecté garde son affectation. L'admin peut ensuite lui donner la lecture et retirer l'affectation.

### Raisons du choix

- La lecture donne au client en lecture le seul droit dont il a besoin, sans écriture et sans données personnelles au-delà de la consultation.
- Elle garde une seule source de droits, la personne, comme le veut l'ADR 0064.
- Elle se lit et se retire là où un admin gère déjà le robot : son rattachement.
- Elle ne demande qu'une migration additive, sans reprise de données.

## Options écartées

### Une portée de jeton « lecture de l'activité »

- Le jeton d'un robot porte une liste d'activités qu'il lit, même quand le robot ne les voit pas.
- Cette option contredit l'ADR 0064 : un jeton réduit les droits de sa personne et n'en crée aucun. Le contrôle des champs devrait lire le jeton en plus de la personne, à chaque résolveur.
- Le cloisonnement deviendrait plus difficile à prouver. Deux sources de droits coexisteraient, et chaque test de refus croisé devrait les couvrir toutes les deux.
- Les données personnelles visibles seraient les mêmes que pour la lecture de l'activité.
- La révocation passerait par le jeton seul. L'écran Équipe ne montrerait pas qui lit l'activité, puisque le droit ne serait plus porté par un membre.

### Une affectation reconduite à chaque nouvelle édition

- Le serveur affecterait le robot à un périmètre choisi, à chaque création ou reconduction d'une édition (ADR 0048).
- Cette option ne règle aucun défaut du contournement actuel. L'écriture, les coordonnées des bénévoles, l'effectif et la charge restent ouverts.
- Elle ajoute une règle cachée à la création d'une édition. Un admin qui retire l'affectation la verrait revenir à l'édition suivante.
- Le cloisonnement ne change pas, mais le robot écrit dans un périmètre de chaque édition.
- La révocation demande de retirer l'affectation dans chaque édition, puis de couper la reconduction.

### Le rôle d'admin de l'activité pour le robot

- L'ADR 0064 permet déjà ce rôle. Il ouvre toutes les éditions sans geste répété.
- Le robot lirait l'équipe avec ses adresses, les demandes, les candidatures et les coordonnées de tous les bénévoles. Un jeton en lecture garderait ces lectures.
- Le risque d'une fuite du jeton serait celui d'une session d'admin de l'activité, en lecture.

## Conséquences

- Une migration additive ajoute `RattachementActivite.lecture`. Un retour à une version antérieure ignore la colonne : le robot retombe en découverte, sans perte de données.
- `activitesVisibles` compte la lecture d'un robot. Les contrôles qui s'appuient sur cet ensemble (consultation, programme, agenda, fiches communes, recherche, flux) l'ouvrent sans autre changement.
- `AttributionActivite` gagne un champ qui indique la lecture. L'export complet d'une organisation la contient. Elle n'est jamais exportée dans Git.
- Le glossaire reçoit le terme « lecture de l'activité » (anglais « activity read access »).
- Le mode d'emploi de l'API décrit le robot d'un client en lecture : le créer, le rattacher avec la lecture, puis créer un jeton en portée `LECTURE`.

## Revue de sécurité

Les tests de la mise en œuvre prouvent chaque contrôle par le refus :

- un robot rattaché sans lecture reçoit toujours `FORBIDDEN` sur `editions`, `lieux` et `programme` ;
- un robot avec la lecture lit les éditions, les lieux et le programme de chaque période, y compris une période créée après le don de la lecture ;
- un robot avec la lecture ne lit ni une autre activité, ni l'annuaire, ni les fiches de périmètre, ni les coordonnées des bénévoles, ni les candidatures, ni les adresses ;
- un robot avec la lecture et un jeton `LECTURE_ECRITURE` n'écrit rien dans l'activité ;
- un admin d'une autre activité ou d'une autre organisation ne donne ni ne retire la lecture ;
- une personne qui n'est pas un robot ne reçoit pas la lecture ;
- le retrait de la lecture, le retrait du rattachement et l'archivage du robot coupent la lecture à la requête suivante.

## Plan de mise en œuvre

1. Serveur : colonne, calcul de `activitesVisibles`, mutations, refus croisés, tests (cette ADR, une fois acceptée).
2. Espace organisateur : étiquette dans l'écran Équipe, case à la création du robot, liste des activités lues dans le panneau « API ».
3. Mode d'emploi de l'API, glossaire, et passage de l'ADR à « acceptée ».
