---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.23.0
fr:
  titre: >-
    Les lignes de l'agenda et les séquences du programme se lisent mieux sur le fond
  texte: >-
    Les lignes de l'agenda et les séquences du programme prennent le même verre que les cartes de tâche.
    Le fond de la page ne gêne plus la lecture, en liste comme en grille.
en:
  titre: >-
    Calendar rows and schedule slots are easier to read on the background
  texte: >-
    Calendar rows and schedule slots now use the same glass as task cards.
    The page background no longer gets in the way of reading, in the list and in the grid.
---

`.rt-agenda-ligne` et `.rt-sequence` passent de la surface interne (prévue pour
un bloc posé dans un panneau) au verre des cartes (`--rt-verre-carte`), avec
le liseré et l'ombre flottante. Le survol d'une séquence prend
`--rt-verre-carte-survol`.
