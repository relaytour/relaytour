---
cible: orga
type: fonctionnalite
audience: staff
etat: prevu
fr:
  titre: >-
    Les éléments cliquables et les pastilles se lisent mieux
  texte: >-
    Les boutons sans fond plein portent un liseré de verre, et leur fond
    s'assombrit au survol. Dans la page Fiches, chaque fiche s'affiche comme
    une ligne cliquable, et chaque sport ou pôle comme une pastille à sa
    couleur. Le texte des pastilles passe en gras et suit le contraste perçu
    plutôt que la formule WCAG 2.
---

- `contrastePercu` et `texteSurCouleur` (APCA 0.0.98G) dans `packages/tokens`.
  La formule WCAG 2 choisissait le noir sur les teintes saturées moyennes
  (turquoise, rose, corail), où il se lit mal.
- Classes `.rt-liste-liens` et `.rt-ligne-lien` dans `global.css` ; jetons
  `defaultBorderColor`, `defaultHoverBg` du bouton dans `lib/theme.ts`.
