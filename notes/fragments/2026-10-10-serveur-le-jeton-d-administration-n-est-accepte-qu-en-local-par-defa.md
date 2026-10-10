---
cible: serveur
type: rupture
audience: public
etat: prevu
fr:
  titre: >-
    Le jeton d'administration n'est accepté qu'en local par défaut
  texte: >-
    Sans réglage, le jeton `JETON_ADMINISTRATION` n'est accepté que sur une requête
    locale, qui n'est pas passée par Caddy, et depuis une adresse locale ou privée.
    Dix jetons refusés en quinze minutes depuis une même adresse ferment l'API
    d'administration à cette adresse pour la fenêtre.
  migration: >-
    Une installation qui appelle l'API d'administration à travers Caddy, depuis une
    autre machine, écrit `JETON_ADMINISTRATION_LOCAL=false` dans son `.env`. Une
    installation qui l'appelle depuis la machine (`http://127.0.0.1:4400`), ou qui
    n'a pas de jeton, ne change rien.
---

`JETON_ADMINISTRATION_LOCAL` vide valait `false` : un jeton renseigné répondait à
toute requête relayée par Caddy, sans limite de tentatives. `requeteLocale` exige
désormais aussi une adresse de connexion locale ou privée (RFC 1918, ULA) : un port
publié par erreur sur une interface publique n'ouvre pas le jeton. Le README et
`env.ts` disent que l'export déclenché par le jeton contient des noms et des adresses.
