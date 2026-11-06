---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.29.0
fr:
  titre: >-
    La cloche compte les notifications de l'activité ouverte
  texte: >-
    Le nombre de la cloche ne compte plus que les notifications non lues de
    l'activité ouverte. Une seconde pastille, plus petite, s'affiche en bas à
    droite quand des notifications non lues attendent ailleurs, par exemple
    « 2+ ». Elle compte les autres activités qui en ont, et l'organisation pour
    les notifications qui ne concernent aucune activité. Le tiroir des
    notifications place l'activité ouverte en tête, dépliée, et replie les autres
    groupes. Pour les admins, une pastille orange marquée
    d'un bouclier, en haut à gauche de la cloche, compte les notifications d'admin
    non lues. Le bouton « Notifications d'admin » est fixé en bas du tiroir. Au
    survol, la cloche affiche un résumé de ces nombres.
en:
  titre: >-
    The bell counts the notifications of the open activity
  texte: >-
    The bell now counts only the unread notifications of the open activity. A
    second, smaller badge appears at the bottom right when unread notifications
    wait elsewhere, for example “2+”. It counts the other activities that have
    some, and the organization for notifications that concern no activity. The
    notifications drawer shows the open activity first, expanded, and collapses
    the other groups. For
    admins, an orange badge with a shield, at the top left of the bell, counts
    the unread admin notifications. The “Admin notifications” button is fixed at
    the bottom of the drawer. On hover, the bell shows a summary of these counts.
---

La requête `nombreNotificationsNonLuesParActivite` compte les non-lues de la
cloche par activité, avec la règle de rangement du tiroir (`activiteIdDe`).
La requête `notifications` accepte `activiteId` : la cloche charge à part les
notifications de l'activité affichée, que la limite de 60 ne coupe donc pas.
`ListeNotifications` reçoit `activiteCourante` dans la cloche seulement : l'écran
des admins garde son ordre. `nombreNotificationsNonLues` garde le total, qui sert à la pastille de
l'application installée et au bouton « Tout marquer comme lu ».
