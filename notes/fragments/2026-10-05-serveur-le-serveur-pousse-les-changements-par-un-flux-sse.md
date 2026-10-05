---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Le serveur pousse les changements par un flux SSE
  texte: >-
    Le serveur signale chaque changement aux navigateurs abonnés : une tâche,
    une fiche, un périmètre, l'équipe, une demande ou une notification. Le
    signal ne porte aucune donnée, et l'espace organisateur s'en servira pour
    relire ses écrans sans attendre. Le flux passe par l'adresse de l'API :
    aucun réglage de proxy ne s'ajoute.
---

Type `Subscription`, champ `changements`, servi en SSE sur `/graphql` par
`graphql-sse` (`src/flux-http.ts`). `lib/flux.ts` publie sur le pub/sub de Valkey
et filtre par les droits de lecture (`peutRecevoir`). Quatre flux par personne,
quinze minutes par flux, session et droits relus chaque minute. ADR 0017.
