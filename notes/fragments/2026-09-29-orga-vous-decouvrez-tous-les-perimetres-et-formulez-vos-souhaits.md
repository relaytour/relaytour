---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.8.0
fr:
  titre: >-
    Vous découvrez tous les périmètres et formulez vos souhaits
  texte: >-
    La page « Tous les périmètres » ouvre la section « Périmètres » du menu.
    Elle présente chaque périmètre avec sa description et le nombre de
    personnes encore recherchées, puis range vos périmètres, vos souhaits et
    les autres. Le bouton « Je suis intéressé·e »
    note un souhait, qu'un admin retrouve dans « Postes à pourvoir ». Une
    activité ouverte aux souhaits s'y découvre par tous les membres.
---

- `TousLesPerimetres.tsx` (route `/<activité>/perimetres`), entrée de menu en
  tête de la section « Périmètres ».
- `ReserveEquipe` mène une personne en découverte vers cette page : Mon espace,
  le rétroplanning, les fiches et les pages de périmètre lui restent fermés.
- Réglage « Ouverte aux souhaits » dans la page « Activités ».
- ADR 0012.
