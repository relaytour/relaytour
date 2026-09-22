<!--
Le titre de la PR suit le format des commits conventionnels, en français :
feat(orga): …, fix(server): …, docs: …. Il devient le message du commit fusionné.
-->

## Résumé

<!-- Ce que la PR change, et pourquoi. Une idée par phrase. -->

## Type de changement

- [ ] Correctif
- [ ] Évolution
- [ ] Documentation
- [ ] Maintenance (dépendances, CI, outillage)

## Captures

<!-- Pour un changement d'interface : l'écran avant et après, avec le contenu d'exemple et des comptes fictifs. -->

## Vérifications

- [ ] `yarn check` et `yarn test` passent.
- [ ] Pour un changement du serveur : `yarn workspace @relaytour/server test:integration` passe.
- [ ] Un changement de contrôle d'accès est prouvé par un test de refus.
- [ ] Les contrats générés sont à jour (`yarn codegen`).
- [ ] Un changement visible porte son fragment de note de version, validé et compilé.
- [ ] La PR ne modifie pas le champ `version` des `package.json`, sauf s'il s'agit d'une PR de publication.
- [ ] Les textes suivent le style neutre et l'écriture inclusive de `CONTRIBUTING.md`.
- [ ] La PR ne contient aucun contenu d'organisation, aucune donnée personnelle et aucun secret.
