---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.17.0
fr:
  titre: >-
    Les notifications d'admin ont leur écran
  texte: >-
    L'écran « Notifications d'admin », en tête du menu de gestion, réunit les
    demandes, les invitations acceptées et les nouvelles de votre équipe. Il les
    range par activité, puis par périmètre, avec un nombre de non lues pour
    chaque groupe. Vous apprenez ainsi qu'un autre admin a affecté ou nommé une
    personne, ou qu'une personne a formulé un souhait. Vos préférences règlent ces
    nouvelles dans une section « Vos rôles d'admin ».
en:
  titre: >-
    Admin notifications have their own screen
  texte: >-
    The “Admin notifications” screen, at the top of the management menu, brings
    together requests, accepted invitations, and news about your team. It sorts
    them by activity, then by area, with an unread count for each group. You
    learn, for example, that another admin assigned or appointed a person, or
    that a person stated an interest. Your preferences control these updates in
    a “Your admin roles” section.
---

ADR 0033. Route `/<activité>/admin/notifications` (`NotificationsAdmin.tsx`),
entrée de menu avec son compteur, ligne de renvoi dans le tiroir de la cloche.
Préférences `applicationEquipe`, `resumeAdmin` et famille de push `pushEquipe`.
