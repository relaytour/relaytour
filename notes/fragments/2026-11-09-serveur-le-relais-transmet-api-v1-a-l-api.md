---
cible: serveur
type: rupture
audience: public
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Le relais transmet /api/v1/* à l'API
  texte: >-
    L'API REST des programmes tiers répond sous `/api/v1/*` (ADR 0064). Le
    relais de l'installation doit transmettre ce chemin à l'API, comme
    `/graphql`. Sans cette ligne, `/api/v1/*` rend la page de l'espace
    organisateur, et seule l'API GraphQL accepte les jetons d'accès.
  migration: >-
    Ajoutez `/api/v1/*` à la liste des chemins que votre relais transmet à
    l'API. Avec le `Caddyfile` d'exemple, la ligne devient `@api path /api/auth/*
    /api/v1/* /graphql /medias/* /agenda/*`. Vérifiez ensuite que
    `https://<votre-espace>/api/v1/openapi.json` répond un document JSON.
en:
  titre: >-
    The proxy forwards /api/v1/* to the API
  texte: >-
    The REST API for third-party programs answers under `/api/v1/*` (ADR 0064).
    The instance proxy must forward this path to the API, like `/graphql`.
    Without this line, `/api/v1/*` returns the organizer workspace page, and only
    the GraphQL API accepts access tokens.
  migration: >-
    Add `/api/v1/*` to the paths your proxy forwards to the API. With the sample
    `Caddyfile`, the line becomes `@api path /api/auth/* /api/v1/* /graphql
    /medias/* /agenda/*`. Then check that
    `https://<your-workspace>/api/v1/openapi.json` returns a JSON document.
---

`infra/caddy/Caddyfile.example` et `infra/README.md` (« Ouvrir l'API aux
programmes tiers ») portent la ligne.
