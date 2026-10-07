---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Les demandes d'une période archivée sont supprimées
  texte: >-
    Les admins lisent les demandes pour rejoindre l'équipe jusqu'à l'archivage
    de leur période. La nuit suivante, Relaytour supprime toutes les demandes
    de cette période, quel que soit leur état. Les comptes, les affectations et
    les souhaits créés par une demande acceptée restent. L'écran des périodes
    le rappelle au moment d'archiver. L'export d'une organisation contient
    désormais les demandes de ses périodes ouvertes.
---

`purgerDemandes` (`lib/demandes.ts`) parcourt chaque organisation, quel que soit
son statut. La tâche planifiée `purge` tourne chaque nuit à 3 h 15, à l'heure du
serveur ; `synchroniserPlanification` la garde, avec `synchro`
(`PLANIFICATIONS_GLOBALES`). Elle se lance aussi par
`planification:lancer purge [--organisation slug]`. `construireExport` ajoute la
clé `demandes`. ADR 0015.
