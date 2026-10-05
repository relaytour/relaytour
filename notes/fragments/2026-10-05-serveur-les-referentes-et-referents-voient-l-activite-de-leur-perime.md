---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Les référentes et référents voient l'activité de leur périmètre
  texte: >-
    Quand une autre personne modifie une tâche de votre périmètre, change son
    statut, ou crée et modifie une de ses fiches, la cloche vous prévient, même
    si la tâche ne vous est pas assignée. Aucun mail ne part pour ces
    notifications : le résumé les reprend. La cloche affiche le nombre de
    notifications non lues, et une notification mène à la tâche, mise en
    évidence dans la page du périmètre. Vous coupez ces notifications dans vos
    préférences. Quand une autre personne coche une tâche qui vous est
    assignée, le mail et la notification vous l'annoncent sans la nommer.
---

`notifierLePerimetre` (`lib/notifications.ts`) prévient les personnes affectées au
périmètre, sauf l'auteur, les personnes déjà prévenues par mail et celles qui ont
coupé `applicationPerimetre`. Une clé par action, auteur, destinataire et tranche
de dix minutes évite le bruit. Types ajoutés : `TACHE_STATUT`, `FICHE_CREEE`,
`FICHE_MODIFIEE` (migration additive `20261005093000_notifications_du_perimetre`).
Un passage à « faite » ne garde pas son auteur. `marquerNotificationsLues` reste
possible dans une organisation en lecture seule.
