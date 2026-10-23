# ADR 0045 — Rattachement à une activité et visibilité limitée à ses activités

- **Statut** : proposée
- **Date** : 2026-10-23
- Complète les ADR 0010, 0012 et 0018. Remplace trois règles :
  - dans l'ADR 0012, « une personne voit une activité […] si l'activité est ouverte aux souhaits » ;
  - dans l'ADR 0018, « aucune table ne porte ce lien » et « une demande s'accepte avec au moins un périmètre » ;
  - dans l'ADR 0018, « une personne déclarée sans affectation ni souhait n'entre dans aucune équipe ».

## Contexte

Depuis l'ADR 0012, une activité « ouverte aux souhaits » se découvre par tous les membres de l'organisation. Une personne la voit même quand elle a été invitée dans une autre activité. Deux constats ont suivi :

- Une personne invitée dans une activité a ouvert l'espace organisateur sur une autre activité. L'espace organisateur choisit en effet la première activité de la liste. Elle y a lu des périmètres « au complet », et elle a cru ne trouver aucune place.
- Une personne invitée sans périmètre par un admin de l'organisation n'a aucun lien avec une activité. Elle ne voit des périmètres que grâce aux activités ouvertes à tous.

Une personne ne doit voir que les activités auxquelles elle participe. Il faut donc un lien entre une personne et une activité qui ne passe pas par un périmètre.

## Décision

### Le rattachement

- Un **rattachement** lie une personne à une activité, sans périmètre ni période. La table `RattachementActivite` le porte, avec une ligne au plus par personne et par activité.
- Le rattachement fait entrer la personne dans l'équipe de l'activité (ADR 0018). L'équipe réunit désormais les rattachements, les affectations, les souhaits et les rôles d'admin.
- Le rattachement naît :
  - à chaque affectation, quel que soit son chemin (écran Équipe, invitation, demande acceptée, import, invitation en attente acceptée) ;
  - à une invitation dans une activité, avec ou sans périmètre, dès que la personne est membre ;
  - à une demande acceptée, avec ou sans périmètre ;
  - à l'import d'une équipe, pour une personne déclarée sans affectation ni souhait ;
  - quand un admin rattache un membre depuis l'annuaire ou l'écran Équipe.
- Un admin de l'activité retire le rattachement d'une personne de son équipe. Le serveur refuse ce retrait quand la personne a encore une affectation dans une période non archivée de l'activité, ou un rôle d'admin de l'activité. Le retrait supprime aussi ses souhaits des périodes non archivées de l'activité.
- Retirer la dernière affectation d'une personne ne retire pas son rattachement. La personne reste dans l'équipe, sans périmètre.
- Une affectation d'une période archivée n'empêche pas le retrait du rattachement. Elle garde pourtant la personne dans l'équipe, et lui laisse voir l'activité, comme le prévoit l'ADR 0010.

### Ce que voit chaque personne

| Lien avec l'activité | Accès |
|---|---|
| Admin de l'organisation | Toutes les activités, avec tous les droits |
| Admin de l'activité | Tous les droits dans l'activité (ADR 0010) |
| Affectation dans au moins une période | Consultation de chaque périmètre (ADR 0014) |
| Rattachement ou souhait, sans affectation | Découverte : la page « Tous les périmètres », l'organigramme réduit (ADR 0036) et ses propres souhaits |
| Aucun lien | Aucun : l'activité vaut une activité d'une autre organisation |

- Une activité « ouverte aux souhaits » ne se découvre plus par les membres hors de son équipe.
- Une personne sans aucun lien voit l'écran « Aucune activité ne vous est encore ouverte », comme le prévoit l'ADR 0010.

### Le réglage « ouverte aux souhaits »

- Le réglage garde son nom et sa valeur. Il décide désormais si les personnes de l'équipe formulent elles-mêmes leurs souhaits dans « Tous les périmètres ».
- Une activité fermée aux souhaits montre toujours la page « Tous les périmètres » à son équipe. Seuls ses admins y notent les souhaits.

### Activité affichée par défaut

- À l'ouverture, l'espace organisateur affiche la dernière activité choisie dans le navigateur, si la personne la voit encore.
- Sinon, il affiche la première activité où la personne a un accès complet ou une consultation, avant toute activité en découverte. Le serveur suit la même règle quand une requête ne désigne aucune activité.

### Invitation, demande et import

- Une invitation désigne une activité. Un admin d'activité invite dans l'une de ses activités, avec ou sans périmètre. Un admin de l'organisation peut encore inviter une personne sans activité, par exemple un autre admin de l'organisation.
- Une invitation en attente (ADR 0030) garde les activités à rattacher sans périmètre dans une colonne nouvelle, facultative. L'acceptation rattache la personne à ces activités et à celles de ses lots.
- Une demande s'accepte sans périmètre : la personne est alors rattachée à l'activité de la demande.
- L'import d'une équipe (ADR 0013) rattache à l'activité de l'import chaque personne déclarée, avec ou sans périmètre.
- Le mail d'invitation sans périmètre nomme l'activité et renvoie vers sa page « Tous les périmètres ».
- Un rattachement n'envoie aucun mail à une personne déjà membre, comme un souhait (ADR 0012). Le mail d'équipe part à sa première affectation.

### Reprise des données

- La migration rattache chaque personne à chaque activité où elle a au moins une affectation, toutes périodes confondues.
- Elle rattache aussi chaque personne dont une demande a été acceptée à l'activité de cette demande.
- Une personne invitée sans périmètre avant cette décision n'a laissé aucune trace de l'activité visée. Un admin de l'organisation la rattache depuis l'annuaire.

## Conséquences

- Une migration additive crée la table `RattachementActivite`, avec la clé de l'organisation, et la colonne `InvitationOrganisation.rattachements`. Elle insère les rattachements de la reprise.
- `dansLEquipe` compte le rattachement. `activitesDecouvertes` remplace le réglage « ouverte aux souhaits » par le rattachement. `activitesVisibles` ne change pas.
- `AttributionActivite` gagne le champ `rattachee`. L'annuaire et l'écran Équipe montrent les personnes rattachées sans périmètre.
- Deux mutations nouvelles : `rattacherALActivite` et `retirerDeLActivite`. Chacune publie un signal du flux (ADR 0017).
- L'export complet d'une organisation contient les rattachements. Ils ne sont jamais exportés dans Git.
- Les modes d'emploi décrivent le rattachement et la nouvelle règle de découverte.

## Revue de sécurité

- Une personne ne voit plus une activité où elle n'a aucun lien. La table des refus croisés joue chaque lecture d'activité avec une personne d'une autre activité de la même organisation, activité ouverte aux souhaits comprise.
- `rattacherALActivite` exige un admin de l'activité visée et un membre actif de l'organisation. Un admin d'activité ne rattache qu'une personne de ses équipes, ou une personne qu'il invite par son adresse (ADR 0018).
- `retirerDeLActivite` exige un admin de l'activité. Une personne hors de ses équipes reçoit le même refus qu'un identifiant inconnu.
- Un rattachement ne donne accès à aucune tâche, aucune fiche, aucun agenda ni aucun programme. Seuls une affectation ou un rôle d'admin ouvrent la consultation.
