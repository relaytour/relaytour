---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
version: 0.13.0
fr:
  titre: >-
    Une adresse inconnue mène à l'accueil de l'activité
  texte: >-
    Une adresse inconnue qui portait déjà le nom d'une activité laissait l'écran
    vide. L'espace organisateur ouvre maintenant l'accueil de cette activité.
en:
  titre: >-
    An unknown address leads to the activity’s home page
  texte: >-
    An unknown address that already contained an activity’s name used to leave
    the screen empty. The organizer workspace now opens that activity’s home
    page.
---

`VersActivite` dans `packages/orga/src/composants/FournisseurActivite.tsx` :
l'adresse recevait le slug de l'activité à chaque passage, sans fin.
