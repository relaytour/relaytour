---
cible: serveur
type: correctif
audience: public
etat: prevu
version: 0.13.0
fr:
  titre: >-
    Un retour à une version antérieure ne remplace plus l'identité d'une organisation
  texte: >-
    Au démarrage, le serveur remplaçait par les valeurs d'amorçage une
    configuration d'organisation qu'il ne savait pas lire. Un champ écrit par une
    version plus récente suffisait à déclencher ce remplacement. Le serveur
    écarte maintenant un champ inconnu et garde le reste, et il n'écrase plus
    jamais une configuration illisible. Les versions 0.12.1 et antérieures
    gardent l'ancien comportement : la note pour les exploitants décrit la
    précaution à prendre avant d'y revenir.
---

`lireDeclaration` dans `packages/server/src/lib/organisation.ts` : lecture
stricte, puis lecture sans les champs inconnus. `assurerOrganisationParDefaut`
ne complète qu'une configuration vide, et journalise `configuration-illisible`
sinon. Le champ `iconeApplication` de l'ADR 0023 est le premier à exposer ce
cas.
