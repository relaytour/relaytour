---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.18.0
fr:
  titre: >-
    Google Drive rejoint l'espace de fichiers
  texte: >-
    Vous connectez Google Drive avec votre compte, ou par un compte de service
    dont vous déposez la clé. Avec un compte de service, Relaytour ne lit que
    les dossiers que l'association partage avec lui. Les documents Google
    s'ouvrent dans la liseuse et s'importent en fiches.
en:
  titre: >-
    Google Drive joins the file space
  texte: >-
    You connect Google Drive with your account, or with a service account whose
    key you upload. With a service account, Relaytour reads only the folders the
    association shares with it. Google documents open in the viewer and can be
    imported as sheets.
---

ADR 0038 : fournisseur `GOOGLE_DRIVE` (API Drive v3), méthode de connexion
`COMPTE` (OAuth avec PKCE, `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`) ou
`COMPTE_SERVICE` (assertion signée en RS256, clé chiffrée en base), mutation
`connecterCompteServiceGoogle`, champ `connexionsPossibles`. Documents natifs
exportés en PDF pour la liseuse et en Markdown pour l'import ; suppressions
de l'export dans la corbeille de Drive.
