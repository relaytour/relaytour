---
cible: orga
type: interne
audience: interne
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Le site publie le mode d'emploi de l'API
  texte: >-
    Le mode d'emploi « Utiliser l'API » décrit l'activation du module, la création
    d'un jeton d'accès, les appels aux API GraphQL et REST, les codes d'erreur, les
    limites de débit et les robots, en français et en anglais (ADR 0064). Les
    captures du site montrent le panneau « Jetons et API » et le panneau « API pour
    les programmes tiers », sur ordinateur et sur téléphone. CONTRIBUTING.md gagne la
    décision arrêtée « Accès programmatique » et quatre entrées du glossaire.
---

`outils/captures.mjs` gagne les écrans `preferences-jetons` et `organisation-api`.
En mode simulateur, l'outil attend cinq secondes après l'ouverture de la session :
la première page qui répond peut encore se recharger, et sa dernière attente
prenait le premier ordre sans y répondre (« La page ne répond pas »).
