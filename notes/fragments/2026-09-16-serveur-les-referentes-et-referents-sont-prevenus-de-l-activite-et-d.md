---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Les référentes et référents sont prévenus de l'activité et des échéances
  texte: >-
    Chaque création, prise en charge ou modification de tâche prévient les
    autres personnes du périmètre. Un mail part tout de suite quand une autre
    personne modifie une de vos tâches, et chaque matin pour les échéances à
    7 jours, à la veille et les retards. Un résumé regroupe le reste, chaque
    lundi ou chaque jour.
en:
  titre: >-
    Coordinators are notified of activity and due dates
  texte: >-
    Each task creation, claim, or edit notifies the other people in the area. An
    email is sent immediately when another person edits one of your tasks, and
    each morning for due dates 7 days out, the day before, and overdue tasks. A
    digest groups the rest, each Monday or each day.
---

Phase 4 du plan de l'espace organisateur.

- Modèles Notification (clé unique pour les rappels) et PreferenceNotification.
- lib/notifications.ts : notifier, texte composé à la lecture.
- jobs/planification.ts : genererRappels (6 h 30), personnesAResumer (7 h),
  planifiés dans le worker (BullMQ, Europe/Paris).
- Mails rappels-echeance et resume avec List-Unsubscribe ; listes dans les gabarits.
- Commande planification:lancer, compilée dans l'image. 9 tests d'intégration.
