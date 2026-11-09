---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Le résumé regroupe les nouvelles de chaque tâche
  texte: >-
    Le résumé par mail regroupe les nouvelles d'une même tâche sur une ligne :
    « Léa s'occupe de la tâche à la place de Paul ». Il ne répète plus une
    modification déjà annoncée par un mail immédiat. Au-delà de trente nouvelles,
    il indique combien restent dans l'application. Avec le résumé hebdomadaire, le
    mail des priorités reprend vos nouvelles et remplace le résumé du lundi.
en:
  titre: >-
    The summary groups the updates of each task
  texte: >-
    The email summary groups the updates of a single task on one line: "Léa is
    taking care of the task instead of Paul". It no longer repeats a change already
    announced by an immediate email. Beyond thirty updates, it says how many
    remain in the app. With the weekly summary, the priorities email includes your
    updates and replaces the Monday summary.
---

ADR 0065, lot 3. `fusionnerParTache` (`lib/composition-notifications.ts`) regroupe
les nouvelles d'une tâche. Le mail des priorités gagne la variable `nouvelles`, et
`personnesAResumer` ne sert plus le résumé hebdomadaire après un mail des priorités
des six derniers jours. Le résumé passe à 7 h 05, après les priorités.
