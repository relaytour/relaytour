# ADR 0010 — Admins d'activité et visibilité des activités

- **Statut** : acceptée
- **Date** : 2026-09-22
- Complète l'ADR 0008. Remplace sa règle « un admin voit toutes les activités de son organisation ; un membre voit les périmètres où il est affecté, activité par activité ».

## Contexte

Depuis l'ADR 0008, une organisation porte plusieurs activités. Deux limites sont apparues :

- Le rôle ADMIN vaut pour toute l'organisation. Une section ou un événement ne peut pas avoir ses propres responsables sans leur ouvrir toutes les autres activités, les comptes et l'identité de l'organisation.
- Toute personne connectée voit toutes les activités ouvertes de son organisation, y compris celles où elle n'a aucune affectation. Elle y lit les fiches communes, les périodes et la liste des périmètres.

## Décision

### Deux niveaux d'admin

- **Admin de l'organisation** (`Appartenance.role = ADMIN`). Cette personne administre toutes les activités. Elle seule crée et archive une activité, nomme les admins d'activité et les admins de l'organisation, modifie le nom, le rôle ou l'archivage d'un compte, et gère l'identité, le thème et l'export du contenu de l'organisation. Elle seule accorde un droit de rédaction sur toutes les fiches.
- **Admin d'une activité** (table `AdminActivite`). Cette personne reste membre de l'organisation. Dans son activité, elle a les droits d'un admin : périodes, périmètres, affectations, effectifs, souhaits, postes à pourvoir, avancement, classement, fiches, historique des fiches, droits de rédaction par périmètre, identité de l'activité. Elle invite des personnes comme membres, et relance l'invitation de son équipe.
- Une personne peut administrer plusieurs activités. Un admin d'activité ne nomme pas d'autre admin.

### Visibilité des activités

- Une personne voit une activité si elle l'administre, ou si elle a été affectée à l'un de ses périmètres, quelle que soit la période. L'admin de l'organisation voit toutes les activités.
- Une activité invisible n'existe pas pour la personne. Le serveur la refuse comme une activité d'une autre organisation : même code, aucun indice sur son existence.
- Une personne sans activité visible reçoit un refus sur toute requête d'activité. L'espace organisateur lui indique qu'aucune activité ne lui est encore ouverte.
- Une fiche commune reste commune aux périmètres de son activité. Toute personne qui voit l'activité la lit. Une fiche de l'organisation, lisible par tous ses membres hors de toute activité, n'existe pas encore.

### Contrôles du serveur

- Le contexte calcule une fois par requête les activités administrées et les activités visibles (`activitesAdministrees`, `activitesVisibles`), toujours à partir de l'organisation active.
- `exigerActivite` et `exigerEdition` refusent une activité ou une période invisible. Les lectures d'une activité passent par eux.
- Le scope `gestion` ouvre la porte aux admins d'au moins une activité. Chaque résolveur vérifie ensuite l'activité concernée par `exigerAdminDe`, déduite de la période, du périmètre, de la fiche ou de l'activité reçus. Une affectation comme référent·e ne donne jamais un droit de gestion.
- Un retrait hors de ses activités (affectation, souhait, droit de rédaction) ne change rien et répond faux, comme pour une autre organisation.
- L'annuaire de l'organisation (noms et adresses des membres) reste lisible par un admin d'activité, qui en a besoin pour constituer son équipe. Il n'y lit les affectations, les souhaits et les rôles d'admin que dans les activités qu'il administre.
- La recherche ne renvoie les fiches communes que des activités visibles.

## Conséquences

- Une migration additive crée la table `AdminActivite`.
- La table des refus croisés s'exécute depuis trois sessions : l'admin d'une autre organisation, l'admin d'une autre activité de la même organisation, et une référente d'une autre activité. Chaque opération qui reçoit un identifiant refuse ou ne change rien.
- Le menu d'administration s'affiche pour les admins de l'activité affichée. La page « Organisation », la création et l'archivage d'une activité restent réservés aux admins de l'organisation.
- Une personne affectée pour la première fois voit aussitôt l'activité. Une personne invitée sans affectation ne voit rien jusqu'à sa première affectation.

## Revue de sécurité

- Toutes les décisions d'accès partent de l'organisation active du contexte. Un identifiant d'une autre organisation échoue avant tout contrôle d'activité.
- `definirAdminActivite` exige l'admin de l'organisation, une personne membre et une activité de l'organisation.
- Les opérations de l'administration de l'installation (ADR 0008) ne changent pas.
