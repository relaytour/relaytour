# ADR 0056 — Module « Classement »

- **Statut** : proposée
- **Date** : 2026-10-31
- Complète l'ADR 0052 (modules d'une activité) et l'ADR 0055 (charge de l'équipe). Modifie la règle de visibilité du score de participation.

## Contexte

Le score de participation n'est visible que par la personne concernée et par les admins. Les admins d'une activité lisent le classement de chaque édition dans l'écran « Classement ». La décision de 2026-09-16 prévoyait de trancher un palmarès public en fin d'édition.

Certaines équipes veulent rendre le classement visible pendant l'édition, pour valoriser les contributions. D'autres veulent garder le score privé. Le choix revient donc à chaque activité.

L'ADR 0052 offre déjà le mécanisme : un module qu'un admin de l'activité active ou désactive. Une valeur nulle de `Activite.modules` active pourtant tous les modules. Un nouveau module suivant cette règle rendrait le score visible dans toutes les activités existantes sans décision de leurs admins.

## Décision

### Le module

- Un quatrième module s'ajoute : `CLASSEMENT`.
- Module inactif, le score reste privé : la personne lit son score, les admins de l'activité lisent le classement. C'est la règle actuelle.
- Module actif, toute personne qui voit les tâches de l'activité lit le classement de chaque édition : une personne affectée à un périmètre de l'activité, ou un admin. Une personne en découverte (ADR 0045) ne le lit pas.
- Module actif, la page « Charge » (ADR 0055) montre aussi à cette équipe le nombre de tâches réalisées par chaque personne.

### Inactif par défaut, partout

- `CLASSEMENT` est le seul module qu'une valeur nulle de `Activite.modules` n'active pas. Les activités existantes gardent donc un score privé.
- Une activité créée démarre sans module, comme l'ADR 0052 le prévoit.
- Les admins de l'activité l'activent dans l'écran « Activités ». Le formulaire précise que le classement devient visible par toute l'équipe.
- L'administration de l'installation peut le refuser, comme tout module (`modulesAutorises`).

### Ce qui reste privé

- La règle de la clôture ne change pas : seule la personne qui a coché une tâche et les admins savent qui l'a cochée et qui l'a réalisée. Le classement montre des totaux par personne, pas le détail des tâches.
- Le détail du score d'une autre personne (tâches à temps, fiches créées, fiches modifiées) suit le classement : visible avec le module, réservé aux admins sans lui.
- Une personne sans point n'apparaît pas dans le classement.

### Effet d'un module désactivé

- Le classement redevient réservé aux admins, sans perte de donnée : le score se calcule toujours à partir de l'état actuel.
- La page « Classement » de l'équipe redirige vers « Mon espace », comme tout module inactif.

## Conséquences

- `lireModules` distingue les modules actifs par défaut et `CLASSEMENT`, actif seulement s'il figure dans la liste. Quand un admin enregistre les modules d'une activité à valeur nulle, la liste enregistrée nomme explicitement les trois autres modules.
- La requête `classement` s'ouvre aux personnes de l'équipe quand le module est actif. Elle ne demande plus la portée `gestion` mais vérifie l'édition, puis le rôle d'admin ou le module et la consultation de l'activité.
- L'espace organisateur ajoute une page « Classement » dans le menu de l'équipe, affichée seulement avec le module. L'écran des admins reste en place.
- La ligne « Score de participation » des décisions arrêtées change.

## Revue de sécurité

- La garde de `classement` lit le module et les droits côté serveur, dans l'organisation active. Une personne d'une autre activité, en découverte ou sans session reçoit un refus.
- Les tests prouvent le refus module inactif pour une personne non admin, et le refus en découverte module actif.
- Aucun nouveau champ n'expose qui a réalisé une tâche donnée.
