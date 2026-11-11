---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Une API REST v1 documentée par OpenAPI
  texte: >-
    Un outil qui ne parle pas GraphQL appelle l'API REST sous `/api/v1/`, avec
    un jeton d'accès. Elle lit les activités, les périodes, les périmètres,
    l'équipe, les tâches, les priorités, les commentaires et les fiches. Elle
    crée, modifie, assigne et commente une tâche, et change son statut. Chaque
    route suit les droits de la personne du jeton. `/api/v1/openapi.json` décrit
    l'API au format OpenAPI 3.0.
en:
  titre: >-
    A REST API v1 documented with OpenAPI
  texte: >-
    A tool that does not speak GraphQL calls the REST API under `/api/v1/`, with
    an access token. It reads activities, periods, areas, the team, tasks,
    priorities, comments and sheets. It creates, edits, assigns and comments on a
    task, and changes its status. Each route follows the rights of the token's
    person. `/api/v1/openapi.json` describes the API in the OpenAPI 3.0 format.
---

ADR 0064. `src/api-rest/operations.ts` porte les routes et leurs documents
GraphQL, `src/api-rest/openapi.ts` calcule le contrat et `src/api-rest/routeur.ts`
les sert. `yarn codegen` écrit `packages/server/openapi.json`, que la CI compare.
Vitest résout désormais `graphql` vers une seule copie.
