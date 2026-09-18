---
cible: orga
type: fonctionnalite
audience: interne
etat: prevu
fr:
  titre: >-
    L'espace organisateur se déploie depuis l'image
  texte: >-
    Le dépôt publie une troisième image, suffixée -orga, qui contient le site
    statique de l'espace organisateur. Dans la pile de référence, un service
    la copie vers un dossier de l'hôte à chaque démarrage. Un hébergeur n'a
    plus besoin de Node ni de Yarn sur son serveur pour mettre à jour.
---

- Cibles `orga-deps`, `orga-build` et `orga` dans `packages/server/Dockerfile`,
  avant `runtime` (qui doit rester la dernière cible).
- Tags `<sha7>-orga` et `main-orga` dans `image.yml` ; service `orga` et
  variable `ORGA_DIR` dans `infra/compose`.
