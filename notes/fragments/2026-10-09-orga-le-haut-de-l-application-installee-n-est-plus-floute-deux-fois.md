---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
version: 0.14.1
fr:
  titre: >-
    La barre haute sort du flou qu'iOS pose en haut de l'application installée
  texte: >-
    Depuis iOS 26, l'iPhone floute lui-même le haut d'une application installée.
    L'application ajoutait son propre flou, et sa barre haute restait prise
    dedans. Sur ces versions, elle ne pose plus aucun flou. La barre haute, le menu, les fenêtres
    en plein écran et les messages de confirmation commencent 14 pixels plus
    bas.
---

`packages/orga/src/global.css` : les voiles `body::before` et `body::after`
disparaissent sur iOS 26 ; un seul voile reste avant iOS 26. La variable `--rt-haut-sur` porte la zone sûre du haut, plus
14 px dans l'application installée.
