# ADR 0061 — Rattacher une tâche existante à une tâche partagée

- **Statut** : proposée
- **Date** : 2026-11-05
- Complète l'ADR 0026 (tâches partagées). L'import rattachait déjà une tâche existante ; l'espace organisateur le permet désormais, et permet aussi de détacher une déclinaison.

## Contexte

Une tâche partagée reçoit ses déclinaisons de deux façons (ADR 0026) :

- l'espace organisateur crée une tâche neuve dans chaque périmètre cible ;
- l'import crée la déclinaison, ou rattache une tâche du périmètre cible qui porte le même modèle.

Une équipe découvre souvent après coup que deux tâches de périmètres différents se suivent. Une personne de la coordination veut par exemple suivre depuis une tâche de son périmètre les tâches que chaque pôle mène sur le même sujet. Ces tâches existent déjà, avec leur statut, leurs personnes assignées et leur fil de commentaires.

Pour les relier, l'espace organisateur n'offre aujourd'hui qu'une voie : décliner la tâche, puis abandonner la tâche d'origine du pôle. Cette voie perd le fil de commentaires, l'historique du journal et les personnes réalisatrices. Elle laisse aussi deux tâches proches dans le périmètre cible.

Trois options étaient possibles :

- un lien libre entre deux tâches quelconques, sans niveau ni sens ;
- un rattachement qui fait d'une tâche existante une déclinaison, avec les règles de l'ADR 0026 ;
- une tâche « parent » qui regroupe plusieurs tâches d'un même périmètre.

Un lien libre demande ses propres écrans et ne profite ni du compte des déclinaisons ni du score des priorités (ADR 0059). Une tâche parent à plusieurs enfants par périmètre contredit la règle d'une déclinaison par périmètre, sur laquelle reposent l'import, la reconduction et l'index unique. Le rattachement reprend une règle que l'import applique déjà.

## Décision

### Rattacher

- Une personne **rattache** une tâche existante à une tâche partagée : la tâche devient une déclinaison, acceptée d'office.
- Le rattachement ne change ni le titre, ni la description, ni l'échéance, ni le statut, ni les personnes assignées, ni la fiche, ni le fil de la tâche. Il ne change pas non plus sa version.
- La tâche partagée peut ne porter encore aucune déclinaison : le rattachement en fait alors une tâche partagée.
- Les règles de l'ADR 0026 s'appliquent :
  - les deux tâches appartiennent à la même période, donc à la même activité ;
  - la tâche rattachée appartient à un autre périmètre que la tâche partagée, et ce périmètre n'est pas archivé ;
  - la tâche partagée n'est pas une déclinaison, et la tâche rattachée n'est ni une déclinaison ni une tâche partagée : le lien garde un seul niveau ;
  - le périmètre de la tâche rattachée ne porte pas déjà une déclinaison de cette tâche partagée.
- Une tâche faite ou abandonnée se rattache comme une tâche ouverte. Le compte des déclinaisons la reprend avec son statut.

### Détacher

- Une personne **détache** une déclinaison acceptée : elle redevient une tâche ordinaire de son périmètre, avec tout ce qu'elle porte.
- Une déclinaison en attente d'accord ou refusée ne se détache pas. Détacher la ferait entrer dans les tâches du périmètre sans son accord. Le périmètre cible la refuse, ou un admin de l'activité l'impose (ADR 0026).
- Détacher défait un rattachement fait par erreur. Une déclinaison créée par l'espace organisateur ou par l'import se détache de la même façon.
- Un import suivant rattache de nouveau une tâche que le contenu déclare comme déclinaison, puisqu'il la retrouve par son modèle (ADR 0026).

### Droits

- Rattacher et détacher demandent d'écrire dans les deux périmètres : celui de la tâche partagée et celui de la déclinaison. Un admin de l'activité écrit dans tous ses périmètres.
- Aucune proposition ni aucun accord ne s'ajoute. La personne qui écrit dans le périmètre de la tâche rattachée donne son accord par le geste même. Une tâche existante ne disparaît donc jamais des listes de son périmètre en attendant une réponse.
- La consultation (ADR 0014) n'ouvre aucun de ces gestes.

### Journal et notifications

- Le journal de la déclinaison garde deux nouvelles étapes : rattachée et détachée, avec leur auteur. L'historique de l'accord, lu par les admins de l'activité, les affiche.
- Le rattachement n'envoie aucune notification. Il ne change rien de ce que l'équipe du périmètre lit sur la tâche, et la personne qui l'a fait écrit dans ce périmètre.
- Le flux des changements (ADR 0017) prévient les deux périmètres, pour que leurs pages se mettent à jour.

### Score

- Une déclinaison ne donne aucun point de création (ADR 0026). Le score se calcule à partir de l'état actuel : la personne qui a créé une tâche rattachée perd son point de création, et le retrouve si la tâche est détachée. L'import applique déjà cette règle à une tâche qu'il rattache.

## Conséquences

- Une migration additive ajoute `DECLINAISON_RATTACHEE` et `DECLINAISON_DETACHEE` à l'énumération `TypeJournal`.
- Le contrat GraphQL gagne les mutations `rattacherDeclinaison(id, tacheId)` et `detacherDeclinaison(id)`, et les étapes `RATTACHEE` et `DETACHEE` de `EtapeAccord`.
- La carte d'une tâche propose « Rattacher une tâche existante » à côté de « Décliner dans d'autres périmètres ». La fenêtre ne propose que les tâches que la personne peut rattacher.
- La liste des déclinaisons d'une tâche partagée propose « Détacher » sur chaque déclinaison acceptée, avec une confirmation.
- La reconduction d'une édition reprend une tâche rattachée comme toute déclinaison.
- L'export complet d'une organisation porte déjà l'origine de chaque tâche. L'export du contenu ne change pas : les tâches types décrivent ce que le contenu déclare.

## Revue de sécurité

- `rattacherDeclinaison` vérifie l'écriture dans le périmètre de chaque tâche avec `exigerEcriture`, lue dans l'organisation active. Une tâche d'une autre organisation, d'une autre activité ou d'un périmètre où la personne n'écrit pas reçoit le même refus qu'avant.
- `detacherDeclinaison` vérifie la même écriture dans les deux périmètres. Un refus de l'un suffit.
- Un rattachement verrouille ses deux tâches au début de sa transaction, puis relit les règles du lien. Une déclinaison verrouille aussi sa tâche partagée. Deux gestes simultanés ne créent donc jamais un second niveau de lien.
- Un détachement ne s'écrit que si la tâche a toujours la même origine. L'index unique sur `(origineId, perimetreId)` refuse deux rattachements simultanés dans un même périmètre.
- Les tests prouvent chaque refus : sans session, en consultation seule, sans écriture dans l'un des deux périmètres, depuis une autre organisation, sur une période archivée, et pour chaque règle du lien.
