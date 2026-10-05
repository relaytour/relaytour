---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Les écrans suivent le travail des autres au fil de l'eau
  texte: >-
    Quand une autre personne modifie une tâche, une fiche, un périmètre ou
    l'équipe, votre écran se met à jour en moins d'une seconde, sans recharger
    la page. La cloche fait de même pour une notification nouvelle. Ce suivi
    s'arrête quand l'onglet est caché et reprend à votre retour. Sans lui, par
    exemple derrière un réseau qui le bloque, les écrans se relisent chaque
    minute comme avant.
---

`lib/flux.ts` tient le flux des changements ouvert (ADR 0017) et relit, 400 ms
après un lot de signaux, les seules requêtes des écrans concernés
(`requetesPour`). Reprise après une panne de 1 à 30 secondes ; aucune reprise
après un refus, jusqu'au retour sur l'onglet. `lib/flux-sse.ts` ouvre le flux par
le client de `graphql-sse`. La relecture périodique passe à cinq minutes quand
le flux est ouvert.
