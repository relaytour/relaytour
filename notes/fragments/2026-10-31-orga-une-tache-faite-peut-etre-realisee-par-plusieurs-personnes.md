---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Une tâche faite peut être réalisée par plusieurs personnes
  texte: >-
    Quand vous marquez une tâche comme faite, l'application propose les personnes
    assignées comme personnes réalisatrices. Vous pouvez en ajouter ou en retirer.
    Chaque personne réalisatrice reçoit les points de la tâche dans le score de
    participation.
en:
  titre: >-
    A completed task can be done by several people
  texte: >-
    When you mark a task as done, the app suggests the assigned people as the
    people who did it. You can add or remove people. Each of them receives the
    task's points in the participation score.
---

Nouvelle table `TacheRealisation` (ADR 0055), recopie de `Tache.realiseeParId`.
`changerStatutTache` reçoit `realisateurs` ; `realiseeParId` et `realiseePar` restent,
dépréciés, pour les applications installées.
