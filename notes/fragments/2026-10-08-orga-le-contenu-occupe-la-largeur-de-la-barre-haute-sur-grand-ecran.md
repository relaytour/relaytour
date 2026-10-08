---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Le contenu occupe toute la largeur disponible sur un grand écran
  texte: >-
    Le contenu d'un écran s'arrêtait à 1180 pixels de large, alors que la barre
    haute suivait l'écran. Le contenu et la barre haute partagent maintenant la
    même largeur, jusqu'à 1600 pixels. Sur un écran plus large, l'ensemble est
    centré.
---

`.rt-principal` porte la largeur maximale dans `packages/orga/src/global.css` ;
`.rt-contenu` n'a plus de borne propre. Voir `docs/design-system.md`,
« Volets ».
