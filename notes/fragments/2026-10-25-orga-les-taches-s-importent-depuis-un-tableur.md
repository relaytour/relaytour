---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.22.0
fr:
  titre: >-
    Les tâches d’une édition s’importent depuis un tableur
  texte: >-
    Le bouton « Importer des tâches » du rétroplanning lit un fichier CSV ou
    Excel. Vous associez les colonnes (périmètre, titre, échéance, fiche,
    responsable), puis l’import vérifie chaque ligne avant d’écrire. Une
    échéance s’écrit en date, en J-30 ou en « 30 jours avant ». Un périmètre
    inconnu est créé dans le groupe de votre choix, ou sa ligne est écartée.
    Une option enregistre aussi les tâches comme tâches types. Une tâche déjà
    présente n’est jamais recréée.
en:
  titre: >-
    An edition’s tasks can be imported from a spreadsheet
  texte: >-
    The “Import tasks” button of the timeline reads a CSV or Excel file. You map
    the columns (area, title, due date, sheet, owner), then the import checks
    each row before writing. A due date is written as a date, as D-30, or as
    “30 days before”. An unknown area is created in the group of your choice, or
    its row is set aside. An option also saves the tasks as task templates. A
    task that is already present is never created again.
---

ADR 0049. Requête `simulerImportTaches` et mutation `importerTaches`
(`packages/server/src/lib/import-taches.ts`). Côté navigateur, l'assistant commun
`AssistantTableur` et `lib/import-taches.ts`, sur le module `lib/import-tableur.ts`.
