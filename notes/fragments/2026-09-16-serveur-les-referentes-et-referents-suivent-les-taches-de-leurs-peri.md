---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Les référentes et référents suivent les tâches de leurs périmètres
  texte: >-
    Chaque périmètre a ses tâches pour une édition, avec une échéance, un
    statut et les personnes qui s'en occupent. Modifier la tâche d'une autre
    personne demande une confirmation, et cette personne reçoit un mail. Les
    éditions archivées restent consultables en lecture seule.
en:
  titre: >-
    Coordinators follow the tasks of their areas
  texte: >-
    Each area has its tasks for an edition, with a due date, a status, and the
    people handling them. Editing another person’s task requires a confirmation,
    and that person receives an email. Archived editions remain viewable in
    read-only mode.
---

Phase 2 du plan de l'espace organisateur.

- Modèles Tache, TacheAssignation, Activite (migration additive).
- lib/droits.ts : lecture si affecté·e au moins une fois, écriture si
  affecté·e à l'édition non archivée.
- Erreur CONFIRMATION_REQUISE avec les noms des personnes concernées.
- clotureePar et realiseePar lisibles par la personne qui a coché et les admins.
- Mail `tache-modifiee`. 14 tests d'intégration supplémentaires.
