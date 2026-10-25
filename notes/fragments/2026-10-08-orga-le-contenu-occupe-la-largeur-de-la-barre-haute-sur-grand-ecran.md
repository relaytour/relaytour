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
en:
  titre: >-
    Content uses the full available width on a large screen
  texte: >-
    The content of a screen used to stop at 1180 pixels wide, while the top bar
    followed the screen. The content and the top bar now share the same width.
    When collapsed, the side panel sticks to the right edge of the screen.
---

`.rt-contenu` n'a plus de borne de largeur dans `packages/orga/src/global.css`. Voir `docs/design-system.md`,
« Volets ».
