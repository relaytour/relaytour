# ADR 0028 — Assigner une tâche entre référentes et référents

- **Statut** : acceptée
- **Date** : 2026-10-10
- Amende les ADR 0010 et 0011 sur un point : qui assigne une autre personne à une tâche.

## Contexte

Depuis l'ADR 0010, une référente ou un référent s'assigne une tâche ou s'en retire. Seul un admin de l'activité assigne ou retire une autre personne. L'ADR 0011 range ce geste parmi les actions de gestion, avec l'affectation et l'effectif.

Le contact principal d'un périmètre a demandé à répartir les tâches entre les membres de son équipe. La règle l'oblige à passer par un admin de l'activité, ou à demander à chaque membre de s'assigner.

Trois options étaient possibles :

- nommer le contact principal admin de l'activité ;
- créer un rôle de gestion par périmètre, comme l'ADR 0011 le laisse ouvert ;
- laisser chaque personne du périmètre assigner les autres.

La première option ouvre tous les périmètres de l'activité à une personne qui en coordonne un seul. La deuxième ajoute un troisième niveau de droits, avec ses contrôles et ses refus. Le besoin exprimé est une répartition du travail au sein d'une équipe qui se connaît.

Assigner une personne ne lui ouvre aucun accès : elle écrit déjà dans le périmètre. Le geste se défait en un clic, le journal garde son auteur et la personne assignée en est prévenue.

## Décision

- Une personne qui écrit dans un périmètre assigne une tâche de ce périmètre à une autre personne, ou l'en retire. La règle d'écriture ne change pas : une personne affectée au périmètre pour la période, ou un admin de l'activité, tant que la période n'est pas archivée.
- La personne assignée reste une personne affectée au périmètre pour la période. Le serveur refuse toute autre personne.
- Une déclinaison qui attend un accord, ou refusée, ne s'assigne toujours pas (ADR 0026).
- Assigner une personne ne demande aucune confirmation. L'espace organisateur affiche un message qui nomme la personne et propose d'annuler le geste.
- Retirer une autre personne d'une tâche demande une confirmation dans l'espace organisateur. Se retirer soi-même n'en demande pas.
- Les notifications ne changent pas. La personne assignée ou retirée reçoit une notification dans l'application, et une notification push si elle l'a activée (ADR 0024). Le texte nomme l'auteur du geste. Les autres référentes et référents du périmètre l'apprennent dans l'application.
- Le journal garde l'auteur du geste et la personne concernée, comme aujourd'hui.
- Les autres actions de gestion restent réservées aux admins de l'activité : affecter une personne à un périmètre, fixer l'effectif, désigner le contact principal.
- Le contact principal reste une information, sans droit supplémentaire.

## Conséquences

- Aucune migration. L'API ne change pas de forme : `assignerTache` garde ses arguments, et accepte `personneId` pour toute personne qui écrit dans le périmètre.
- Les tests qui prouvaient le refus d'assigner une autre personne changent de sens. Ils prouvent désormais trois refus : une personne en consultation n'assigne personne, une personne du périmètre n'assigne pas une personne qui n'y est pas affectée, et une période archivée reste en lecture seule.
- Le test du contact principal garde les refus de l'effectif et de la désignation d'un autre contact.
- La carte d'une tâche montre le bouton « Assigner » à toute personne qui écrit dans le périmètre, et plus seulement aux admins.
- Un rôle de gestion par périmètre reste possible plus tard, pour d'autres gestes. Il demanderait une nouvelle ADR.

## Revue de sécurité

- Le contrôle d'accès de `assignerTache` reste `exigerEcriture`, lu dans l'organisation active. Une tâche d'une autre organisation, d'une autre activité ou d'un périmètre où la personne n'écrit pas reçoit le même refus qu'avant.
- La liste des personnes assignables est celle des référentes et référents du périmètre, que toute personne en consultation lit déjà (ADR 0014). Le changement n'expose aucun nom nouveau.
- Une personne ne peut pas en assigner une autre hors de son périmètre : le serveur vérifie l'affectation de la personne assignée, et non la liste envoyée par le navigateur.
