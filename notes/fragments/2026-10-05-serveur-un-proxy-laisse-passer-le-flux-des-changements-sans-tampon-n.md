---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Un proxy laisse passer le flux des changements sans tampon ni compression
  texte: >-
    La note d'auto-hébergement décrit le passage du flux des changements par un
    proxy. Le Caddyfile d'exemple le relaie sans réglage. Un autre proxy
    transmet la réponse sans tampon ni compression, et garde ouverte une
    réponse silencieuse pendant 30 secondes. La note donne deux vérifications à
    faire après une mise à jour. Sans ce flux, les écrans se relisent chaque
    minute.
---

`infra/README.md`, section « Laisser passer le flux des changements » (ADR 0017),
et un commentaire dans `infra/caddy/Caddyfile.example`. Essai local derrière
Caddy 2.10 : le signal arrive 10 ms après sa réception en direct, le battement
toutes les 12 secondes, y compris avec `encode zstd gzip` devant l'API.
`docs/feuille-de-route.md` reçoit les webhooks sortants et l'indicateur de
présence.
