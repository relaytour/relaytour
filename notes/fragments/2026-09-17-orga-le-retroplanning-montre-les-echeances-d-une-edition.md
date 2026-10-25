---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Le rétroplanning montre les échéances d'une édition
  texte: >-
    La page « Rétroplanning » regroupe les tâches par mois, de la plus proche
    à la plus lointaine. Vous filtrez par périmètre, par type ou par statut,
    ou gardez seulement vos périmètres et vos tâches. Les tâches en retard
    ressortent en rouge.
en:
  titre: >-
    The timeline shows the due dates of an edition
  texte: >-
    The “Timeline” page groups tasks by month, from the nearest to the furthest.
    You filter by area, type, or status, or keep only your areas and your tasks.
    Overdue tasks stand out in red.
---

Page `pages/Retroplanning.tsx`, route `/retroplanning`, entrée de menu après
« Mon espace ».

- Requête `Retroplanning` en `cache-and-network`, ajoutée à `VUES_TACHES`.
- Filtres côté client : périmètres, type, statut, « Mes périmètres »
  (affectations de l'édition), « Assignées à moi ».
- `lib/retroplanning.ts` : regroupement par mois lu dans le texte de la date.
- Liste HTML simple, vérifiée à 375 px sans défilement horizontal.
