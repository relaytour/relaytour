# ADR 0012 — Découvrir les périmètres et rejoindre l'équipe

- **Statut** : acceptée
- **Date** : 2026-09-29
- Complète l'ADR 0010. Remplace sa règle « une personne invitée sans affectation ne voit rien jusqu'à sa première affectation », et la décision « un souhait est noté par un admin et visible des admins seulement ».

## Contexte

Une organisation constitue son équipe à partir d'une réunion, d'une fiche d'intérêt ou de mails. Trois limites sont apparues pendant la constitution d'une équipe réelle :

- Un périmètre n'a qu'un nom. Une personne qui découvre l'activité ne sait pas ce que recouvre « Ville et lieux » ou « Journée plage et ateliers ».
- Une personne invitée sans affectation se connecte sur un espace vide. Elle ne voit pas les périmètres de l'activité et ne peut pas dire lesquels l'intéressent.
- Une affectation ou un changement de rôle n'envoie aucun mail. La personne découvre son nouveau périmètre par hasard, sans sa description ni le mode d'emploi de son rôle.

## Décision

### Description d'un périmètre

- Un périmètre porte une description facultative, d'une ou deux phrases et de 400 caractères au plus.
- Elle se déclare dans `perimetres.yaml`. L'import et l'export la reprennent, comme le reste du contenu (ADR 0009). Les admins la modifient dans la page « Périmètres ».
- La page du périmètre, la page « Tous les périmètres » et les mails d'équipe l'affichent.

### Page « Tous les périmètres »

- Une entrée « Tous les périmètres » ouvre la section « Périmètres » du menu. Elle est toujours visible dans une activité visible.
- La page range les périmètres de l'activité en trois blocs : vos périmètres (vos affectations), vos souhaits, puis les autres périmètres. Chaque bloc suit les groupes de l'activité. Chaque périmètre montre son nom, son groupe, sa couleur et sa description.
- Un périmètre affecté mène à sa page. La page ne montre ni tâche, ni fiche, ni nom de personne, ni souhait d'une autre personne.
- Chaque périmètre indique le nombre de personnes encore recherchées pour la période : l'effectif moins les affectations, selon la règle de la page « Postes à pourvoir ». Ce nombre est une information : il n'empêche aucun souhait.

### Visibilité d'une activité

- Une personne voit une activité si elle l'administre, si elle y a été affectée, si elle y a un souhait, ou si l'activité est **ouverte aux souhaits**.
- « Ouverte aux souhaits » est un réglage de l'activité, désactivé par défaut. Un admin de l'activité l'active pour que tous les membres de l'organisation découvrent ses périmètres.
- Une activité visible sans affectation ne donne accès qu'à la page « Tous les périmètres » et au mode d'emploi. Les tâches, les fiches et les pages de périmètre restent réservées aux personnes affectées et aux admins, comme le prévoit l'ADR 0010.

### Souhaits formulés par la personne

- Une personne formule ou retire ses propres souhaits, pour la période ouverte d'une activité visible. Un admin garde la main sur tous les souhaits.
- Un souhait reste une information : il ne donne aucun accès, et il n'est jamais exporté dans Git.
- Une personne voit ses propres souhaits. Les souhaits des autres restent visibles des seuls admins.

### Mails d'équipe

- Le mail d'invitation liste les périmètres de la personne, avec leur description. Sans périmètre, il explique que la personne peut formuler ses souhaits dans « Tous les périmètres » et qu'un admin l'affectera ensuite.
- Un mail « Votre place dans l'équipe a changé » part après une nouvelle affectation ou un changement de rôle (admin d'une activité, admin de l'organisation). Il présente chaque nouveau périmètre avec sa description, et joint le mode d'emploi du rôle.
- Les changements d'une même personne se regroupent pendant 10 minutes et donnent un seul mail. Ils passent par des notifications, qui ne stockent que des identifiants.
- Aucun mail ne part pour un souhait, pour la désignation d'un contact principal, ni pour le retrait d'une affectation.

## Conséquences

- Une migration additive ajoute `Perimetre.description`. Une autre ajoute le réglage d'activité, faux par défaut : aucune activité existante ne change de visibilité.
- Les contrôles d'accès distinguent désormais la visibilité d'une activité (page « Tous les périmètres ») de la lecture d'un périmètre (tâches et fiches). La table des refus croisés couvre les nouvelles opérations, et un test prouve qu'une personne sans affectation ne lit ni tâche ni fiche.
- Les modes d'emploi décrivent la nouvelle page pour chaque rôle.

## Revue de sécurité

- La page « Tous les périmètres » ne renvoie aucune donnée personnelle d'une autre personne.
- Une personne ne modifie que ses propres souhaits, et seulement sur une période ouverte d'une activité visible de son organisation active.
- Le réglage « ouverte aux souhaits » ne s'applique qu'aux membres de l'organisation de l'activité.
