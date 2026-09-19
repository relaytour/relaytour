---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Les fiches méthode sont versionnées et importées depuis le dépôt
  texte: >-
    Chaque fiche garde toutes ses versions, et les admins peuvent en restaurer
    une. Les admins accordent le droit de rédiger les fiches d'un périmètre ou
    toutes les fiches. Les modèles du dépôt (périmètres, fiches, tâches types)
    s'importent pour chaque édition, sans jamais écraser une fiche modifiée dans
    l'application.
---

Phase 3 du plan de l'espace organisateur (ADR 0003).

- Modèles Fiche, FicheVersion, DroitRedaction ; Tache.ficheId ; Activite
  FICHE_CREEE et FICHE_MODIFIEE (editionId et perimetreId deviennent facultatifs).
- src/orga : lecture stricte (Zod), import avec simulation et conflits, export.
- Commandes orga:valider, orga:importer, orga:exporter ; importer compilé dans l'image.
- Détection des coordonnées personnelles dans les fiches du dépôt.
- 9 tests unitaires des modèles, 12 tests d'intégration.
