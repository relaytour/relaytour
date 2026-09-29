# ADR 0011 — Contact principal d'un périmètre

- **Statut** : acceptée
- **Date** : 2026-09-29
- Complète l'ADR 0010, sans en changer les droits.

## Contexte

Un périmètre peut avoir plusieurs référentes et référents pour une édition. Toutes ces personnes ont les mêmes droits : elles lisent le périmètre, créent et modifient ses tâches, changent leur statut et s'assignent elles-mêmes. Les actions de gestion (affecter, assigner une autre personne, fixer l'effectif) restent réservées aux admins de l'activité (ADR 0010).

Les organisations ont besoin de savoir à qui s'adresser en premier sur un périmètre. Une personne coordonne le périmètre ou veille à son bon déroulement. Sans marque dans l'application, cette information reste dans un tableau ou dans les mémoires.

Deux options étaient possibles :

- un niveau d'admin de périmètre, avec des droits de gestion limités à un périmètre ;
- une simple marque sur une affectation, sans droit.

Un niveau d'admin de périmètre ajouterait un troisième niveau de droits, avec ses contrôles et ses refus. Le besoin exprimé est une information, pas un pouvoir.

## Décision

- Une affectation porte une marque `contactPrincipal`. La personne ainsi désignée est le contact principal du périmètre pour l'édition.
- Un périmètre a au plus un contact principal par édition. Désigner une personne retire la désignation précédente.
- Seul un admin de l'activité du périmètre désigne ou retire le contact principal (`definirContactPrincipal`). Une édition archivée reste en lecture seule.
- Le contact principal a exactement les droits des autres référentes et référents. Aucun contrôle d'accès ne lit la marque.
- Toute personne qui lit le périmètre voit son contact principal. L'espace organisateur le place en tête des référent·es, avec une mention.
- Les rappels et les notifications ne changent pas.

## Conséquences

- Une migration additive ajoute la colonne `Affectation.contactPrincipal`, fausse par défaut. MariaDB n'offre pas d'index unique partiel : la mutation garantit l'unicité dans une transaction.
- La table des refus croisés couvre la nouvelle mutation. Un test prouve que le contact principal ne peut ni assigner une autre personne, ni fixer l'effectif, ni désigner un autre contact.
- L'export d'une organisation reprend la marque avec chaque affectation.
- Un rôle de gestion par périmètre reste possible plus tard. Il demanderait une nouvelle ADR et un nom de champ nouveau (invariant 8).
