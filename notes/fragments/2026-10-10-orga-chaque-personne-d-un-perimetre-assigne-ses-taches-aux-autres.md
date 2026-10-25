---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.16.0
fr:
  titre: >-
    Chaque personne d'un périmètre assigne ses tâches aux autres
  texte: >-
    Vous assignez une tâche de votre périmètre à une autre personne de son
    équipe, depuis le bouton « Assigner » de la tâche. Cette personne reçoit une
    notification qui porte votre nom. Le message de confirmation propose
    d'annuler. Retirer une autre personne demande une confirmation. Ce geste
    était réservé aux admins de l'activité.
en:
  titre: >-
    Everyone in an area can assign their tasks to others
  texte: >-
    You assign a task of your area to another person on its team, using the
    task’s “Assign” button. That person receives a notification with your name.
    The confirmation message offers to undo. Removing another person asks for
    confirmation. Only activity admins could do this before.
---

`assignerTache` accepte `personneId` pour toute personne qui écrit dans le
périmètre (ADR 0028). La personne assignée reste une personne affectée au
périmètre pour la période.
