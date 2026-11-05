---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.28.0
fr:
  titre: >-
    Une tâche existante se rattache à une tâche partagée
  texte: >-
    Le menu « Autres actions » d'une tâche propose « Rattacher une tâche
    existante ». La tâche choisie, dans un autre périmètre, devient une déclinaison
    de la vôtre. Elle garde son titre, son statut, ses personnes assignées et ses
    commentaires. Le détail de la tâche partagée propose « Détacher » pour retirer
    ce lien. Ces deux gestes demandent d'écrire dans les deux périmètres.
en:
  titre: >-
    An existing task can be linked to a shared task
  texte: >-
    The "More actions" menu of a task offers "Link an existing task". The chosen
    task, in another area, becomes a derived task of yours. It keeps its title,
    status, assignees and comments. The detail of the shared task offers "Unlink"
    to remove this link. Both actions require write access to both areas.
---

`rattacherDeclinaison` et `detacherDeclinaison` (ADR 0061) dans
`packages/server/src/schema/taches.ts`, deux étapes de journal
(`DECLINAISON_RATTACHEE`, `DECLINAISON_DETACHEE`) ajoutées par une migration
additive. `RattacherTache.tsx` choisit le périmètre puis la tâche ;
`DeclinaisonsTache.tsx` porte le bouton « Détacher ».
