---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
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
---

ADR 0039. `lib/concerne.ts` (liste, propositions, seuil, suggestions ;
testé), `composants/ChampConcerneAussi.tsx`, suggestions de mention dans
`EditeurMarkdown` (zone de texte et éditeur visuel, par `onCurseur`). La liste
s'enregistre par `reglerConcerneAussi` après la fiche, et ne passe pas par le
brouillon.
