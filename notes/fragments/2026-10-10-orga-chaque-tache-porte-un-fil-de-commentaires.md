---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.16.0
fr:
  titre: >-
    Chaque tâche porte un fil de commentaires
  texte: >-
    Le bouton « Commenter » d'une tâche ouvre son fil. Vous y écrivez un compte
    rendu, une information ou une question, avec votre nom et la date. Le fil
    montre aussi l'historique de la tâche : création, modifications, assignations
    et changements de statut. Une adresse web écrite dans un commentaire devient
    un lien. Les personnes assignées à la tâche reçoivent une notification, sans
    mail immédiat. Vous modifiez et supprimez vos propres commentaires.
en:
  titre: >-
    Each task has a comment thread
  texte: >-
    The “Comment” button on a task opens its thread. You write a report, a piece
    of information, or a question there, with your name and the date. The thread
    also shows the task’s history: creation, edits, assignments, and status
    changes. A web address written in a comment becomes a link. The task’s
    assignees receive a notification, with no immediate email. You edit and
    delete your own comments.
---

ADR 0029. `FilTache` lit `filTache` à l'ouverture du volet ; la carte lit le
nombre de commentaires par `commentairesDeLaPeriode`. `lib/liens.ts` découpe les
adresses : une adresse de l'espace organisateur s'ouvre dans le même onglet, une
autre adresse dans un nouvel onglet.
