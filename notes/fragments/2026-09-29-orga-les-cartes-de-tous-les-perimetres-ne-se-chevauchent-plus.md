---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Les cartes de « Tous les périmètres » ne se chevauchent plus
  texte: >-
    Chaque carte de la page « Tous les périmètres » reste dans sa colonne. Les
    titres des groupes et les cartes de la rangée suivante restent visibles.
---

La carte prenait `height: 100%` en `content-box` : sa marge interne et sa bande
de couleur (38 px) s'ajoutaient à la hauteur de la colonne. Elle passe en
`border-box`.
