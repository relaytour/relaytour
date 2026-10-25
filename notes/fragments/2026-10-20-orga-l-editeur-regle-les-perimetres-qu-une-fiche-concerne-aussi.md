---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.18.0
fr:
  titre: >-
    Vous choisissez dans l’éditeur les périmètres qu’une fiche concerne aussi
  texte: >-
    Sous le texte d’une fiche, vous choisissez dans le champ « Concerne aussi »
    les périmètres et les groupes où elle se lit sans s’y modifier. Après une
    arobase, l’éditeur propose les périmètres et les groupes de l’activité. À
    l’enregistrement, il propose d’ajouter les périmètres que le texte
    mentionne. Vous confirmez une liste d’au moins quatre périmètres qui dépasse
    la moitié de l’activité. Le guide Markdown présente les mentions.
en:
  titre: >-
    You choose in the editor which areas a sheet also concerns
  texte: >-
    Below the text of a sheet, you use the “Also concerns” field to choose the
    areas and groups where it can be read but not edited. After an @ sign, the
    editor suggests the activity’s areas and groups. When you save, it offers to
    add the areas that the text mentions. You confirm a list of at least four
    areas that is more than half of the activity. The Markdown guide explains
    mentions.
---

ADR 0039. `lib/concerne.ts` (liste, propositions, seuil, suggestions ;
testé), `composants/ChampConcerneAussi.tsx`, suggestions de mention dans
`EditeurMarkdown` (zone de texte et éditeur visuel, par `onCurseur`). La liste
s'enregistre par `reglerConcerneAussi` après la fiche, et ne passe pas par le
brouillon.
