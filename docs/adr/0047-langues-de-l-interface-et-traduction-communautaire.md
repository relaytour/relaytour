# ADR 0047 — Langues de l'interface et traduction communautaire

- **Statut** : proposée
- **Date** : 2026-10-24
- Réalise le point « Traduction » de la feuille de route. Complète l'ADR 0021 (notes de version) et l'ADR 0032 (notifications composées à la lecture).

## Contexte

Relaytour est entièrement en français : l'espace organisateur, les mails, les notifications, les erreurs de l'API, le site et le code. Aucune bibliothèque d'internationalisation n'est installée. Les textes sont écrits en dur dans les composants, et la locale `fr-FR` est fixée à une quinzaine d'endroits.

Des membres d'une organisation ne lisent pas le français. Des organisations hors de France peuvent aussi adopter le logiciel. Le dépôt doit pourtant garder une langue de travail unique : un seul mainteneur le tient, et son glossaire est en français.

## Décision

### Langues et bibliothèque

- Le français est la langue source et la langue par défaut. L'anglais est la deuxième langue, maintenue par le projet.
- L'espace organisateur et le serveur utilisent Lingui. Les catalogues sont des fichiers `.po`, commités dans le dépôt, un par langue et par paquet.
- Le texte source français sert d'identifiant de message. Un commentaire de traduction lève une ambiguïté quand un mot a plusieurs sens.
- Les langues se désignent par une balise BCP 47 courte : `fr`, `en`, puis `es` ou `pt-BR` si une communauté les apporte.

### Langue d'une personne

La langue affichée se résout dans cet ordre :

1. la langue choisie par la personne dans son profil (`User.langue`) ;
2. la langue par défaut de l'organisation, déclarée dans sa configuration (`langue`) ;
3. la langue du navigateur (`Accept-Language`), pour le formulaire public, l'espace bénévole et l'écran de connexion ;
4. le français.

Une langue n'apparaît dans le sélecteur que si son catalogue est traduit à 90 % au moins. Un message absent d'un catalogue s'affiche en français.

### Ce qui se traduit

- L'interface de l'espace organisateur, avec les formats de date, l'ordre de tri et les composants d'antd.
- Les mails, dans la langue du destinataire. Les gabarits MJML gardent une seule structure, et leurs blocs de texte viennent du catalogue.
- Les notifications, dans la langue de la personne qui les lit. Elles sont déjà composées à la lecture (ADR 0032).
- Les messages d'erreur de l'API, dans la langue de la requête. Le code d'erreur (`extensions.code`) ne change pas.
- Les notes de version, quand leur fragment porte une version anglaise. Le français s'affiche sinon.
- Les groupes et les phases proposés par défaut, créés dans la langue de l'organisation.

### Ce qui ne se traduit pas

- Le contenu rédigé par une organisation : fiches, tâches types, périmètres, libellés de groupe, introduction du formulaire public. Ce contenu reste une donnée de l'organisation.
- Le fichier iCalendar, l'export d'une organisation et les messages de la ligne de commande, dans cette version.
- Le schéma GraphQL et ses descriptions, destinés aux développeurs.

### Langue du dépôt

- Le code, les identifiants, les commentaires, les ADR, le glossaire et les titres de commit restent en français. Un commentaire ne se double pas d'une traduction.
- Les issues et les PR s'écrivent en français ou en anglais. Leurs modèles sont bilingues. Le mainteneur rédige le titre conventionnel en français au moment de la fusion.
- Le glossaire de `CONTRIBUTING.md` porte le terme anglais de chaque notion. Les catalogues anglais et la documentation anglaise emploient ce terme seul.

### Contribution des traductions

- Une personne traduit par une PR qui modifie le fichier `.po` de sa langue. Le guide `TRADUIRE.md` (et sa version anglaise `TRANSLATING.md`) décrit l'ajout d'une langue, les outils et la vérification locale.
- Une personne qui ne lit pas le français traduit à partir du catalogue anglais.
- Le format `.po` permet de brancher plus tard une plateforme comme Weblate, sans migration, si le volume de contributions le justifie.

### Documentation

- `README.en.md` et `CONTRIBUTING.en.md` accompagnent leur version française. La version française fait foi.
- Le site publie la page d'accueil et les modes d'emploi en anglais sous `site/en/`, avec un sélecteur de langue. Les mails renvoient au mode d'emploi dans la langue du destinataire.
- Les ADR et le dossier `docs/` restent en français.

## Conséquences

- `User` reçoit une colonne `langue` facultative. La migration est additive.
- La configuration d'une organisation accepte une clé `langue` facultative.
- La CI extrait les messages et échoue si un catalogue commité diffère du résultat. Une règle d'ESLint signale un texte écrit en dur dans un composant.
- La publication d'une version vérifie que le catalogue anglais est complet.
- Les tests de l'espace organisateur activent le français. Leurs assertions sur les textes ne changent pas.
- Un fragment de note de version accepte une clé `en`, facultative, avec les mêmes champs que `fr`.
- Les captures des modes d'emploi anglais reprennent d'abord les captures françaises. Des captures en anglais demandent un contenu d'exemple en anglais.
- Le style neutre a un équivalent anglais : « you » pour l'utilisateur, « we » pour l'organisation, une idée par phrase, aucun effet de style. L'écriture inclusive se traduit par des formes épicènes (« they », des noms sans genre).

## Revue de sécurité

- La langue d'une personne ne se lit et ne se modifie que par la personne elle-même. Elle ne s'expose pas dans l'annuaire.
- La lecture d'`Accept-Language` n'écrit rien en base et ne crée aucune session.
- Un message traduit n'est jamais injecté comme HTML. Les balises d'un message passent par le composant `Trans` de Lingui, et les valeurs des mails restent échappées par le rendu existant.
- Une traduction communautaire se relit comme du code : un lien, une adresse ou une consigne trompeuse dans un catalogue bloque la PR. `outils/verifier-publication.mjs` parcourt aussi les catalogues.
- Lingui est publié sous licence MIT, compatible avec l'AGPL-3.0 (`outils/verifier-licences.mjs`).
