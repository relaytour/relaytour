---
cible: serveur
type: correctif
audience: organisateurs
etat: prevu
fr:
  titre: >-
    « Mon espace » affiche de nouveau vos périmètres et vos tâches
  texte: >-
    Depuis la version 0.24.0, « Mon espace » indiquait qu'aucun périmètre ne vous
    était affecté et qu'aucune tâche ne vous était assignée. Vos périmètres, vos
    tâches et les tâches à prendre s'affichent de nouveau.
en:
  titre: >-
    "My space" shows your areas and tasks again
  texte: >-
    Since version 0.24.0, "My space" said that you had no area and no assigned
    task. Your areas, your tasks and the tasks to take are shown again.
---

La requête `MesTaches` lit le fragment `TacheChamps` deux fois. L'ajout de
`realisateurs` (#307) l'a portée à 2 236 points de complexité, au-delà du plafond de
2 000 : le serveur la refusait et l'écran restait vide. Les listes de personnes d'une
tâche et les référents d'un périmètre comptent désormais pour cinq éléments au lieu de
dix. Un test calcule la complexité de chaque document de l'espace organisateur, avec
le `__typename` qu'ajoute Apollo.
