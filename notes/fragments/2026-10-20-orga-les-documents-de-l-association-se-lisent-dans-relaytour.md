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
en:
  titre: >-
    The association’s documents can be read in Relaytour
  texte: >-
    An organization admin connects the association’s file space (SharePoint and
    OneDrive), then links its folders to areas. You read these documents in the
    “Documents” tab of the “Sheets” page, without an account at the provider.
    Relaytour keeps no copy of them.
---

ADR 0038 : connexion `ConnexionFichiers` (jeton chiffré par
`CLE_CHIFFREMENT_ESPACE_FICHIERS`), dossiers liés `DossierLie`, requêtes
`espaceFichiers`, `emplacementsFichiers`, `parcourirEspaceFichiers`,
`dossiersLies` et `contenuDossierLie`, route d'aperçu
`/medias/espace-fichiers/apercu`, liseuse avec pdf.js.
