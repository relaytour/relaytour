---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.8.1
fr:
  titre: >-
    Les cartes de « Tous les périmètres » ne se chevauchent plus
  texte: >-
    Chaque carte de la page « Tous les périmètres » reste dans sa colonne. Les
    titres des groupes et les cartes de la rangée suivante restent visibles.
en:
  titre: >-
    The cards on “All areas” no longer overlap
  texte: >-
    Each card on the “All areas” page stays in its column. Group titles and the
    cards of the next row remain visible.
---

La carte prenait `height: 100%` en `content-box` : sa marge interne et sa bande
de couleur (38 px) s'ajoutaient à la hauteur de la colonne. Elle passe en
`border-box`.
