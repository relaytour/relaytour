# Traduire Relaytour

[English version](TRANSLATING.md)

Relaytour existe en français et en anglais (ADR 0047). Toute personne peut corriger une traduction ou ajouter une langue, par une pull request. Il n'est pas nécessaire de lire le français : le catalogue anglais sert de point de départ.

## Ce qui se traduit

| Partie | Catalogue |
|---|---|
| Espace organisateur | `packages/orga/src/locales/<langue>/messages.po` |
| Mails, notifications, messages d'erreur du serveur | `packages/server/src/locales/<langue>/messages.po` |
| Site et modes d'emploi | `site/en/` (copie de `site/`, une page par fichier) |

Le contenu rédigé par une organisation (fiches, tâches types, périmètres) garde sa langue. Les messages de la ligne de commande, les décisions d'architecture (`docs/adr/`) et le code restent en français.

## Lire un catalogue

Un catalogue est un fichier `.po`. Chaque message tient en trois lignes utiles :

```po
#. Statut d’une tâche
msgctxt "aucune personne"
msgid "Personne"
msgstr "Nobody"
```

- `msgid` est le texte français, qui sert d'identifiant. Il ne se modifie jamais.
- `msgstr` est la traduction. Un `msgstr` vide signale un message à traduire ; l'application affiche alors le texte français.
- Une ligne `#.` explique un mot court ou ambigu. Une ligne `msgctxt` distingue deux sens d'un même texte.

Les fichiers se modifient dans un éditeur de texte, ou dans un éditeur de catalogues comme [Poedit](https://poedit.net/) ou Lokalize.

Pour traduire sans lire le français, ouvrez à côté le catalogue anglais de la même partie (`locales/en/messages.po`). Les deux catalogues rangent leurs messages dans le même ordre.

## Règles de traduction

- **Les variables restent intactes.** `{nom}`, `{periode}`, `{0}` gardent leur nom. Elles peuvent changer de place dans la phrase.
- **Les pluriels gardent leur forme.** `{n, plural, one {# tâche} other {# tâches}}` : seul le texte entre les accolades se traduit. Ajoutez les formes que votre langue demande (`few`, `many`), selon les [règles du CLDR](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html).
- **Les balises restent en place.** `<0>lien</0>` entoure les mots qui portent le lien ou la mise en forme, avec le même numéro.
- **Pas d'apostrophe droite contre une accolade.** Dans un message, `'{` annule l'accolade. Écrivez l'apostrophe typographique `’`.
- **Un seul mot par notion.** Le glossaire de [CONTRIBUTING.md](CONTRIBUTING.md#glossaire) fixe le terme anglais de chaque notion : périmètre se dit area, fiche se dit sheet. Pour une nouvelle langue, proposez sa colonne dans la même PR.
- **Le style reste neutre.** Les phrases sont courtes, une idée par phrase, sans effet de style. La personne qui lit est vouvoyée ou interpellée par « you », selon l'usage poli de la langue. L'organisation dit « nous ». L'écriture inclusive du français devient une forme neutre de la langue cible.
- **Les noms propres ne se traduisent pas** : Relaytour, SharePoint, Google Drive, Dropbox, Nextcloud, Markdown.

## Corriger une traduction

1. Créez une branche `traduction/<langue>-<sujet>` depuis `develop`.
2. Modifiez le `msgstr` concerné.
3. Lancez `yarn workspace @relaytour/orga langues:extraire` ou `yarn workspace @relaytour/server langues:extraire` : la commande remet le catalogue en forme et compile celui du serveur.
4. Ouvrez une pull request vers `develop` avec le modèle « Traduction ».

## Ajouter une langue

L'ajout d'une langue touche aussi le code. Une personne mainteneuse peut le faire pour vous : ouvrez une issue avec le modèle « Traduction ». Sinon :

1. Ajoutez le code de la langue (balise BCP 47 courte : `es`, `de`, `pt-BR`) :
   - dans `LANGUES` de `packages/commun/src/langues.ts` ;
   - dans `locales` de `packages/orga/lingui.config.ts` et de `packages/server/lingui.config.ts` ;
   - dans `packages/orga/src/lib/langue.ts` : son nom dans `NOMS_DES_LANGUES`, son chargeur dans `CHARGEURS`, sa locale antd dans `LOCALES_ANTD` ;
   - dans `CATALOGUES` de `packages/server/src/lib/langue.ts`.
2. Lancez `yarn workspace @relaytour/orga langues:extraire` et `yarn workspace @relaytour/server langues:extraire` : les deux catalogues de la langue se créent, avec tous leurs messages à traduire.
3. Traduisez les `msgstr`.
4. Une langue apparaît dans le choix des préférences quand son catalogue de l'espace organisateur est traduit à 90 % au moins. `node outils/langues.mjs etat` affiche l'avancement de chaque langue.

## Vérifier sur votre poste

```bash
node outils/langues.mjs etat     # avancement de chaque catalogue
yarn check                       # lint, types, build
yarn test
yarn dev                         # puis Préférences > Langue dans l'espace organisateur
```

Les mails partent dans la langue de leur destinataire. En local, Mailpit les affiche sur http://localhost:4416.

## Mails et site

- Un texte fixe d'un gabarit de mail (`packages/server/src/courriel/gabarits/`) s'écrit entre doubles crochets, `[[Bonjour {{nom}},]]`, et arrive dans le catalogue du serveur. Traduisez-le dans le catalogue, pas dans le gabarit.
- Le site existe en anglais sous `site/en/`. Une nouvelle langue du site se crée en copiant `site/en/` vers `site/<langue>/`, puis en traduisant chaque page. Les liens relatifs et les captures restent valables.

## Relecture

Une traduction se relit comme du code. Un lien, une adresse ou une consigne trompeuse dans un catalogue bloque la PR (ADR 0047).
