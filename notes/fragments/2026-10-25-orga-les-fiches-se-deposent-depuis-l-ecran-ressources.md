---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.22.0
fr:
  titre: >-
    Les fiches se déposent depuis l’écran Ressources
  texte: >-
    Le bouton « Déposer des fichiers » de l’écran Ressources transforme des
    fichiers Markdown, texte ou Word en fiches, pour un périmètre ou pour les
    fiches communes. Un document Word est converti en Markdown, sans ses
    images. Le dépôt est vérifié avant d’écrire, et une fiche modifiée dans
    Relaytour n’est jamais remplacée. Les admins d’une activité y ont accès,
    sans fournisseur cloud connecté.
en:
  titre: >-
    Sheets can be uploaded from the Resources screen
  texte: >-
    The “Upload files” button of the Resources screen turns Markdown, text or
    Word files into sheets, for an area or for the shared sheets. A Word
    document is converted to Markdown, without its images. The upload is
    checked before writing, and a sheet changed in Relaytour is never replaced.
    Activity admins can use it, without a connected cloud provider.
---

ADR 0049. Route `POST /medias/fiches/depot` (`packages/server/src/orga/route-depot-fiches.ts`),
conversion et contrôles partagés avec l'import depuis l'espace de fichiers
(`espace-fichiers/import.ts`). Migration additive : valeur `DEPOT` de `SourceFiche`,
protégée de `orga:importer` comme `ESPACE_FICHIERS`.
