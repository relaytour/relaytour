---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    Chaque version se publie depuis main, avec ses images et sa release
  texte: >-
    Relaytour porte désormais un seul numéro de version. Chaque version
    publiée reçoit un tag, une release GitHub rédigée depuis les notes, et
    trois images marquées de son numéro. Une installation suit une version
    (IMAGE_TAG=x.y.z) ou la série de ses correctifs (IMAGE_TAG=x.y), au lieu
    de suivre l'empreinte d'un commit.
---

- `outils/versionner.mjs` : commandes `publier` et `release`, champ `version`
  sur les fragments, journal groupé par version (`schemaVersion` 3).
- `.github/workflows/publier.yml` remplace `image.yml` : étiquettes de version,
  labels OCI, tag et release créés après la poussée des images. L'entrée
  `simulation` affiche le résultat sans rien publier.
- Les tests des outils tournent en CI (`node --test outils/*.test.mjs`).
