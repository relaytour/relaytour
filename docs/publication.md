# Publier le dépôt

Le dépôt `relaytour/relaytour` est public depuis le 18 septembre 2026. Ce document garde la liste de ce qui a précédé l'ouverture, pour une installation qui repartirait d'un dépôt privé, puis ce qui reste vrai ensuite.

L'historique de `main` antérieur au 30 septembre 2026 porte une adresse personnelle sur vingt-cinq commits (fusions faites depuis l'interface GitHub et rebase de PR de Dependabot, avant le passage à l'adresse `noreply`). Il n'est pas réécrit : une réécriture d'un dépôt public casse les tags, les releases, les clones et les forks, et les anciens commits resteraient joignables par leur empreinte. Depuis, `outils/verifier-publication.mjs` refuse en CI tout commit postérieur à cette date qui porte une adresse hors du projet.

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
8. Première version : lancer `yarn versionner publier`, ouvrir la PR `chore(version): x.y.z`, puis avancer `main` jusqu'à `develop` (CONTRIBUTING.md, « Versions »). Le workflow `publier.yml` crée le tag `vx.y.z`, la release et les images marquées du numéro.
9. Les badges du README (vérifications, licence) s'ajoutent après l'ouverture : GitHub ne les affiche pas sur un dépôt privé.

## Après l'ouverture, toujours

- L'historique de `main` et de `develop` ne se réécrit plus. Les changements arrivent par PR vers `develop`, fusionnées en squash ; `main` avance jusqu'à `develop` à chaque version (CONTRIBUTING.md, « Proposer une modification »).
- Aucune donnée personnelle, aucun export, aucun secret, aucun contenu d'organisation n'entre dans le dépôt (CONTRIBUTING.md, invariant 2).
- Un changement demandé par un hébergeur entre sous une forme générique (ADR 0007).
