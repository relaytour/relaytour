---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
version: 0.13.1
fr:
  titre: >-
    L'application installée sur un iPhone ne laisse plus rien passer sous la barre d'état
  texte: >-
    Dans l'application installée, le texte d'un écran se lisait sous l'heure
    pendant le défilement. L'en-tête du menu et les messages de confirmation
    s'affichaient derrière la barre d'état. Le voile du haut de l'écran couvre
    maintenant toute cette zone, et le menu comme les messages commencent en
    dessous.
en:
  titre: >-
    The app installed on an iPhone no longer shows anything under the status bar
  texte: >-
    In the installed app, the text of a screen could be read under the time
    while scrolling. The menu header and confirmation messages appeared behind
    the status bar. The overlay at the top of the screen now covers this whole
    area, and the menu and messages start below it.
---

`packages/orga/src/global.css` : voile `body::before` plein sur la zone sûre,
`padding` des tiroirs et position de `.ant-message` selon
`env(safe-area-inset-*)`.
