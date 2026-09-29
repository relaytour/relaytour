---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
version: 0.8.0
fr:
  titre: >-
    Une commande importe l'équipe d'une période depuis le serveur
  texte: >-
    La commande equipe-importer lit un fichier qui décrit les personnes d'une
    activité : affectations, contacts principaux et souhaits. Elle crée ce qui
    manque, ne retire rien et n'envoie aucun mail sans l'option
    --envoyer-mails. JETON_ADMINISTRATION_LOCAL limite le jeton de
    l'hébergeur aux requêtes locales.
---

- `scripts/equipe-importer.ts`, logique dans `lib/equipe-import.ts`, entrée
  `equipe-importer` dans `tsup.config.ts` et dans le garde-fou de la CI.
- `lib/requete-locale.ts` : une requête relayée par Caddy porte
  `X-Forwarded-For`.
- `infra/` : variable `JETON_ADMINISTRATION_LOCAL` et section « Constituer une
  équipe depuis le serveur ».
- ADR 0013.
