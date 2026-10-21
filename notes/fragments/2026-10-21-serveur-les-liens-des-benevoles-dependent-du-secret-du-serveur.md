---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    Les liens des bénévoles dépendent du secret du serveur
  texte: >-
    Les adresses des appels à bénévoles (/benevoles/) et des espaces bénévoles
    (/benevole/) sont des pages de l'espace organisateur : un proxy qui renvoie
    les chemins inconnus vers l'application les sert sans réglage. Leurs jetons
    dérivent de BETTER_AUTH_SECRET : changer ce secret change tous ces liens.
---

ADR 0041 : `lib/liens.ts`, jeton HMAC du secret et d'un sel gardé en base ;
la base garde l'empreinte SHA-256, jamais le jeton.
