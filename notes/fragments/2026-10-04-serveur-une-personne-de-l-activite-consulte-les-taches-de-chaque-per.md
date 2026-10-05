---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Une personne de l'activité consulte les tâches de chaque périmètre
  texte: >-
    Une personne qui voit une activité lit les tâches, l'avancement, les
    référentes et référents et le contact principal de chacun de ses
    périmètres. Le rétroplanning renvoie les tâches de tous les périmètres non
    archivés de l'activité. Les fiches, la recherche, les tâches à prendre et
    toutes les écritures gardent leur règle. Le champ `Perimetre.acces` vaut
    `COMPLET`, `CONSULTATION` ou `AUCUN`.
---

`peutConsulterPerimetre` et `exigerConsultation` (`lib/droits.ts`) s'appuient sur
`ctx.activitesVisibles()`, déjà mémorisé par requête. `Perimetre.taches`,
`referents`, `contactPrincipal`, `avancement` et `Query.perimetre` passent de
`exigerLecture` à `exigerConsultation`. `exigerLecture` n'avait plus d'appelant et
disparaît. `perimetresLisibles` et `peutModifierPerimetre` ne changent pas.
ADR 0014.
