---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Chaque contribution compte dans un score d'activité
  texte: >-
    Les tâches réalisées, les tâches créées et le travail sur les fiches
    donnent des points pour chaque édition. Une tâche faite à temps rapporte un
    point de plus, et une tâche rouverte perd ses points. Chaque personne voit
    son propre score ; seuls les admins voient le classement.
en:
  titre: >-
    Each contribution counts toward a participation score
  texte: >-
    Completed tasks, created tasks, and work on sheets earn points for each
    edition. A task done on time earns one extra point, and a reopened task
    loses its points. Each person sees their own score; only admins see the
    ranking.
---

Phase 5 du plan de l'espace organisateur.

- lib/score.ts : calcul à partir de l'état actuel des tâches et des activités
  de fiches (une fois par fiche et par jour), période d'édition pour les fiches.
- Requêtes monScore, baremeScore, classement (admin).
- 7 tests d'intégration.
