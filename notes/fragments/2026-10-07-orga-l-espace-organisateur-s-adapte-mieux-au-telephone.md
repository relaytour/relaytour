---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    L'espace organisateur s'adapte mieux au téléphone
  texte: >-
    Sur un téléphone, la recherche se replie en un bouton et occupe toute la
    barre quand vous l'ouvrez. Les champs ne déclenchent plus de zoom sur
    iPhone. Les petits boutons offrent une zone d'appui plus large, et les
    marges suivent les bords de l'écran.
---

Socle de l'ADR 0023 : `viewport-fit=cover`, `100dvh`, zones sûres, champs à
16 px sous 768 px, règles `(pointer: coarse)`. `outils/captures.mjs` reçoit
`--largeur`, `--hauteur` et `--mobile`.
