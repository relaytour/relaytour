# ADR 0005 — Licence AGPL-3.0 et indépendance du logiciel

- **Statut** : acceptée
- **Date** : 2026-09-18

## Contexte

Relaytour est un logiciel conçu et écrit par Quentin Fremeaux, qui en détient les droits d'auteur. Il est né à l'occasion d'un rassemblement multisports associatif, dont l'organisation a servi de premier terrain. Le besoin dépasse ce premier cas : toute association ou tout collectif qui organise un événement récurrent doit pouvoir l'utiliser et l'héberger.

## Décision

- Le code est publié sous **AGPL-3.0**. Toute personne peut l'utiliser, le modifier et l'héberger. Une personne qui le modifie pour un service en ligne publie ses modifications.
- **Un seul code.** La gestion de plusieurs organisations (ADR 0006) fait partie du code publié. Il n'existe ni version privée ni couche réservée.
- Le nom Relaytour et son identité visuelle ne sont pas couverts par la licence du code.
- Le contenu d'une organisation (périmètres, fiches, tâches types) n'entre jamais dans ce dépôt. Le dépôt ne contient qu'une organisation d'exemple, fictive et anonyme (`content/exemple`).
- Toute contribution extérieure est acceptée sous AGPL-3.0, sans accord de contribution.

## Alternatives écartées

- **Licences « source disponible »** (FSL, BSL, Elastic License) : elles réservent l'hébergement commercial et ferment les annuaires et aides du logiciel libre.
- **Open core** : une couche multi-organisation privée doublerait la maintenance et n'empêcherait pas un tiers de déployer une pile par client.

## Conséquences

- Aucune donnée personnelle, aucun export, aucun journal ni aucun secret n'entre dans le dépôt, ni dans son historique.
- Les règles de code de l'ADR 0006 s'appliquent dès maintenant : aucune contrainte d'unicité globale sans clé d'organisation, aucune requête qui parcourt toute la base sans filtre, aucune marque en dur.
