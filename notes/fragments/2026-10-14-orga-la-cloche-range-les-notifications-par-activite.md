---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.17.0
fr:
  titre: >-
    La cloche range les notifications par activité
  texte: >-
    La cloche compte les notifications de l'organisation affichée. Son tiroir les
    range par activité, en groupes repliables qui portent chacun leur nombre de
    non lues. Chaque notification affiche son périmètre au-dessus de son texte.
    Un encadré signale les nouvelles de vos autres organisations : chacune
    s'ouvre dans un nouvel onglet. Les préférences de notification se règlent
    désormais dans chaque organisation.
en:
  titre: >-
    The bell groups notifications by activity
  texte: >-
    The bell counts the notifications of the organization you are viewing. Its
    drawer groups them by activity, in collapsible groups that each show an
    unread count. Each notification shows its area above its text. A box points
    to news from your other organizations, and each one opens in a new tab.
    Notification preferences are now set in each organization.
---

ADR 0032. `ListeNotifications` range par activité (`lib/rangement-notifications.ts`).
Le choix de l'organisation se garde par onglet (`sessionStorage`), et le navigateur
retient le dernier choix (`localStorage`). L'application installée change
d'organisation dans la même fenêtre. La pastille de l'icône compte les
notifications de la cloche et celles des admins.
