# ADR 0018 — Personnes d'une activité

- **Statut** : acceptée
- **Date** : 2026-10-06
- Remplace la règle de l'ADR 0010 « l'annuaire de l'organisation reste lisible par un admin d'activité ». Précise l'ADR 0014 (lecture des adresses) et l'ADR 0015 (demande d'une personne déjà membre).

## Contexte

Depuis l'ADR 0010, un admin d'activité lit l'annuaire de toute l'organisation, noms et adresses, pour constituer son équipe. Trois conséquences sont apparues :

- Un admin d'activité affecte à son activité une personne qui n'y a jamais participé, sans que personne ait saisi son adresse.
- Le contrôle de lecture d'une adresse porte sur le rôle (« admin d'au moins une activité ») et non sur l'activité. Un admin de l'activité A, simple référent dans l'activité B, lit les adresses de l'équipe de B.
- Les textes de l'interface annoncent qu'un admin d'activité « ne voit pas les autres activités », alors qu'il en lit toutes les personnes.

Une organisation qui porte des activités indépendantes (plusieurs événements, plusieurs sections) attend que les personnes d'une activité ne soient pas lisibles depuis une autre.

## Décision

### L'équipe d'une activité

- L'équipe d'une activité réunit les membres de l'organisation qui y ont une affectation, un souhait ou un rôle d'admin, toutes périodes confondues.
- Aucune table ne porte ce lien. Il se déduit de `Affectation`, `Souhait` et `AdminActivite` (`dansLEquipe`, `lib/appartenances.ts`).
- Une personne sort de l'équipe quand son dernier lien disparaît. Elle reste membre de l'organisation.

### Ce que lit chaque rôle

- Un admin d'activité lit le nom et l'adresse des personnes de l'équipe des activités qu'il administre (requête `equipe`). Il ne lit jamais la liste des membres de l'organisation.
- L'admin de l'organisation lit l'annuaire complet (requête `personnes`). Il y lit les activités de chaque personne, pour savoir où chacune participe.
- L'adresse d'une personne se lit par elle-même, par un admin de l'organisation, et par un admin d'une activité dont elle fait partie de l'équipe. Toute autre personne lit son nom seulement, là où l'ADR 0014 le permet.
- Une demande indique « déjà membre » à un admin d'activité seulement pour une personne de ses équipes.

### Faire entrer une personne dans l'équipe

- Un admin d'activité invite une personne par son adresse, avec au moins un périmètre souhaité de son activité. Le souhait est le lien qui fait entrer la personne dans l'équipe.
- Le serveur crée le compte, ou rattache le compte existant : un membre d'une autre activité, ou un compte d'une autre organisation. La réponse est la même dans les trois cas.
- Une invitation sans périmètre par un admin d'activité est refusée avant toute lecture de compte.
- Une demande s'accepte avec au moins un périmètre, demandé ou affecté, pour la même raison.
- L'admin de l'organisation invite toujours une personne sans périmètre. Il affecte tout membre à toute activité.

### Ce qu'un admin d'activité peut faire d'une personne

- Il affecte, note un souhait, accorde un droit de rédaction et relance l'invitation pour une personne de ses équipes seulement.
- Une personne hors de ses équipes reçoit le même refus qu'un identifiant inconnu.
- Un admin de plusieurs activités agit sur la réunion de leurs équipes : il lit déjà ces personnes.

## Conséquences

- Aucune migration.
- L'écran « Personnes » d'un admin d'activité montre son équipe. Les sélecteurs des écrans « Équipe » et « Rédaction » proposent les personnes de l'équipe.
- Un membre invité sans périmètre avant cette décision n'apparaît dans aucune équipe. L'admin de l'organisation le retrouve dans l'annuaire, sans activité.
- Un membre rattaché à une équipe par un souhait ne reçoit pas de mail (ADR 0012). Le mail d'équipe part à sa première affectation.
- Dans une activité ouverte aux souhaits, un membre qui formule un souhait entre dans l'équipe : les admins de cette activité lisent alors son adresse.
- La commande `equipe-importer` (ADR 0013) agit comme un admin de l'organisation. Une personne déclarée sans affectation ni souhait n'entre dans aucune équipe.

## Revue de sécurité

- Le refus d'une invitation sans périmètre ne dépend pas de l'adresse : il ne dit rien de l'existence d'un compte.
- Une personne rattachée apparaît dans l'équipe avec le nom de son compte. L'admin qui a saisi son adresse en déduit qu'un compte existait, sans savoir dans quelle activité ni dans quelle organisation.
- Le message « Cette adresse ne peut pas être invitée » indique encore qu'un compte archivé porte l'adresse. Le supprimer demande une invitation qui répond toujours de la même façon, hors de cette décision.
- Les contrôles se prouvent par le refus (invariant 11) : la table des refus croisés joue chaque opération avec une personne d'une autre activité.
