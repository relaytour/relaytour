# ADR 0026 — Tâches partagées entre périmètres

- **Statut** : proposée
- **Date** : 2026-10-08
- Complète l'ADR 0003 (tâches types) et l'ADR 0009 (source de vérité du contenu). Ajoute une exception à l'ADR 0014 : une personne propose une tâche à un périmètre où elle n'est pas affectée.

## Contexte

Une tâche appartient à un seul périmètre. Rien ne relie deux tâches.

Une activité qui réunit plusieurs périmètres d'un même groupe répète pourtant les mêmes tâches. Sur une activité de neuf sports et onze pôles, onze tâches types reviennent à l'identique dans les neuf sports. Une tâche sur cinq est un relais : un sport transmet une information à un pôle, qui porte de son côté la tâche de la réunir.

Cette répétition a trois effets :

- Le contenu déclare neuf fois le même texte. Une correction se reporte à la main dans neuf fichiers.
- Le pôle qui attend une information ne voit pas quels sports l'ont transmise. Il ouvre neuf pages.
- Le rétroplanning affiche neuf lignes identiques sous la même date.

Trois modèles étaient possibles :

- une tâche réelle dans le périmètre qui demande, liée à une tâche par périmètre cible ;
- une tâche type copiée dans chaque périmètre cible, sans tâche d'origine ;
- une entité nouvelle qui regroupe des tâches.

Une copie sans origine ne montre rien au périmètre qui demande. Une entité nouvelle demande ses propres droits, ses écrans et son flux. Le premier modèle garde tout ce que la tâche sait déjà faire : statut, personnes assignées, verrou, notifications, score, avancement.

## Décision

### Tâche partagée et déclinaison

- Une **tâche partagée** est une tâche d'un périmètre, déclinée dans d'autres périmètres de la même activité, pour la même période.
- Une **déclinaison** est la tâche créée dans un périmètre cible. Elle vit comme toute tâche de ce périmètre : son statut, ses personnes assignées, son échéance et sa version lui sont propres.
- La déclinaison porte `origineId`, l'identifiant de sa tâche partagée. Une déclinaison ne se décline pas : le lien a un seul niveau.
- Une tâche partagée a au plus une déclinaison par périmètre. Son propre périmètre n'en reçoit pas.
- Les périmètres cibles appartiennent à l'activité de la tâche partagée, et ne sont pas archivés.

### Statuts

- Le statut de la tâche partagée reste manuel. Il ne se calcule jamais depuis ses déclinaisons : la personne qui coche une tâche reste connue du serveur, pour le statut vu et pour le score.
- La tâche partagée affiche l'état de chaque déclinaison et un compte, par exemple « 6 faites sur 9 ».
- Abandonner une tâche partagée ne change aucune déclinaison. Abandonner une déclinaison ne change rien d'autre.
- Modifier une tâche partagée ne modifie pas ses déclinaisons. Un report explicite vers les déclinaisons encore intactes reste possible plus tard.

### Accord du périmètre cible

- Une personne qui écrit dans un périmètre y crée une tâche partagée et la **propose** à d'autres périmètres. Chaque déclinaison attend alors l'**accord** du périmètre cible.
- Une personne qui écrit dans le périmètre cible accepte ou refuse la déclinaison.
- Tant qu'elle n'est pas acceptée, une déclinaison n'entre ni dans les tâches du périmètre cible, ni dans son avancement, ni dans les rappels, ni dans le score. Elle apparaît dans les déclinaisons à accepter du périmètre cible, et sur la tâche partagée.
- Un admin de l'activité crée une tâche partagée sans attendre d'accord : ses déclinaisons sont acceptées d'office. Il impose aussi une déclinaison refusée ou en attente.
- Le journal garde chaque étape : proposée, acceptée, refusée, imposée. Les admins de l'activité lisent cet historique.
- Une déclinaison que le contenu déclare est acceptée d'office : l'organisation l'a décidée en écrivant son contenu.

### Fiche

- Une déclinaison ne cite qu'une fiche commune de l'activité. Les personnes du périmètre cible ne lisent pas les fiches d'un autre périmètre (ADR 0014).

### Contenu

- Une tâche type porte une clé `declinaison`, avec un groupe de périmètres ou une liste de périmètres. Elle peut y donner un titre, une description, une échéance et une fiche commune propres aux déclinaisons.
- La forme actuelle d'une tâche type reste valide.
- Un périmètre cible ne déclare pas lui-même le modèle qu'il reçoit. Une tâche se retrouve par sa période, son périmètre et son modèle : cette règle garde la clé unique.
- L'import crée la tâche partagée, puis une déclinaison par périmètre cible qui n'en porte pas. Un périmètre ajouté à un groupe reçoit sa déclinaison à l'import suivant.
- Un périmètre cible qui porte déjà une tâche de même modèle la garde telle quelle : l'import la rattache à sa tâche partagée et le signale. Une organisation partage ainsi une tâche après un premier import, sans doublon.
- L'export réécrit les tâches types telles que le contenu les déclare.

### Score, avancement et notifications

- Une déclinaison ne donne aucun point de création. Sa réalisation compte comme celle de toute tâche.
- Chaque tâche compte dans l'avancement de son périmètre : la tâche partagée dans le sien, chaque déclinaison acceptée dans le sien.
- Les personnes du périmètre cible apprennent dans l'application qu'une déclinaison attend leur accord. Les personnes du périmètre d'origine apprennent qu'elle est acceptée, refusée ou faite. Aucun de ces événements n'envoie de mail immédiat.

## Conséquences

- Une migration additive ajoute à `Tache` les colonnes `origineId`, `accord`, `accordParId` et `accordLe`, et un index unique sur `(origineId, perimetreId)`. Cette clé est bornée par la tâche partagée, elle-même rangée dans une activité (invariant 18).
- Une tâche partagée ne se supprime pas tant qu'une déclinaison la cite. Une tâche ne se supprime déjà pas dans l'application.
- Le contrat GraphQL gagne les champs `origine`, `declinaisons` et `accord` de la tâche, et les mutations qui proposent, accordent et imposent une déclinaison.
- Les lectures de tâches écartent les déclinaisons qui ne sont pas acceptées.
- L'export complet d'une organisation porte l'origine et l'accord de chaque tâche.
- Le glossaire gagne « tâche partagée », « déclinaison » et « accord ».

## Revue de sécurité

- La seule écriture nouvelle hors de son périmètre est la proposition d'une déclinaison. Elle ne donne aucun droit sur la déclinaison : le périmètre cible l'accepte, la refuse, la modifie et l'abandonne.
- Une proposition ne vise que des périmètres de l'activité de la tâche partagée. Un périmètre d'une autre activité ou d'une autre organisation donne le même refus qu'un périmètre inconnu.
- Lire une tâche partagée ou une déclinaison demande de consulter son périmètre (ADR 0014). Les deux périmètres appartiennent à la même activité : toute personne qui consulte l'un consulte l'autre.
- Qui a accepté ou refusé une déclinaison n'est lisible que par les admins de l'activité.
- Les tests prouvent chaque refus : sans session, en consultation seule, depuis une autre activité, vers une autre organisation, sur une période archivée.
