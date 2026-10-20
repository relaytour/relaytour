---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    Dropbox rejoint l'espace de fichiers
  texte: >-
    Vous connectez Dropbox avec votre compte. Avec un compte d'équipe, vous
    parcourez l'espace de l'équipe, qui contient aussi votre dossier. Les
    documents Word et PowerPoint s'ouvrent dans la liseuse, convertis en PDF
    par Dropbox.
---

ADR 0038 : fournisseur `DROPBOX` (API v2), méthode de connexion `COMPTE`
(OAuth avec PKCE et accès hors ligne, `DROPBOX_CLIENT_ID` et
`DROPBOX_CLIENT_SECRET`). Lecture depuis l'identifiant du dossier lié, écriture
sur le chemin complet, en-tête `Dropbox-API-Path-Root` pour l'espace d'équipe,
aperçu PDF par `get_preview`, etag égal à la révision du fichier.
