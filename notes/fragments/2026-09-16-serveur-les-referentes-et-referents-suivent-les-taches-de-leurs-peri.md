---
cible: serveur
type: fonctionnalite
audience: organisateurs
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
---

Phase 2 du plan de l'espace organisateur.

- Modèles Tache, TacheAssignation, Activite (migration additive).
- lib/droits.ts : lecture si affecté·e au moins une fois, écriture si
  affecté·e à l'édition non archivée.
- Erreur CONFIRMATION_REQUISE avec les noms des personnes concernées.
- clotureePar et realiseePar lisibles par la personne qui a coché et les admins.
- Mail `tache-modifiee`. 14 tests d'intégration supplémentaires.
