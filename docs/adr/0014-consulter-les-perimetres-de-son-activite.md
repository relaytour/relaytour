# ADR 0014 — Consulter les périmètres de son activité

- **Statut** : acceptée
- **Date** : 2026-10-04
- Complète l'ADR 0010. Remplace, dans l'ADR 0012, les règles « un périmètre affecté mène à sa page » et « les tâches, les fiches et les pages de périmètre restent réservées aux personnes affectées et aux admins ».

## Contexte

Une personne affectée à un périmètre lit ses tâches, ses fiches et son équipe. Elle ne lit rien des autres périmètres de la même activité : le serveur lui répond par un refus.

Cette règle isole les périmètres les uns des autres. Deux limites sont apparues pendant la préparation d'une édition :

- Une référente ne sait pas où en est un périmètre dont son travail dépend. Elle ne voit ni ses tâches en cours, ni ses retards, ni les personnes à solliciter.
- Une personne qui hésite à rejoindre un autre périmètre ne peut pas regarder ce qui s'y fait avant de formuler un souhait.

Deux options étaient possibles :

- élargir la règle de lecture à tous les périmètres de l'activité ;
- ajouter un niveau distinct, limité aux tâches et à l'équipe.

La règle de lecture ouvre aussi les fiches de périmètre et la recherche. Le besoin exprimé porte sur les tâches et sur leur avancement, sans intervention.

## Décision

### Un niveau de consultation

- Une personne **consulte** un périmètre quand elle voit son activité : elle l'administre, ou elle y a été affectée au moins une fois (ADR 0010).
- La consultation ouvre, pour chaque périmètre de l'activité et pour chaque période : les tâches (titre, description, échéance, statut, retard), l'avancement, les référentes et référents, le contact principal et les personnes assignées.
- Les personnes sont désignées par leur nom. Leur adresse reste réservée à elles-mêmes et aux admins.
- Le rétroplanning couvre tous les périmètres non archivés de l'activité.

### Ce que la consultation n'ouvre pas

- Elle ne donne aucun droit d'écriture. Créer, modifier, assigner et changer un statut restent réservés aux personnes affectées à la période et aux admins de l'activité.
- Les fiches de périmètre gardent la règle de lecture : les admins de l'activité, et les personnes affectées au périmètre au moins une fois.
- La recherche garde la règle de lecture, pour les tâches, les fiches et les personnes.
- « Qui a coché » et « qui a réalisé » une tâche restent visibles de la seule personne qui a coché et des admins.
- Les tâches à prendre et la liste « Vos périmètres » ne portent que sur les périmètres de la personne.
- Une personne en découverte (ADR 0012) ne consulte rien. Elle garde la page « Tous les périmètres » et ses souhaits.

### Contrôles du serveur

- `peutConsulterPerimetre` exige une session, un périmètre de l'organisation active et une activité visible. `exigerConsultation` protège les tâches, l'avancement, les référent·es et le contact principal d'un périmètre.
- `perimetresLisibles` et `peutModifierPerimetre` ne changent pas. Les fiches, la recherche et toutes les écritures continuent de passer par eux.
- Le champ `Perimetre.acces` vaut `COMPLET`, `CONSULTATION` ou `AUCUN`. L'espace organisateur s'en sert pour n'afficher que ce que la personne peut lire.

### Espace organisateur

- La page « Tous les périmètres » propose « Consulter les tâches » sur chaque périmètre où la personne n'est pas affectée. Une personne en découverte n'a pas ce lien.
- La page d'un périmètre consulté affiche un bandeau, masque les fiches et ne propose aucune action. Elle renvoie vers « Tous les périmètres » pour formuler un souhait.
- La page d'un périmètre et le rétroplanning filtrent les tâches en retard.

## Conséquences

- Aucune migration. La règle s'appuie sur les activités visibles, déjà calculées une fois par requête.
- Les tests qui prouvaient le refus des tâches d'un autre périmètre prouvent désormais la consultation. De nouveaux tests prouvent chaque refus conservé : membre sans affectation, fiches, adresses, écriture.
- Une personne affectée à un seul périmètre voit dans le rétroplanning les tâches de toute l'activité. La bascule « Mes périmètres » ramène la liste à ses périmètres.
- Les périmètres archivés et les périodes archivées se consultent comme les autres.
- Le mode d'emploi des référentes et référents décrit la consultation.

## Revue de sécurité

- La consultation renvoie des noms de personnes à des membres de la même activité. Chaque liste passe par un contrôle du serveur (invariant 1), et aucune adresse n'est renvoyée.
- Une activité invisible reste refusée comme une activité d'une autre organisation. `exigerActivite` et `exigerEdition` s'appliquent avant toute lecture.
- La description d'une tâche est un texte libre, désormais lu par toute l'équipe de l'activité. Le mode d'emploi rappelle de ne pas y écrire de coordonnée personnelle.
- Un souhait ne donne toujours aucun accès. Seule une affectation ou un rôle d'admin rend une activité visible.
