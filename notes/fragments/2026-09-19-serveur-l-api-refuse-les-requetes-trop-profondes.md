---
cible: serveur
type: securite
audience: interne
etat: prevu
version: 0.4.0
fr:
  titre: >-
    L'API refuse les requêtes trop profondes
  texte: >-
    L'API rejette désormais une requête GraphQL trop profonde, trop large ou
    trop coûteuse avant d'exécuter le moindre résolveur. Le schéma comporte
    des cycles (périmètre et tâches, personne et affectations) qu'une personne
    connectée pouvait exploiter pour saturer le serveur avec une requête
    imbriquée. Les requêtes de l'espace organisateur restent bien en dessous
    des limites.
---

- Plugin `@pothos/plugin-complexity` (licence ISC) enregistré dans
  `packages/server/src/schema/builder.ts`. Limites : profondeur 8, largeur 100
  sélections, complexité 2 000 (coût 1 par champ, multiplicateur 10 par liste).
- Le refus renvoie une erreur GraphQL en français avec le code
  `REQUETE_TROP_PROFONDE`, `REQUETE_TROP_LARGE` ou `REQUETE_TROP_COMPLEXE`
  (`requeteTropLourde` dans `src/lib/erreurs.ts`).
- Mesure des requêtes de l'espace organisateur au 19 septembre 2026 :
  profondeur maximale 5 (`MesTaches`), largeur maximale 71, complexité
  maximale 1 205 (`MesTaches`, puis `Personnes` à 1 171). La limite de 1 000
  envisagée au départ aurait bloqué ces deux requêtes.
- Test sans base : `src/schema/complexite.test.ts`.
