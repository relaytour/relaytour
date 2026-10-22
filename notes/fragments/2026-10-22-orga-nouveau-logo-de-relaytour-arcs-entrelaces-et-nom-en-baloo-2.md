---
cible: orga
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    Nouveau logo de Relaytour : arcs entrelacés et nom en Baloo 2
  texte: >-
    Les deux arcs du pictogramme sont entrelacés : chaque extrémité passe
    au-dessus de l'autre arc. Le favicon, l'icône de l'application installée,
    la signature de l'espace organisateur et le site utilisent ce dessin. Le
    nom « Relaytour » s'écrit en Baloo 2 SemiBold, avec « tour » en accent.
---

Sous le frontmatter : le détail technique, jamais compilé.

Trait de 8 sur une grille de 64 pour le favicon et les pictogrammes de
l'interface, trait de 9 pour `icon.png`. Le tracé ajoute l'extrémité droite du
premier arc au-dessus du second : la version monochrome, qui pose une opacité
sur le second arc, ne double donc aucune zone. Les PNG sans usage de
`packages/orga/public` (`icon@2x`, `icon@3x`, `icon-1`, `icon-2`, `icon-light*`)
sont retirés. Baloo 2 entre par `@fontsource/baloo-2` (OFL), pour le seul
logotype.
