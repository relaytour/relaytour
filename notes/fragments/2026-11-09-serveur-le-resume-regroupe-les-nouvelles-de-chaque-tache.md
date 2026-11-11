---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Le résumé regroupe les nouvelles de chaque tâche
  texte: >-
    Le résumé par mail regroupe les nouvelles d'une même tâche sur une ligne :
    « Léa s'occupe de la tâche à la place de Paul ». Les commentaires d'une tâche
    tiennent aussi sur une ligne : « Léa et une autre personne ont laissé 3
    commentaires sur la tâche ». Il ne répète plus une
    modification déjà annoncée par un mail immédiat. Au-delà de trente nouvelles,
    il indique combien restent dans l'application. Avec le résumé hebdomadaire, le
    mail des priorités reprend vos nouvelles et remplace le résumé du lundi. Les
    nouvelles arrivées après ce mail partent avec le mail des priorités suivant.
en:
  titre: >-
    The summary groups the updates of each task
  texte: >-
    The email summary groups the updates of a single task on one line: "Léa is
    taking care of the task instead of Paul". The comments on a task also fit on
    one line: "Léa and one other person left 3 comments on the task". It no longer
    repeats a change already
    announced by an immediate email. Beyond thirty updates, it says how many
    remain in the app. With the weekly summary, the priorities email includes your
    updates and replaces the Monday summary. Updates that arrive after this email
    go out with the next priorities email.
---

ADR 0065, lot 3. `fusionnerParTache` (`lib/composition-notifications.ts`) regroupe
les nouvelles d'une tâche. Le mail des priorités gagne la variable `nouvelles`, et
`personnesAResumer` ne sert plus le résumé hebdomadaire après un mail des priorités
des six derniers jours. Le résumé passe à 7 h 05, après les priorités.
