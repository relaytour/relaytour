---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
fr:
  titre: >-
    Le serveur ne retient que les points d'équipe pour l'horizon des priorités
  texte: >-
    Le champ `pointEquipe` de `creerReunion`, `modifierReunion` et du type
    `Reunion` marque un point d'équipe (amendement de l'ADR 0059). La requête
    `priorites` et la mutation `ajusterPriorite` ne retiennent que ces réunions
    pour fixer l'horizon. Une migration additive ajoute le champ et marque les
    réunions globales à venir qui convoquent toute l'équipe.
---

`lib/reunions.ts` porte `pointEquipeValide` (valeur par défaut, refus sur une
réunion de périmètre) et `filtreProchainPoint`. L'export complet reprend le champ.
