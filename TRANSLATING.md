# Translating Relaytour

[Version française](TRADUIRE.md)

Relaytour exists in French and English (ADR 0047). Anyone can fix a translation or add a language with a pull request. You do not need to read French: the English catalog is your starting point.

## What gets translated

| Part | Catalog |
|---|---|
| Organizer workspace | `packages/orga/src/locales/<language>/messages.po` |
| Server emails, notifications and error messages | `packages/server/src/locales/<language>/messages.po` |
| Website and user guides | `site/en/` (a copy of `site/`, one page per file) |

Content written by an organization (sheets, task templates, areas) keeps its own language. Command-line messages, architecture decisions (`docs/adr/`) and the code stay in French.

## Reading a catalog

A catalog is a `.po` file. Each message has three useful lines:

```po
#. Statut d’une tâche
msgctxt "aucune personne"
msgid "Personne"
msgstr "Nobody"
```

- `msgid` is the French text, used as the identifier. Never change it.
- `msgstr` is the translation. An empty `msgstr` marks a message to translate; the app then shows the French text.
- A `#.` line explains a short or ambiguous word. A `msgctxt` line separates two meanings of the same text.

Edit the files in a text editor, or in a catalog editor such as [Poedit](https://poedit.net/) or Lokalize.

To translate without reading French, open the English catalog of the same part (`locales/en/messages.po`) next to yours. Both catalogs list their messages in the same order.

## Translation rules

- **Keep variables intact.** `{nom}`, `{periode}`, `{0}` keep their names. They can move inside the sentence.
- **Keep the plural structure.** In `{n, plural, one {# task} other {# tasks}}`, only the text inside the braces is translated. Add the forms your language needs (`few`, `many`) following the [CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html).
- **Keep tags in place.** `<0>link</0>` wraps the words that carry the link or the formatting, with the same number.
- **No straight apostrophe next to a brace.** In a message, `'{` escapes the brace. Use the typographic apostrophe `’`.
- **One word per notion.** The glossary in [CONTRIBUTING.md](CONTRIBUTING.md#glossaire) sets the English term of each notion: « périmètre » is area, « fiche » is sheet. For a new language, propose its column in the same pull request.
- **Neutral style.** Short sentences, one idea per sentence, no stylistic effects. Address the reader with the polite form of your language. The organization speaks as “we”. French gender-inclusive writing becomes a neutral form in your language.
- **Do not translate product names**: Relaytour, SharePoint, Google Drive, Dropbox, Nextcloud, Markdown.

## Fixing a translation

1. Create a branch `traduction/<language>-<topic>` from `develop`.
2. Edit the `msgstr`.
3. Run `yarn workspace @relaytour/orga langues:extraire` or `yarn workspace @relaytour/server langues:extraire`: it normalizes the catalog and compiles the server one.
4. Open a pull request against `develop` with the “Translation” template. English is fine.

## Adding a language

Adding a language also touches the code. A maintainer can do it for you: open an issue with the “Translation” template. Otherwise:

1. Add the language code (short BCP 47 tag: `es`, `de`, `pt-BR`):
   - in `LANGUES` of `packages/commun/src/langues.ts`;
   - in `locales` of `packages/orga/lingui.config.ts` and `packages/server/lingui.config.ts`;
   - in `packages/orga/src/lib/langue.ts`: its name in `NOMS_DES_LANGUES`, its loader in `CHARGEURS`, its antd locale in `LOCALES_ANTD`;
   - in `CATALOGUES` of `packages/server/src/lib/langue.ts`.
2. Run `yarn workspace @relaytour/orga langues:extraire` and `yarn workspace @relaytour/server langues:extraire`: both catalogs of the language are created, with every message to translate.
3. Translate the `msgstr` lines.
4. A language appears in the preferences once its organizer workspace catalog is at least 90% translated. `node outils/langues.mjs etat` shows the progress of each language.

## Checking on your machine

```bash
node outils/langues.mjs etat     # progress of each catalog
yarn check                       # lint, types, build
yarn test
yarn dev                         # then Preferences > Language in the organizer workspace
```

Emails go out in the language of their recipient. Locally, Mailpit shows them at http://localhost:4416.

## Emails and website

- A fixed text of an email template (`packages/server/src/courriel/gabarits/`) is written between double brackets, `[[Bonjour {{nom}},]]`, and lands in the server catalog. Translate it in the catalog, not in the template.
- The website exists in English under `site/en/`. A new website language starts as a copy of `site/en/` into `site/<language>/`, then each page is translated. Relative links and screenshots keep working.

## Release notes

A release note shown in the organizer workspace (`notes/fragments/`, audience `organisateurs`) carries its English version in an `en:` block, with the same fields as `fr:`. Other languages have no block yet: their readers see the note in French.

## Review

A translation is reviewed like code. A misleading link, address or instruction in a catalog blocks the pull request (ADR 0047).
