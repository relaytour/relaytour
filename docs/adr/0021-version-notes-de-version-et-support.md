# ADR 0021 — Version, notes de version et support dans l'espace organisateur

- **Statut** : acceptée
- **Date** : 2026-10-07

## Contexte

Relaytour porte un seul numéro de version, et chaque changement visible porte un fragment de note (`CONTRIBUTING.md`, « Versions »). Ces notes se lisent dans la release GitHub. Une personne qui utilise l'espace organisateur ne voit ni le numéro de la version qu'elle utilise, ni ce qui a changé.

Les notes n'ont pas le même intérêt pour tous. Un fragment d'audience `organisateurs` peut décrire un écran que seuls les admins ouvrent. Une référente ou un référent lirait alors des notes sur des fonctions absentes de ses écrans.

Une personne en difficulté n'a par ailleurs aucun moyen de demander de l'aide depuis l'application. L'aide vient de deux sources : l'organisation, qui connaît son contenu et ses équipes, et l'hébergeur, quand l'installation en a un.

## Décision

### Version

- Le champ `versionInstallation` donne le numéro de version de l'installation. Il se lit sans session, comme `/health`.
- Le numéro vient du build de l'image (`APP_VERSION`). Sur un poste local, il vient du journal embarqué.
- Le menu du compte affiche ce numéro à droite de l'entrée « Notes de version ».

### Notes de version

- Les deux journaux compilés (`notes/notes-de-version.*.json`) entrent dans le build du serveur. Une installation affiche les notes des versions qu'elle contient, sans appel sortant.
- Seules les notes d'audience `organisateurs` et d'état `prevu` s'affichent. Les notes d'audience `interne` et `public` restent dans la release. La prochaine version (fragments sans numéro) ne s'affiche pas.
- Un fragment d'audience `organisateurs` porte un champ `role` : `referent`, `admin-activite` ou `admin-organisation`. Le champ désigne le rôle le moins étendu que la note concerne. Absent, il vaut `referent`.
- Le champ `notesDeVersion` exige une session et une organisation active. Le serveur déduit le rôle de la personne : admin de l'organisation, sinon admin d'au moins une activité (ADR 0010), sinon référent·e. Il rend les notes de ce rôle et des rôles moins étendus.
- La fenêtre « Notes de version » liste les versions de la plus récente à la plus ancienne. Une note réservée à des admins porte une étiquette qui le dit.

### Support

- Une organisation déclare une adresse de support (`contactSupport`) dans `organisation.yaml` ou dans l'écran « Organisation ». L'adresse suit la règle des adresses de rôle (ADR 0009).
- Un hébergeur indique sa propre action dans `SUPPORT_URL` : une page en `https://` ou une adresse en `mailto:`.
- Le champ `support` de l'organisation donne le lien du bouton : l'adresse de l'organisation en `mailto:`, sinon l'action de l'hébergeur, sinon rien. Le réglage de l'organisation l'emporte, car il est le plus précis.
- Le menu du compte affiche l'entrée « Support » quand le lien existe. Un `mailto:` sans objet reçoit un objet qui nomme l'organisation et la version. Le serveur n'envoie aucun mail.

## Conséquences

- Le journal compilé passe en `schemaVersion: 4` : chaque note porte son `role`, nul hors de l'audience `organisateurs`.
- `yarn versionner noter` reçoit l'option `--role`, et `valider` refuse un rôle inconnu ou posé sur une autre audience.
- Les fragments existants ont reçu leur rôle. Un fragment écrit avant cette décision reste valide : il vaut `referent`.
- L'étape `build` du Dockerfile copie les deux journaux. Aucune migration : `contactSupport` entre dans la déclaration de l'organisation, stockée en JSON.
- Le rôle d'une note sert à trier la lecture. Il ne protège rien : les notes sont publiques dans le dépôt et dans les releases.
- L'identité de l'organisation se lit sans session (ADR 0006). Le lien de support se lit donc sans session. Il ne porte qu'une adresse de rôle ou l'adresse choisie par l'hébergeur.
- La vérification des mises à jour et la notification d'une nouvelle version restent hors de cette décision. Elles demandent un appel sortant, donc une ADR propre.

## Revue de sécurité

- `notesDeVersion` refuse une requête sans session. Le rôle se lit dans la session, jamais dans un argument.
- `SUPPORT_URL` n'accepte que `https://` et `mailto:`. L'adresse de support d'une organisation passe par la validation des adresses. Aucun autre schéma d'URL n'atteint le lien du menu.
- Une page d'assistance s'ouvre dans un nouvel onglet avec `rel="noopener noreferrer"`.
