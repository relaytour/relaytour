---
cible: orga
type: correctif
audience: interne
etat: prevu
version: 0.37.1
fr:
  titre: >-
    Les polices restent des fichiers, autorisés par la politique de contenu
  texte: >-
    Le navigateur charge tous les sous-ensembles de la police Hanken Grotesk.
    Un sous-ensemble de moins de 4 ko était intégré à la feuille de style, et la
    politique de contenu le refusait.
---

`build.assetsInlineLimit` de Vite exclut les fichiers de police : ils restent servis par l'origine (`font-src 'self'`).
