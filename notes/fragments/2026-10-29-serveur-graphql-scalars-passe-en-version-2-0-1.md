---
cible: serveur
type: securite
audience: interne
etat: prevu
fr:
  titre: >-
    graphql-scalars passe en version 2.0.1
  texte: >-
    L'API passe sur graphql-scalars 2.0.1. Les versions 2.0.0 et antérieures
    exposent le scalaire PhoneNumber à un déni de service par expression
    régulière (GHSA-x8rm-f576-gq67). L'API n'emploie pas ce scalaire, mais
    l'audit des dépendances de la CI bloquait toute PR.
---

- `graphql-scalars` ^1.24.0 vers ^2.0.1 dans `packages/server`.
- L'API emploie `DateResolver`, `DateTimeResolver` et `JSONObjectResolver`.
  `schema.graphql` ne change pas.
