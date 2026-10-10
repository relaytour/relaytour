---
cible: serveur
type: interne
audience: interne
etat: prevu
fr:
  titre: >-
    Les dépendances et les images sont suivies, et l'installation n'exécute que les scripts autorisés
  texte: >-
    Dependabot propose chaque mois les mises à jour des paquets npm, groupées
    par usage, et celles des images Docker de l'image publiée et des piles Compose.
    La CI refuse une dépendance d'exécution qui porte une faille connue de gravité
    élevée ou critique. L'installation des paquets n'exécute plus que les scripts
    d'installation explicitement autorisés, ceux de Prisma et d'esbuild, listés
    dans le package.json racine.
---

`enableScripts: false` dans `.yarnrc.yml`, avec `dependenciesMeta` qui autorise
`prisma`, `@prisma/client`, `@prisma/engines` et `esbuild`. Les scripts de
`@apollo/protobufjs` (cosmétique) et de `msgpackr-extract` (accélération native,
fournie par un paquet précompilé) ne s'exécutent plus. Les deux workflows passent
`persist-credentials: false` à `actions/checkout` : la release se crée par `gh`
avec `github.token`, et aucune étape ne pousse par git. Dependabot ignore les
versions majeures et mineures de `better-auth`, qui se relisent avec l'ADR 0002.
