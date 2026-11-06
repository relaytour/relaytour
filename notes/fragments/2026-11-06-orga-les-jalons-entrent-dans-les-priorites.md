---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Les jalons entrent dans les priorités
  texte: >-
    Le panneau « Priorités » de « Mon espace » liste les jalons avant le prochain
    point d'équipe. Chaque jalon indique combien de ses tâches liées restent
    ouvertes. Un jalon qui attend encore des tâches gagne une place dans les
    priorités, et une tâche qui mène à un jalon proche aussi. Le message
    « Priorités » reprend la liste des jalons.
en:
  titre: >-
    Milestones enter the priorities
  texte: >-
    The "Priorities" panel of "My space" lists the milestones before the next team
    check-in. Each milestone shows how many of its linked tasks are still open. A
    milestone that still waits for tasks moves up in the priorities, and so does a
    task that leads to a nearby milestone. The "Priorities" message includes the
    list of milestones.
---

`lib/priorites.ts` gagne les critères `JALON` (5 points) et `MENE_A_UN_JALON`
(10 points, une fois). La requête `priorites` gagne le champ `jalons`.
`Priorites.tsx` affiche la section, et `listerJalons` (`lib/messages.ts`) la
reprend dans le modèle de message.
