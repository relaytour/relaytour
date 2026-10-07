# ADR 0023 — Application installable et écran hors connexion

- **Statut** : proposée
- **Date** : 2026-10-07
- Respecte l'ADR 0007 : aucun réglage de proxy ne s'ajoute. S'appuie sur l'identité d'une organisation (ADR 0006 et 0009).

## Contexte

Les référentes et référents ouvrent les mails et les notifications de Relaytour sur leur téléphone. L'espace organisateur a été conçu pour un écran d'ordinateur. Il ne déclare ni manifest, ni icône d'écran d'accueil, ni service worker.

Un raccourci posé aujourd'hui sur l'écran d'accueil d'un téléphone porte une icône générique et s'ouvre dans le navigateur, avec sa barre d'adresse.

Trois options étaient possibles :

- garder le site web seul, adapté aux petits écrans ;
- publier une application native par magasin d'applications ;
- rendre l'espace organisateur installable (PWA).

Une application native demande un second code, un compte de développeur par magasin et une publication par installation. Elle contredit le déploiement de référence, où une organisation héberge elle-même son installation (ADR 0004). Une application installable garde un seul code et une seule adresse.

## Décision

### Petits écrans

- Chaque écran de l'espace organisateur reste utilisable à 375 pixels de large.
- Les écrans des référentes et référents sont adaptés au téléphone. Les écrans d'administration restent utilisables, sans refonte : un tableau large défile dans son cadre.
- `docs/design-system.md` porte les règles (section « Mobile »). Une PR qui change l'interface joint une capture à 375 pixels de large.

### Manifest par organisation

- Le serveur sert un manifest par organisation, sans session, sous `/medias/application/<slug>.webmanifest`. Le chemin `/medias/` est déjà relayé par le proxy.
- Le manifest reprend l'identité publique de l'organisation : nom, sigle comme nom court, couleur primaire, premier sol comme couleur de fond.
- Le champ `start_url` et le champ `id` portent le slug de l'organisation. Une installation qui porte plusieurs organisations donne ainsi une application par organisation.
- L'affichage est `standalone` : l'application installée s'ouvre sans barre d'adresse.
- Le navigateur lit le lien du manifest dans la page. L'espace organisateur le pose quand il connaît l'organisation, avec l'icône d'écran d'accueil et la couleur du thème.

### Icône d'application

- Une organisation déclare une icône d'application dans son `organisation.yaml` : un PNG carré de 512 pixels de côté. L'import vérifie le format et les dimensions.
- L'icône est une image de l'organisation (ADR 0009) : elle vit en base et se sert sous `/medias/`.
- Sans icône déclarée, le manifest utilise l'icône de Relaytour livrée avec l'espace organisateur.
- Le serveur ne redimensionne aucune image, et aucune dépendance de traitement d'image ne s'ajoute. Si un navigateur exige une seconde taille, l'organisation la déclarera dans un second champ.

### Service worker

- L'espace organisateur enregistre un service worker, servi à la racine (`/sw.js`).
- Le service worker garde en cache la coquille de l'application : la page, les scripts, les styles et les polices du build.
- Il ne garde aucune donnée. Il n'intercepte ni `/graphql`, ni `/api/auth/`, ni `/medias/`.
- Une navigation interroge d'abord le réseau. Sans réseau, le service worker rend la coquille gardée en cache.
- La bibliothèque `vite-plugin-pwa` (licence MIT) produit la liste des fichiers du build. Le code du service worker reste dans le dépôt (`packages/orga/src/sw.ts`).

### Hors connexion

- Sans réseau, l'espace organisateur affiche un écran « Hors connexion ». L'écran propose de réessayer, et l'application reprend au retour du réseau.
- Aucune fiche ni aucune tâche ne se lit hors connexion. Une lecture hors connexion demanderait de garder des données sur le téléphone, donc une décision propre.

### Mise à jour

- Le navigateur compare `/sw.js` à sa copie à chaque ouverture, sans tenir compte du cache HTTP.
- Quand une nouvelle version attend, l'espace organisateur affiche un avis et un bouton « Recharger ». Il ne recharge jamais une page de lui-même : la personne peut être en train d'écrire.
- Cette vérification reste interne à l'installation. Elle ne fait aucun appel sortant (ADR 0021).

### Guide d'installation

- Le menu du compte porte l'entrée « Installer l'application ». La fenêtre décrit les étapes du téléphone utilisé, ou déclenche l'installation quand le navigateur le permet.
- Le site porte une page de mode d'emploi commune à tous les rôles.

## Conséquences

- La déclaration d'une organisation reçoit un champ pour l'icône d'application. Aucune migration : la déclaration est stockée en JSON.
- `packages/orga` reçoit une dépendance de build, `vite-plugin-pwa`.
- Sur iPhone, l'application installée a un stockage séparé de Safari. Le lien du mail de connexion s'ouvre dans Safari : dans l'application installée, la personne saisit le code reçu (ADR 0002).
- Un exploitant ne règle rien. La note `infra/README.md` précise que `/sw.js` ne doit pas recevoir de cache long.
- Les anciens fichiers du build restent sur le disque après une mise à jour (`infra/README.md`). Une application ouverte sur l'ancienne version continue donc de fonctionner jusqu'au rechargement.
- Les raccourcis d'icône, le partage vers l'application et la lecture hors connexion restent hors de cette décision.

## Revue de sécurité

- Le manifest ne contient que des champs déjà publics de l'organisation (ADR 0006). Une organisation inconnue ou suspendue reçoit une réponse 404.
- Le service worker ne met en cache aucune réponse de l'API. Une déconnexion ne laisse donc aucune donnée sur l'appareil.
- Le service worker ne répond qu'aux requêtes de sa propre origine.
- L'icône d'application suit les contrôles des images : type vérifié, taille bornée, réponse servie avec sa politique de contenu.
