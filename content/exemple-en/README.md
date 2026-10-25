# English sample content

This folder describes a fictional organization, “The Valley Games”. It is the English counterpart of the French sample in `content/exemple/`. The English screenshots of the Relaytour website use it. It has two activities: a weekend sports gathering and a running club that runs all year. No real person, association, or place appears in it.

The folder follows the same structure and uses the same identifiers (slugs, keys, task template names) as the French sample. Only the human-readable values are translated. The `langue: en` key in `organisation.yaml` sets English as the default language of the organization’s members (ADR 0047).

For the structure, the available keys, the writing rules for sheets and task templates, and the import rules, read `content/exemple/README.md`. That file is written in French.

To validate this content:

```bash
yarn workspace @relaytour/server orga:valider ../../content/exemple-en
```
