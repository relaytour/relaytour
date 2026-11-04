---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    « Mon espace » affiche les priorités de la période
  texte: >-
    Le panneau « Priorités » ouvre « Mon espace ». Il montre, pour chaque périmètre,
    les tâches à traiter avant le prochain point de l'agenda global, avec les
    raisons de leur place. Vous filtrez la liste sur vos périmètres, sur les tâches
    à prendre ou sur un groupe. Les personnes qui écrivent dans un périmètre
    épinglent une tâche ou ajustent sa priorité depuis sa carte, jusqu'au prochain
    point.
en:
  titre: >-
    "My space" shows the priorities of the period
  texte: >-
    The "Priorities" panel opens "My space". For each area, it shows the tasks to
    handle before the next check-in of the shared calendar, with the reasons for
    their rank. You can filter the list on your areas, on the tasks to take or on a
    group. People who write in an area can pin a task or adjust its priority from
    its card, until the next check-in.
---

`composants/Priorites.tsx` lit la requête `priorites`. Le filtre se garde dans le
navigateur (`lib/priorites.ts`). `TacheCarte` reçoit le sous-menu « Priorité » et la
pastille de l'ajustement.
