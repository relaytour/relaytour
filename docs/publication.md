# Publier le dépôt

Ce document liste ce qui précède l'ouverture publique de `relaytour/relaytour`, puis ce qui reste vrai ensuite.

## Avant l'ouverture, une fois

1. Le thème par défaut est propre à Relaytour : aucune identité visuelle empruntée à une organisation ne reste dans `packages/tokens` ni dans l'espace organisateur.
2. `node outils/verifier-publication.mjs` et `node outils/verifier-licences.mjs` passent.
3. L'historique ne contient aucune adresse personnelle. Vérification :
   ```bash
   git log -p | grep -oE '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,}' | sort -u
   ```
   La liste ne contient que des domaines d'exemple (`exemple.org`, `.example`), les adresses du projet (`@relaytour.org`) et l'adresse `noreply` de GitHub.
4. Les commits portent l'adresse `noreply` de GitHub de leur auteur.
5. Sur GitHub : dépôt public, branche `main` protégée, signalement privé de vulnérabilités activé (`SECURITY.md` y renvoie).
6. Le paquet `ghcr.io/relaytour/relaytour-server` est public. L'organisation GitHub doit autoriser les paquets publics (réglage « Package creation ») avant de changer la visibilité du paquet. Les workflows `valider.yml` des dépôts d'organisation lisent l'image avec `GITHUB_TOKEN`.
7. Le gabarit `relaytour/organisation-modele` existe sur GitHub et porte l'option « Template repository ».
8. Première version : lancer `yarn versionner valider` puis `yarn versionner compiler`, commiter les journaux, puis poser un tag de version (`serveur-x.y.z`, `orga-x.y.z`) qui reprend le champ `version` du `package.json` de chaque cible.
9. Les badges du README (vérifications, licence) s'ajoutent après l'ouverture : GitHub ne les affiche pas sur un dépôt privé.

## Après l'ouverture, toujours

- L'historique de `main` et de `develop` ne se réécrit plus. Les changements arrivent par PR vers `develop`, fusionnées en squash ; `main` avance jusqu'à `develop` à chaque version (CONTRIBUTING.md, « Proposer une modification »).
- Aucune donnée personnelle, aucun export, aucun secret, aucun contenu d'organisation n'entre dans le dépôt (CONTRIBUTING.md, invariant 2).
- Un changement demandé par un hébergeur entre sous une forme générique (ADR 0007).
