---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    Les fiches s'exportent dans l'espace de fichiers
  texte: >-
    Dans l'écran « Espace de fichiers », vous choisissez où Relaytour crée le
    dossier « Fiches Relaytour ». Relaytour y écrit les fiches en Markdown
    après chaque modification, puis chaque nuit. Les fiches se modifient
    toujours dans Relaytour : l'écran signale une fiche modifiée dans le
    dossier, puis réécrite.
---

ADR 0038 : table `FicheExportee`, champs d'export de `ConnexionFichiers`,
mutations `choisirDossierExport`, `retirerDossierExport` et
`exporterFichesMaintenant`, tâches `export-fiches` (regroupée sur une minute)
et `espace-fichiers` (chaque nuit à 3 h 45 : renouvellement de l'accès et
réconciliation). Écritures Microsoft Graph : création de dossier, écriture
d'un fichier, suppression.
