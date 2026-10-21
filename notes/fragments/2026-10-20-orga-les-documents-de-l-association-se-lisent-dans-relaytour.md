---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.18.0
fr:
  titre: >-
    Les documents de l'association se lisent dans Relaytour
  texte: >-
    Un admin de l'organisation connecte l'espace de fichiers de l'association
    (SharePoint et OneDrive), puis lie ses dossiers aux périmètres. Vous lisez
    ces documents dans l'onglet « Documents » de la page « Fiches », sans
    compte chez le fournisseur. Relaytour n'en garde aucune copie.
---

ADR 0038 : connexion `ConnexionFichiers` (jeton chiffré par
`CLE_CHIFFREMENT_ESPACE_FICHIERS`), dossiers liés `DossierLie`, requêtes
`espaceFichiers`, `emplacementsFichiers`, `parcourirEspaceFichiers`,
`dossiersLies` et `contenuDossierLie`, route d'aperçu
`/medias/espace-fichiers/apercu`, liseuse avec pdf.js.
