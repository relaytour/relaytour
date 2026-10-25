---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.7.0
fr:
  titre: >-
    Chaque périmètre peut avoir un contact principal
  texte: >-
    Dans « Postes à pourvoir », l'étoile d'une personne affectée la désigne
    comme contact principal du périmètre pour la période. La page du périmètre
    et l'avancement global l'affichent en tête des référentes et référents.
    Ce rôle ne donne aucun droit supplémentaire.
en:
  titre: >-
    Each area can have a main contact
  texte: >-
    In “Open seats”, the star next to an appointed person designates them as the
    area’s main contact for the period. The area’s page and the overall progress
    show them first among the coordinators. This role grants no additional
    rights.
---

- `Postes.tsx` : bouton étoile dans chaque affectation (`aria-pressed`),
  désactivé sur une période archivée.
- `Perimetre.tsx` et `AvancementGlobal.tsx` : mention « Contact principal »
  (`MentionContactPrincipal` dans `composants/Personne.tsx`).
- ADR 0011.
