---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Le rétroplanning respecte les droits de lecture
  texte: >-
    Les tâches d'une édition se lisent en une fois, triées par échéance.
    Chaque personne reçoit seulement les tâches des périmètres qu'elle peut
    consulter.
en:
  titre: >-
    The timeline respects read rights
  texte: >-
    The tasks of an edition are read in one go, sorted by due date. Each person
    receives only the tasks of the areas they can view.
---

Requête `retroplanning(editionId)`, réservée aux personnes connectées.

- `lib/droits.ts` : `perimetresLisibles` porte la règle de lecture, reprise
  par `peutLirePerimetre`, `mesPerimetres` et la liste des fiches.
- Les périmètres archivés sont exclus. Une assignation n'ajoute aucune tâche.
- Tests d'intégration : refus sans session, refus d'un autre périmètre même
  avec une assignation directe, affectation passée, tri pour un admin.
