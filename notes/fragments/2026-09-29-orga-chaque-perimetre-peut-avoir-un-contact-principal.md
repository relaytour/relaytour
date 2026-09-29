---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Chaque périmètre peut avoir un contact principal
  texte: >-
    Dans « Postes à pourvoir », l'étoile d'une personne affectée la désigne
    comme contact principal du périmètre pour la période. La page du périmètre
    et l'avancement global l'affichent en tête des référentes et référents.
    Ce rôle ne donne aucun droit supplémentaire.
---

- `Postes.tsx` : bouton étoile dans chaque affectation (`aria-pressed`),
  désactivé sur une période archivée.
- `Perimetre.tsx` et `AvancementGlobal.tsx` : mention « Contact principal »
  (`MentionContactPrincipal` dans `composants/Personne.tsx`).
- ADR 0011.
