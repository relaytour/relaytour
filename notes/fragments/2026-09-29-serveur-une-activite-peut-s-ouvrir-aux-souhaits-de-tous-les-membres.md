---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
version: 0.8.0
fr:
  titre: >-
    Une activité peut s'ouvrir aux souhaits de tous les membres
  texte: >-
    Une personne découvre une activité ouverte aux souhaits, ou une activité
    où elle a un souhait. Elle y voit les périmètres et formule ses propres
    souhaits, sans lire les tâches ni les fiches.
---

- Migration additive `20260929130000_souhaits_ouverts` :
  `Activite.souhaitsOuverts`, faux par défaut. `activite.yaml` l'accepte.
- Contexte : `activitesDecouvertes` et `exigerActiviteDecouverte`, à côté de
  `activitesVisibles`, qui ne change pas. `Activite.acces` vaut `COMPLET` ou
  `DECOUVERTE`, et la requête `activites` liste les activités découvertes.
- Requête `tousLesPerimetres`, mutations `formulerSouhait` et
  `retirerMonSouhait` (scope `connecte`), dans la table des refus croisés.
  Test dédié : `tous-les-perimetres.integration.test.ts`.
- ADR 0012.
