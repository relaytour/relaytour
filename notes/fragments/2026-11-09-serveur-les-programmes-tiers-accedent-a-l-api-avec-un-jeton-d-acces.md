---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Les programmes tiers accèdent à l'API avec un jeton d'accès
  texte: >-
    Chaque organisation a un module « API », inactif par défaut. Quand un admin
    l'active, une personne crée des jetons d'accès qui agissent en son nom, avec
    ses droits. Un jeton peut se limiter à la lecture et à certaines activités, et
    il expire au bout d'un an au plus. L'API GraphQL accepte ces jetons en
    `Authorization: Bearer`. L'administration de l'installation peut interdire,
    imposer ou suspendre le module.
en:
  titre: >-
    Third-party programs access the API with an access token
  texte: >-
    Each organization has an "API" module, off by default. Once an admin turns it
    on, a person creates access tokens that act on their behalf, with their
    rights. A token can be limited to reading and to some activities, and it
    expires after one year at most. The GraphQL API accepts these tokens as
    `Authorization: Bearer`. The instance administration can forbid, enforce or
    suspend the module.
---

ADR 0064. `lib/jetons-acces.ts` porte la forme, l'empreinte et l'état du module ;
`contexte-jeton.ts` résout le jeton et répond 401, 403 ou 429 avant l'exécution.
Le contexte réduit les activités d'un jeton limité. Les scopes `session` et
`toutesActivites` ferment au jeton les opérations du compte, les secrets et les
notifications d'un jeton limité. Une migration additive ajoute cinq colonnes à
`Organisation` et la table `JetonAcces`. L'écran des jetons vient dans une PR
suivante.
