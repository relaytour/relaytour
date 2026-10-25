---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.18.0
fr:
  titre: >-
    Les fiches rangées dans l'espace de fichiers s'importent
  texte: >-
    Dans l'écran « Espace de fichiers », vous importez les fiches que
    l'association range déjà dans son cloud : des fichiers Markdown, texte ou
    Word. Relaytour propose un dossier par périmètre, d'après son nom, et
    simule l'import avant d'écrire. Une fiche modifiée dans Relaytour n'est
    jamais remplacée.
en:
  titre: >-
    Sheets stored in the file space can be imported
  texte: >-
    In the “Cloud provider” screen, you import the sheets the association
    already stores in its cloud: Markdown, text, or Word files. Relaytour
    proposes one folder per area, based on its name, and simulates the import
    before writing anything. A sheet edited in Relaytour is never replaced.
---

ADR 0038 : requête `simulerImportFiches` et mutation `importerFichesEspace`,
conversion Word par mammoth et turndown, valeur `ESPACE_FICHIERS` de
`SourceFiche`, fonction d'import commune à `orga:importer`
(`orga/import-fiches.ts`). Licences : `Zlib` (pako) admise, `duck` relu en
BSD-2-Clause.
