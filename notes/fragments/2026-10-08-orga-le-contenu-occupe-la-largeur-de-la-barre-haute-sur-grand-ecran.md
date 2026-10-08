---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
version: 0.13.0
fr:
  titre: >-
    Le contenu occupe toute la largeur disponible sur un grand écran
  texte: >-
    Le contenu d'un écran s'arrêtait à 1180 pixels de large, alors que la barre
    haute suivait l'écran. Le contenu et la barre haute partagent maintenant la
    même largeur. Replié, le volet latéral se colle au bord droit de l'écran.
---

`.rt-contenu` n'a plus de borne de largeur dans `packages/orga/src/global.css`. Voir `docs/design-system.md`,
« Volets ».
