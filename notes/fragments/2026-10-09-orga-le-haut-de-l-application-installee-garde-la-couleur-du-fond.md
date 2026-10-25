---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
version: 0.13.2
fr:
  titre: >-
    Le haut de l'application installée garde la couleur du fond
  texte: >-
    Dans l'application installée sur un iPhone, une bande claire restait visible
    sous l'heure, sur le fond coloré d'une organisation. Une fenêtre en plein
    écran défilait aussi sous l'heure. Le haut de l'écran est maintenant flouté
    sans teinte, y compris au-dessus des fenêtres, et le texte ne se lit plus à
    côté des angles de la barre haute.
en:
  titre: >-
    The top of the installed app keeps the background color
  texte: >-
    In the app installed on an iPhone, a light band stayed visible below the
    time, on an organization’s colored background. A full-screen window also
    scrolled under the time. The top of the screen is now blurred without a
    tint, including above windows, and text no longer shows next to the corners
    of the top bar.
---

`packages/orga/src/global.css` : voile `body::before` sans fond, au-dessus des
fenêtres (z-index 3000), limité à la zone sûre plus 6 px ; second voile
`body::after` sous la barre haute ; barre haute et fenêtre en plein écran
décalées d'autant.
