---
cible: serveur
type: correctif
audience: interne
etat: prevu
version: 0.4.0
fr:
  titre: >-
    La validation et l'export d'un dossier de contenu tournent dans l'image
  texte: >-
    L'image Docker embarque désormais orga-valider, orga-exporter et
    essai-courriel, en plus des commandes déjà livrées. Le workflow de
    validation d'un dépôt d'organisation et l'export des fiches en fin
    d'édition fonctionnent sans installer Node sur le serveur.
---

- Entrées ajoutées dans `packages/server/tsup.config.ts` ; un garde-fou de CI
  vérifie la présence de chaque commande attendue dans `dist/`.
- `orga-valider` ne charge plus Prisma : les fonctions pures sur le contenu
  vivent dans `src/lib/contenu.ts`.
