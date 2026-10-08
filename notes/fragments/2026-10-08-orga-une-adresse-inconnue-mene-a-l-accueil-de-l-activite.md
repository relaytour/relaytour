---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Une adresse inconnue mène à l'accueil de l'activité
  texte: >-
    Une adresse inconnue qui portait déjà le nom d'une activité laissait l'écran
    vide. L'espace organisateur ouvre maintenant l'accueil de cette activité.
---

`VersActivite` dans `packages/orga/src/composants/FournisseurActivite.tsx` :
l'adresse recevait le slug de l'activité à chaque passage, sans fin.
