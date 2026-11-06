---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Les mails de rappel se rangent par périmètre
  texte: >-
    Le mail de rappel du matin et les échéances du résumé se rangent par activité,
    puis par périmètre. Dans chaque périmètre, les tâches en retard viennent en
    premier, puis les échéances proches. Une tâche partagée affiche en retrait le
    nombre de ses déclinaisons en retard, en cours et faites. Le retard d'une
    déclinaison prévient aussi les personnes assignées à sa tâche partagée, dans la
    cloche et dans le mail de rappel.
en:
  titre: >-
    Reminder emails are sorted by area
  texte: >-
    The morning reminder email and the due dates of the summary are sorted by
    activity, then by area. In each area, overdue tasks come first, then tasks due
    soon. A shared task shows, indented, how many of its derived tasks are overdue,
    in progress and done. An overdue derived task also alerts the people assigned
    to its shared task, in the bell and in the reminder email.
---

`lib/suivi-courriel.ts` range les lignes ; `courriel/rendu.ts` rend les
sous-groupes, les rubriques et les lignes en retrait. Le type de notification
`DECLINAISON_EN_RETARD` est ajouté par une migration additive, sans push (ADR 0063).
