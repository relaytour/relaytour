---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.13.0
fr:
  titre: >-
    Votre téléphone affiche les notifications de l'espace organisateur
  texte: >-
    Les préférences reçoivent le panneau « Notifications sur cet appareil ».
    Une fois activées, votre téléphone ou votre ordinateur vous prévient quand
    une tâche vous est assignée, quand une échéance approche ou quand une
    demande attend votre revue, même application fermée. Sur iPhone, installez
    d'abord l'application sur l'écran d'accueil. Le panneau n'apparaît que si
    votre organisation a ouvert ce canal.
en:
  titre: >-
    Your phone shows organizer workspace notifications
  texte: >-
    The preferences have a new “Notifications on this device” panel. Once turned
    on, your phone or computer alerts you when a task is assigned to you, when a
    due date approaches, or when a request awaits your review, even with the app
    closed. On an iPhone, first install the app on the home screen. The panel
    appears only if your organization has opened this channel.
---

ADR 0024. `PreferencePush`, `lib/push.ts`, gestionnaires `push` et
`notificationclick` de `src/sw.ts`, pastille de l'icône (`setAppBadge`). La
déconnexion retire l'abonnement de l'appareil.
