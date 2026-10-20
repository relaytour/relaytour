---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    Les abonnements à l'agenda passent par /agenda/
  texte: >-
    L'API sert les abonnements iCalendar de l'agenda sous /agenda/. Le proxy de
    l'installation relaie ce chemin vers l'API, comme /graphql et /medias/ : le
    Caddyfile de référence le fait déjà.
---

ADR 0037 : route `GET /agenda/<jeton>.ics`, sans session. Le jeton n'est jamais
gardé ni journalisé ; la limite se compte par abonnement, et par adresse IP pour
les jetons refusés.
