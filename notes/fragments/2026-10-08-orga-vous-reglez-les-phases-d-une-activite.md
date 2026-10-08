---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
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
---

ADR 0025. La fenêtre de modification d'une activité porte une liste « Phases ».
La mutation `modifierActivite` ne reçoit l'argument `phases` que si la liste
change : une activité qui ne déclare rien garde une colonne nulle, et son
export n'écrit aucune clé `phases`. Le tableau des activités gagne une colonne
« Phases ».
