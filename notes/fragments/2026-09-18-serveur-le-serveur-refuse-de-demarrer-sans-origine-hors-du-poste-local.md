---
cible: serveur
type: correctif
audience: interne
etat: prevu
fr:
  titre: >-
    Le serveur refuse de démarrer sans ORIGINE_ORGA hors du poste local
  texte: >-
    En recette et en production, une origine absente faisait pointer les
    liens des mails et l'origine de confiance de la connexion sur un hôte
    d'exemple, sans avertissement. Le démarrage exige désormais la variable.
---

- `superRefine` dans `src/env.ts` ; seul le poste local garde un repli
  (`http://localhost:5305`).
- `${ORIGINE_ORGA:?requis}` dans la pile Compose de référence.
