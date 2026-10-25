# Contributing to Relaytour

[Version française](CONTRIBUTING.md)

This file summarizes the repository rules in English. The French [CONTRIBUTING.md](CONTRIBUTING.md) is the reference: it also lists the settled decisions, the full glossary and the known pitfalls. In case of difference, the French version prevails.

## Languages

- The working language of the repository is French: code, identifiers, comments, architecture decisions (`docs/adr/`) and commit titles (ADR 0047).
- Issues and pull requests are welcome in English. A maintainer writes the conventional French title when merging.
- A comment in the code is written once, in French. If you do not write French, write your comment in English in the pull request: the review helps with the wording.
- The [glossary](CONTRIBUTING.md#glossaire) gives one French word and one English word per notion (« périmètre » = area, « référent·e » = coordinator, « fiche » = sheet). Use these words in issues, pull requests and translations.
- Translations follow [TRANSLATING.md](TRANSLATING.md).

## Packages

- `packages/server`: GraphQL API (Express 5, Apollo Server 5, Pothos), Better Auth sign-in and BullMQ worker.
- `packages/orga`: organizer workspace (React 19, Vite, React Router 7, Apollo Client 4, antd 6). GraphQL types are generated in `src/gql/`.
- `packages/tokens`: theme model and default themes. `packages/commun`: rules shared by the server and the organizer workspace.
- `packages/database`: Prisma 6 on MariaDB 11.8.
- `content/exemple`: a fictional sample organization. Real organization content lives outside this repository.
- `infra/`: minimal reference deployment. Real operations live in a separate repository (ADR 0007).
- `site/`: the website published on GitHub Pages, with its English version in `site/en/`.

## Commands

```bash
yarn setup        # install, Docker, Prisma client, migrations, contracts
yarn dev          # API (4400), worker and organizer workspace (5305)
yarn check        # lint, types, build
yarn test         # unit tests
yarn workspace @relaytour/server test:integration   # local database, worker stopped
yarn codegen      # committed contracts
yarn workspace @relaytour/orga langues:extraire     # translation catalogs after a text change
yarn workspace @relaytour/server langues:extraire   # server catalogs (emails, notifications, errors)
yarn versionner valider && yarn versionner compiler  # release notes
```

## Technical invariants (summary)

Each rule comes from a real incident or an identified risk. The French file gives the details.

1. No list of participants or coordinators reaches a browser without a server-side access check.
2. No personal data in Git, not even in the history. No organization content in this repository.
3. The environment is read from `APP_ENV`, never from `NODE_ENV`.
4. No variable switches email output: the transport follows `APP_ENV` and `COURRIEL_SMTP_HOTE`.
5. Emails go through the BullMQ queue, and the job payload carries neither body nor token.
6. Logs contain no full address, code or token.
7. Docker ports are published on `127.0.0.1` only.
8. Migrations are additive: a new meaning takes a new field name.
9. Generated contracts are committed and checked by the CI, translation catalogs included.
10. The image does not contain the source code.
11. An access check is proven by a refusal test, not by success with the right session.
12. to 18. See the French file: environment validation at import, GraphQL schema and Better Auth isolation, public fields, Better Auth routes, no personal contact in content folders, bounded Redis calls, no global uniqueness or hard-coded brand.

## Writing

- **Neutral style** for every English text (interface, emails, docs, pull requests): one idea per sentence, 25 words at most, “you” for the user, “we” for the organization, no stylistic effects, no em dashes.
- French texts follow the French rules, including mandatory gender-inclusive writing.
- A visible text in the organizer workspace or the server goes through Lingui (ADR 0047). ESLint flags a hard-coded text in a component.

## Proposing a change

1. Work in a fork or, for maintainers, in a branch. Name it `type/topic`, for example `fix/search-without-edition` or `traduction/es`.
2. Start from `develop` and target `develop`. `main` only moves when a version is published.
3. Give the pull request a conventional title (`feat(orga): …`, `fix(server): …`, `docs: …`). In English is fine: the maintainer rewrites it in French when squashing.
4. Keep one topic per pull request.
5. Fill in the pull request template.

Each pull request brings:

- `yarn check` and `yarn test` passing; `test:integration` too for a server change.
- A release note fragment for a visible change (`yarn versionner noter …`, see the French file). A note for the organizers can carry its English version in an `en:` block, with the same fields as `fr:`; `--titre-en` starts it. Without it, the note shows in French, and `valider` reports it without failing.
- A screenshot for an interface change, taken with the sample content and fictional accounts.
- A refusal test for an access-control change.
- Up-to-date generated contracts and translation catalogs.
- No organization content, no personal data, no secret.

## Review and merge

- The CI must pass and every review thread must be resolved.
- A maintainer merges with a squash: one pull request becomes one commit on `develop`.
- `develop` and `main` keep a linear history. No force push, no deletion of these branches.
