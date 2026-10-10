---
cible: serveur
type: securite
audience: interne
etat: prevu
fr:
  titre: >-
    Le démarrage et les compteurs de limite se durcissent
  texte: >-
    Le serveur refuse de démarrer en `NODE_ENV=production` sans `APP_ENV`, et
    hors du poste local avec une `ORIGINE_ORGA` qui n'est pas en https. Les
    compteurs de limite dans Redis posent leur fenêtre dans la même commande que
    l'incrément. Better Auth lit l'adresse du client résolue par Express.
---

`APP_ENV` absent valait `local`, ce qui coupait la limitation de débit de Better
Auth et ouvrait l'introspection ; une `ORIGINE_ORGA` en http donnait un cookie de
session sans `Secure`. `limiterParCle` enchaînait INCR puis EXPIRE : un EXPIRE
perdu laissait une clé sans fin, donc une adresse bloquée jusqu'à intervention ;
un script Lua fait les deux. Better Auth ne lisait qu'un `X-Forwarded-For` à une
seule valeur et rangeait sinon tous les clients dans un même compteur : le serveur
lui passe `req.ip` dans un en-tête interne, et le README d'`infra/` explique
`trusted_proxies` pour un intermédiaire devant Caddy.
