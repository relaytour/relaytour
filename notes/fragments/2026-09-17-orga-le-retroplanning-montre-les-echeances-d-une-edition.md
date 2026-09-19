---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Le rétroplanning montre les échéances d'une édition
  texte: >-
    La page « Rétroplanning » regroupe les tâches par mois, de la plus proche
    à la plus lointaine. Vous filtrez par périmètre, par type ou par statut,
    ou gardez seulement vos périmètres et vos tâches. Les tâches en retard
    ressortent en rouge.
---

Page `pages/Retroplanning.tsx`, route `/retroplanning`, entrée de menu après
« Mon espace ».

- Requête `Retroplanning` en `cache-and-network`, ajoutée à `VUES_TACHES`.
- Filtres côté client : périmètres, type, statut, « Mes périmètres »
  (affectations de l'édition), « Assignées à moi ».
- `lib/retroplanning.ts` : regroupement par mois lu dans le texte de la date.
- Liste HTML simple, vérifiée à 375 px sans défilement horizontal.
