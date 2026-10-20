---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    L’éditeur de fiche propose une barre de mise en forme et un guide Markdown
  texte: >-
    Une barre au-dessus du texte met en gras ou en italique, pose un titre, une
    liste, une case à cocher, un lien ou un tableau. Un deuxième appui retire la
    mise en forme. Sur un ordinateur, l’aperçu reste à côté du texte pendant la
    saisie. Le bouton « Aide » ouvre un guide de la syntaxe Markdown des fiches,
    sans quitter l’éditeur.
---

`composants/EditeurMarkdown.tsx` et `lib/mise-en-forme.ts` (fonctions pures,
testées). Le remplacement passe par `document.execCommand('insertText')`, qui
garde l'annulation du navigateur ; un navigateur qui la refuse reçoit le texte
complet. Raccourcis ⌘B, ⌘I et ⌘K (Ctrl ailleurs). Guide dans
`lib/guide-markdown.ts`, rendu par `composants/Markdown.tsx` dans un tiroir de
l'éditeur et sur la page `/:activite/aide/markdown`. Le site reprend les mêmes
exemples dans `site/modes-d-emploi/markdown.html`. Le rendu des fiches gagne les
styles des cases à cocher, des blocs de code et des lignes de séparation.
