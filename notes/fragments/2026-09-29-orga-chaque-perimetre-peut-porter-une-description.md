---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.8.0
fr:
  titre: >-
    Chaque périmètre peut porter une description
  texte: >-
    Les admins décrivent chaque périmètre en une ou deux phrases, dans la page
    « Périmètres » ou dans le fichier perimetres.yaml du contenu. La
    description s'affiche sous le titre de la page du périmètre.
---

- Migration additive `20260929120000_description_perimetres` :
  `Perimetre.description`, 400 caractères au plus.
- `perimetres.yaml` accepte `description`. L'import et l'export la
  reprennent ; une description qui contient une coordonnée personnelle est
  refusée à la validation et reste hors de l'export (invariant 16).
- `creerPerimetre` et `modifierPerimetre` prennent `description` : absente,
  elle ne change pas ; vide, elle est retirée.
- ADR 0012.
