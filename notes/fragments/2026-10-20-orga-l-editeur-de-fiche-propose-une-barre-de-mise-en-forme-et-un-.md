---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    L’éditeur de fiche s’ouvre en mode visuel, avec une barre de mise en forme et un guide Markdown
  texte: >-
    En mode visuel, vous écrivez directement dans la fiche telle qu’elle
    s’affiche. Le mode Markdown montre le texte source, et votre navigateur
    garde votre choix. Une barre au-dessus du texte met en gras ou en italique,
    pose un titre, une liste, une case à cocher, un lien ou un tableau. Le
    bouton « Aide » ouvre un guide de la syntaxe Markdown des fiches, sans
    quitter l’éditeur.
---

`composants/EditeurMarkdown.tsx` et `lib/mise-en-forme.ts` (fonctions pures,
testées). Le remplacement passe par `document.execCommand('insertText')`, qui
garde l'annulation du navigateur ; un navigateur qui la refuse reçoit le texte
complet. Raccourcis ⌘B, ⌘I et ⌘K (Ctrl ailleurs). Mode visuel :
Milkdown (`@milkdown/core`, presets CommonMark et GFM, sans Crepe), chargé à
l'ouverture de l'éditeur (`lib/editeur-visuel.ts`). Le Markdown écrit garde la
forme de la fiche : tiret des puces, tiret bas de l'italique, adresses écrites
telles quelles, séparateur des tableaux. Les fiches d'exemple, et 83 fiches d'un
contenu réel gardé hors du dépôt, reviennent identiques après un passage par
l'éditeur. Guide dans
`lib/guide-markdown.ts`, rendu par `composants/Markdown.tsx` dans un tiroir de
l'éditeur et sur la page `/:activite/aide/markdown`. Le site reprend les mêmes
exemples dans `site/modes-d-emploi/markdown.html`. Le rendu des fiches gagne les
styles des cases à cocher, des blocs de code et des lignes de séparation.
