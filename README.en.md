# Relaytour

[Version française](README.md)

Relaytour helps an association or a volunteer group organize its recurring activities. An activity can be an event (a tournament, a sports meeting, a festival), a section that runs by season, or a body such as a board of directors. Relaytour keeps the method from one period to the next.

- **Activities**: the events, sections and bodies of an organization. Each one has its periods (edition, season or term) and its groups of areas.
- **Areas**: the parts of an activity (a sport, a department, a committee), sorted into groups and stable from one period to the next.
- **Coordinators**: the people appointed to an area for a period.
- **Tasks**: task templates with a due date relative to the first day (D-120, D+14), created again for each period, then followed in a timeline.
- **How-to sheets**: the “how to do it” of each area, versioned and handed over to the next period.
- **Open seats, interests, notifications**: what you need to build the team and meet the due dates.
- **Calendar**: the phases, key dates and meetings of each activity. Meetings are called in the app, their dates are chosen with a poll, and Outlook, Google or Apple calendars can subscribe to it.
- **Day-of schedule**: the slots of the day by venue and by time, with the people who lead or help. A volunteer record lists a person who helps without an account.
- **Cloud provider**: the association’s documents, stored in SharePoint, Google Drive, Dropbox or Nextcloud, are read in Relaytour without a copy. Sheets are exported there as Markdown and imported from there.
- **Several organizations**: one instance can serve several associations. A host administers them by script or by API. The API returns no data of an organization; only the export of an organization, written on the server, contains its names and addresses (ADR 0008).
- **Languages**: the organizer workspace, emails and notifications exist in French and English. Each person chooses their language; an organization sets its default language. The community can add a language ([TRANSLATING.md](TRANSLATING.md)).

Relaytour is free software (AGPL-3.0). You can host it yourself. Your organization’s content stays with you: the repository only contains a sample organization.

| Package | Role |
|---|---|
| `packages/server` | GraphQL API (Express, Apollo, Pothos), Better Auth sign-in and worker (BullMQ, emails). |
| `packages/orga` | Organizer workspace (React, Vite, antd). |
| `packages/database` | Prisma schema, migrations and Docker services for local development. |
| `packages/tokens` | Theme model and default Relaytour theme. Each organization declares its own in `organisation.yaml`. |
| `content/exemple` | Sample organization: identity and theme, two activities, their areas, how-to sheets and task templates. |
| `infra/` | Reference deployment: Docker Compose, a sample Caddyfile and steps to self-host. |
| `outils/versionner.mjs` | Changelog: one fragment per visible change, compiled per version into `notes/notes-de-version.<target>.json`. It also prepares the next version and the text of its release. |
| `docs/adr/` | Architecture decisions (in French). |
| `docs/feuille-de-route.md` | Changes considered after the first version (in French). |

The working language of the repository is French: code, comments, decisions and commit messages. Issues and pull requests are welcome in English. The repository rules are in [CONTRIBUTING.md](CONTRIBUTING.md), summarized in English in [CONTRIBUTING.en.md](CONTRIBUTING.en.md). Every contribution follows the [code of conduct](CODE_OF_CONDUCT.md). Report a security issue privately ([SECURITY.md](SECURITY.md)).

## Requirements

- Node 24 (`.nvmrc`) and corepack (`corepack enable`), which provides Yarn 4.
- Docker.

## Getting started

```bash
cp packages/database/.env.example packages/database/.env
cp packages/server/.env.example packages/server/.env
yarn setup        # install, Docker services, Prisma client, migrations, contracts
yarn dev          # API at http://localhost:4400/graphql, worker and organizer workspace at http://localhost:5305
yarn workspace @relaytour/server admin:creer address@example.org "First Last"   # first admin account
yarn workspace @relaytour/server edition:creer 2027 "Meeting 2027" 2027-06-05 2027-06-06   # first edition
```

Local services: MariaDB (4410), Valkey (4411), Mailpit (SMTP 4415, interface at http://localhost:4416). Adminer (http://localhost:4417) starts with `COMPOSE_PROFILES=outils yarn db:up`.

## Importing your content

```bash
yarn workspace @relaytour/server orga:valider /path/to/your/content
yarn workspace @relaytour/server orga:importer --dossier /path/to/your/content --edition 2027
```

An instance that serves several organizations requires `--organisation <slug>`, for import as for export. The expected structure, flat or with an `activites/` folder, is described in [content/exemple/README.md](content/exemple/README.md) (in French). The simplest way is to create your organization repository from the `relaytour/organisation-modele` template, which documents three ways to connect it to Relaytour. Choosing an email provider is described in [docs/courriel.md](docs/courriel.md) (in French).

The command-line tools write their messages in French.

## Commands

```bash
yarn check        # lint, types, build
yarn test         # unit tests
yarn workspace @relaytour/server test:integration   # tests on the local database (worker stopped)
yarn codegen      # schema.graphql, email templates and GraphQL types (committed contracts)
yarn db:migrate   # new Prisma migration
yarn workspace @relaytour/server courriel:essai address@example.org   # test email (worker required)
yarn workspace @relaytour/server orga:exporter --dossier /path/to/your/content   # writes all the content held by the app
```

## License

Relaytour is distributed under the [GNU AGPL-3.0](LICENSE) license. Copyright Quentin Fremeaux. Relaytour is a trademark of Quentin Fremeaux, filed in France. The name and the logo are not covered by this license ([MARQUE.md](MARQUE.md), in French).
