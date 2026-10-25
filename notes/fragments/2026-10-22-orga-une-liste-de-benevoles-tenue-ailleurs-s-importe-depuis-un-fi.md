---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.20.0
fr:
  titre: >-
    Une liste de bénévoles tenue ailleurs s'importe depuis un fichier
  texte: >-
    L'écran « Bénévoles » importe une liste tenue hors de Relaytour : un
    export de billetterie, un formulaire ou un tableur, en CSV ou en XLSX.
    Votre navigateur lit le fichier, et seules les colonnes associées partent
    vers le serveur. Vous vérifiez les colonnes proposées, associez les postes
    du fichier aux séquences du programme, puis relisez un aperçu avant
    d'importer. Un admin importe pour tout le programme, une référente ou un
    référent pour son périmètre. Aucun mail ne part à l'import.
en:
  titre: >-
    A volunteer list kept elsewhere can be imported from a file
  texte: >-
    The “Volunteers” screen imports a list kept outside Relaytour, such as a
    ticketing export, a form, or a spreadsheet, as CSV or XLSX. Your browser
    reads the file, and only the mapped columns go to the server. You check the
    suggested columns, match the file’s roles to the slots in the schedule, and
    review a preview before importing. An admin imports for the whole schedule,
    and a coordinator imports for their area. No email is sent during the
    import.
---

ADR 0042 : requêtes `simulerImportBenevoles` et `correspondancesImport` ;
mutations `importerBenevoles`, `enregistrerCorrespondanceImport` et
`supprimerCorrespondanceImport` ; lecture CSV (papaparse) et XLSX (read-excel-file)
chargée à la demande ; lots de 500 personnes ; rapprochement partagé dans
`@relaytour/commun`.
