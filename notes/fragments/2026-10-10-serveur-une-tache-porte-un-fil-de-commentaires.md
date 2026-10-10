---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
fr:
  titre: >-
    Une tâche porte un fil de commentaires
  texte: >-
    L'API porte les commentaires d'une tâche : la requête `filTache` rend les
    commentaires et les événements du journal, `commentairesDeLaPeriode` compte
    les commentaires par tâche, et trois mutations écrivent, modifient et suppriment
    un commentaire. Une migration additive crée la table `CommentaireTache`.
---

ADR 0029. Lecture du fil pour qui lit le périmètre, écriture pour qui y écrit.
La notification `TACHE_COMMENTEE` ne porte pas le texte. L'export complet d'une
organisation porte les commentaires de chaque tâche.
