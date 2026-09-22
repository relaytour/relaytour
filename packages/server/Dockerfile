# Image de l'API et du worker Relaytour. Construite depuis la racine du dépôt :
#   docker build -f packages/server/Dockerfile -t relaytour-server .
# La cible `migrator` applique les migrations avant le démarrage de l'API.
# La cible `orga` livre l'espace organisateur (site statique) dans une image minimale
# qui le copie vers un volume de l'hôte, servi ensuite par Caddy.

FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY .yarnrc.yml package.json yarn.lock ./
# Yarn exige la présence de chaque workspace déclaré, même non installé.
COPY packages/server/package.json   packages/server/
COPY packages/database/package.json packages/database/
COPY packages/orga/package.json     packages/orga/
COPY packages/tokens/package.json   packages/tokens/
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
  yarn workspaces focus @relaytour/server @relaytour/database @relaytour/tokens

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/database packages/database
COPY packages/tokens   packages/tokens
COPY packages/server   packages/server
# Prisma exige une URL à la génération ; aucune connexion n'est ouverte ici.
ARG DATABASE_URL=mysql://build:build@127.0.0.1:3306/build
RUN yarn workspace @relaytour/database generate
RUN yarn workspace @relaytour/server build
RUN cp packages/database/src/generated/client/libquery_engine-*.node \
       packages/server/dist/libquery_engine.node

FROM deps AS prod-deps
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
  yarn workspaces focus @relaytour/server @relaytour/database @relaytour/tokens --production

# Applique les migrations (image -migrate). Placée avant `runtime`, qui reste la cible par défaut.
FROM build AS migrator
WORKDIR /app
CMD ["yarn", "workspace", "@relaytour/database", "migrate-deploy"]

# Espace organisateur : construit avec Vite, sans variable d'environnement, donc un
# seul build pour toutes les installations.
FROM deps AS orga-deps
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
  yarn workspaces focus @relaytour/orga @relaytour/tokens

FROM orga-deps AS orga-build
COPY tsconfig.base.json ./
COPY packages/tokens packages/tokens
COPY packages/orga   packages/orga
# Le gabarit d'une fiche est importé tel quel par l'éditeur de fiches.
COPY content/exemple/modeles/fiche.md content/exemple/modeles/fiche.md
RUN yarn workspace @relaytour/orga build

FROM alpine:3 AS orga
COPY --from=orga-build /app/packages/orga/dist /orga
# Copie les ressources d'abord et index.html en dernier : une page chargée pendant
# la copie trouve toujours ses ressources.
CMD ["sh", "-c", "mkdir -p /cible && cd /orga && tar cf - --exclude=./index.html . | tar xf - -C /cible && cp index.html /cible/index.html && echo 'Espace organisateur copié dans /cible.'"]

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4400 \
    PRISMA_QUERY_ENGINE_LIBRARY=/app/packages/server/dist/libquery_engine.node
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build     /app/packages/server/dist ./packages/server/dist
COPY packages/server/package.json ./packages/server/package.json
# Commandes disponibles dans dist/ : creer-admin, creer-edition, creer-organisation,
# exporter-organisation, orga-valider, orga-importer, orga-exporter, essai-courriel,
# planification-lancer (liste tenue par tsup.config.ts).
# Le contenu d'une organisation ne fait pas partie de l'image : montez-le en volume
# et lancez `node dist/orga-importer.js --dossier /contenu --edition <année>`.
# /exports reçoit les exports d'organisation (ADR 0008). Un volume nommé monté ici
# hérite du propriétaire node au premier montage.
RUN mkdir -p /exports && chown node:node /exports && chmod 750 /exports
USER node
WORKDIR /app/packages/server
EXPOSE 4400
# Les constantes de version sont en dernier : elles changent à chaque build et
# invalideraient le cache des couches suivantes.
ARG VERSION=0.0.0-local
ARG GIT_SHA=inconnu
ARG BUILT_AT=inconnu
ENV APP_VERSION=$VERSION APP_GIT_SHA=$GIT_SHA APP_BUILT_AT=$BUILT_AT
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4400)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.js"]
