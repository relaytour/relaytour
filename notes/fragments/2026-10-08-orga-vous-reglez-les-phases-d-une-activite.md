---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.14.0
fr:
  titre: >-
    Vous réglez les phases d'une activité
  texte: >-
    L'écran « Activités » permet de modifier les phases d'une activité : leur
    nom, leur ordre et leur dernier jour. Le dernier jour se compte depuis le
    premier jour de la période, par exemple J-120 pour 120 jours avant. La
    dernière phase reçoit toutes les tâches qui suivent. Les tâches changent
    de phase dès l'enregistrement, sans être modifiées. Une activité que vous
    ne réglez pas garde quatre phases : Lancement, Préparation, Derniers
    réglages, Déroulement et bilan.
en:
  titre: >-
    You set the phases of an activity
  texte: >-
    The “Activities” screen lets you edit an activity’s phases: their name,
    their order, and their last day. The last day is counted from the first day
    of the period, for example D-120 for 120 days before. The last phase
    receives all the tasks that follow. Tasks move to their phase as soon as you
    save, without being modified. An activity you do not configure keeps four
    phases: Launch, Preparation, Final adjustments, and Event and review.
---

ADR 0025. La fenêtre de modification d'une activité porte une liste « Phases ».
La mutation `modifierActivite` ne reçoit l'argument `phases` que si la liste
change : une activité qui ne déclare rien garde une colonne nulle, et son
export n'écrit aucune clé `phases`. Le tableau des activités gagne une colonne
« Phases ».
