---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    La cloche compte les notifications de l'activité ouverte
  texte: >-
    Le nombre de la cloche ne compte plus que les notifications non lues de
    l'activité ouverte, et celles de l'organisation. Une seconde pastille, plus
    petite, s'affiche en bas à droite quand d'autres activités ont des
    notifications non lues. Elle indique le nombre de ces activités, par exemple
    « 2+ ». Le tiroir des notifications place l'activité ouverte en tête, dépliée,
    et replie les autres activités. Pour les admins, une pastille orange marquée
    d'un bouclier, en haut à gauche de la cloche, compte les notifications d'admin
    non lues. Le bouton « Notifications d'admin » est fixé en bas du tiroir. Au
    survol, la cloche affiche un résumé de ces nombres.
en:
  titre: >-
    The bell counts the notifications of the open activity
  texte: >-
    The bell now counts only the unread notifications of the open activity, and
    those of the organization. A second, smaller badge appears at the bottom
    right when other activities have unread notifications. It shows the number
    of these activities, for example “2+”. The notifications drawer shows the
    open activity first, expanded, and collapses the other activities. For
    admins, an orange badge with a shield, at the top left of the bell, counts
    the unread admin notifications. The “Admin notifications” button is fixed at
    the bottom of the drawer. On hover, the bell shows a summary of these counts.
---

La requête `nombreNotificationsNonLuesParActivite` compte les non-lues de la
cloche par activité, avec la règle de rangement du tiroir (`activiteIdDe`).
`ListeNotifications` reçoit `activiteCourante` dans la cloche seulement : l'écran
des admins garde son ordre. `nombreNotificationsNonLues` garde le total, qui sert à la pastille de
l'application installée et au bouton « Tout marquer comme lu ».
