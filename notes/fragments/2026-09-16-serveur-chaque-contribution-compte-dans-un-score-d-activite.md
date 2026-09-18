---
cible: serveur
type: fonctionnalite
audience: staff
etat: prevu
fr:
  titre: >-
    Chaque contribution compte dans un score d'activité
  texte: >-
    Les tâches réalisées, les tâches créées et le travail sur les fiches
    donnent des points pour chaque édition. Une tâche faite à temps rapporte un
    point de plus, et une tâche rouverte perd ses points. Chaque personne voit
    son propre score ; seuls les admins voient le classement.
---

Phase 5 du plan de l'espace organisateur.

- lib/score.ts : calcul à partir de l'état actuel des tâches et des activités
  de fiches (une fois par fiche et par jour), période d'édition pour les fiches.
- Requêtes monScore, baremeScore, classement (admin).
- 7 tests d'intégration.
