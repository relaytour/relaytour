---
cible: serveur
type: securite
audience: public
etat: prevu
fr:
  titre: >-
    Les conteneurs tournent sans privilège et l'image des migrations s'allège
  texte: >-
    Dans la pile de référence, chaque service abandonne toutes les capacités et
    refuse toute élévation de privilège ; l'API, le worker et les migrations
    tournent sur un système de fichiers en lecture seule. L'image `-migrate` ne
    contient plus ni source ni build : les dépendances installées (dont le CLI
    Prisma), le schéma et les migrations, sous l'utilisateur `node`. Les images publiées portent une attestation de
    provenance et un inventaire des composants (SBOM). Le `.env` d'exemple propose
    une version précise plutôt que l'étiquette mouvante `main`.
---

`cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `read_only: true` et
`/tmp` en mémoire pour `server`, `worker` et `migrate` ; `orga` reste root pour
écrire dans `ORGA_DIR` (le README dit comment fixer `user:`), sans réseau. L'étage
`migrator` part de `deps` (le CLI Prisma est une dépendance de développement de
`packages/database`), copie `packages/database/prisma` et appelle Prisma
directement : Yarn, par corepack, voudrait écrire son cache. `provenance: true`
et `sbom: true` dans les trois `docker/build-push-action`.
