---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
version: 0.27.0
fr:
  titre: >-
    Le serveur calcule les priorités d'une période
  texte: >-
    La requête `priorites` rend, pour chaque périmètre d'une activité, les tâches à
    traiter avant le prochain point de l'agenda global, avec leur score et ses
    raisons (ADR 0059). La mutation `ajusterPriorite` pose ou retire un ajustement
    temporaire sur une tâche. Une migration additive ajoute l'ajustement à la tâche
    et un type au journal.
---

`lib/priorites.ts` calcule l'horizon, le score et le classement sans lire la base.
`schema/priorites.ts` charge les tâches ouvertes de la période et la prochaine réunion
globale. Le champ `Tache.ajustement` ne rend que l'ajustement qui compte encore.
