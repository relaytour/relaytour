---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.29.0
fr:
  titre: >-
    Le panneau « Priorités » se replie
  texte: >-
    Dans « Mon espace », le bouton placé devant le titre « Priorités » replie
    le panneau, comme pour « Vos tâches ». Votre navigateur garde ce choix
    d'une visite à l'autre.
en:
  titre: >-
    The Priorities panel can be collapsed
  texte: >-
    In "My space", the button in front of the "Priorities" title collapses
    the panel, as for "Your tasks". Your browser keeps this choice from one
    visit to the next.
---

`Panneau` reçoit une option `repliable` (état, bascule, nom accessible), avec le
bouton et le clic sur l'en-tête de `Groupe`. Le contenu passe dans un
conteneur `display: contents`, qui garde l'espacement du panneau. L'état se
garde par `useGroupesReplies('mon-espace')`, sous la clé `priorites`.
