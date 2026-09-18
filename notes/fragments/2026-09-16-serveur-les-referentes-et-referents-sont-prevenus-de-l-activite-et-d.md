---
cible: serveur
type: fonctionnalite
audience: staff
etat: prevu
fr:
  titre: >-
    Les référentes et référents sont prévenus de l'activité et des échéances
  texte: >-
    Chaque création, prise en charge ou modification de tâche prévient les
    autres personnes du périmètre. Un mail part tout de suite quand une autre
    personne modifie une de vos tâches, et chaque matin pour les échéances à
    7 jours, à la veille et les retards. Un résumé regroupe le reste, chaque
    lundi ou chaque jour.
---

Phase 4 du plan de l'espace organisateur.

- Modèles Notification (clé unique pour les rappels) et PreferenceNotification.
- lib/notifications.ts : notifier, texte composé à la lecture.
- jobs/planification.ts : genererRappels (6 h 30), personnesAResumer (7 h),
  planifiés dans le worker (BullMQ, Europe/Paris).
- Mails rappels-echeance et resume avec List-Unsubscribe ; listes dans les gabarits.
- Commande planification:lancer, compilée dans l'image. 9 tests d'intégration.
