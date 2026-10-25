<!--
Le titre de la PR suit le format des commits conventionnels : feat(orga): …,
fix(server): …, docs: …. Avec la fusion en squash, il devient le message du commit
fusionné, en français. Un titre en anglais convient : la personne qui fusionne le
reformule.

The title follows the conventional commit format: feat(orga): …, fix(server): …,
docs: …. With the squash merge, it becomes the commit message, in French. An English
title is fine: the maintainer who merges rewrites it.
-->

## Résumé · Summary

<!-- Ce que la PR change, et pourquoi. Une idée par phrase. · What the PR changes, and why. One idea per sentence. -->

## Type de changement · Type of change

- [ ] Correctif · Fix
- [ ] Évolution · Feature
- [ ] Documentation
- [ ] Traduction · Translation
- [ ] Maintenance (dépendances, CI, outillage · dependencies, CI, tooling)

## Captures · Screenshots

<!-- Pour un changement d'interface : l'écran avant et après, avec le contenu d'exemple et des comptes fictifs. · For an interface change: the screen before and after, with the sample content and fictional accounts. -->

## Vérifications · Checks

- [ ] `yarn check` et `yarn test` passent. · `yarn check` and `yarn test` pass.
- [ ] Pour un changement du serveur : `yarn workspace @relaytour/server test:integration` passe. · For a server change: `test:integration` passes.
- [ ] Un changement de contrôle d'accès est prouvé par un test de refus. · An access-control change is proven by a refusal test.
- [ ] Les contrats générés et les catalogues de traduction sont à jour (`yarn codegen`, `langues:extraire`). · Generated contracts and translation catalogs are up to date.
- [ ] Un changement visible porte son fragment de note de version, validé et compilé. · A visible change carries its release note fragment, validated and compiled.
- [ ] La PR ne modifie pas le champ `version` des `package.json`, sauf s'il s'agit d'une PR de publication. · The PR does not change the `version` field of `package.json`, except for a release PR.
- [ ] Les textes suivent le style neutre de `CONTRIBUTING.md` (et l'écriture inclusive en français). · Texts follow the neutral style of `CONTRIBUTING.en.md`.
- [ ] La PR ne contient aucun contenu d'organisation, aucune donnée personnelle et aucun secret. · The PR contains no organization content, no personal data and no secret.
