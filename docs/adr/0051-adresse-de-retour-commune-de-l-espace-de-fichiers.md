# ADR 0051 — Adresse de retour commune de l'espace de fichiers

- **Statut** : proposée
- **Date** : 2026-10-26
- Complète l'ADR 0038 (espace de fichiers) et respecte l'ADR 0007 (frontière entre le logiciel et son exploitation).

## Contexte

Un admin de l'organisation connecte SharePoint, Google Drive ou Dropbox par OAuth (ADR 0038). Le fournisseur renvoie ensuite la personne vers une adresse de retour, que l'exploitant inscrit dans son application. Le serveur construit cette adresse sous l'origine de l'installation : `<ORIGINE_ORGA>/medias/espace-fichiers/retour/<fournisseur>`.

Un exploitant qui sert plusieurs installations inscrit en général une seule application par fournisseur. Chaque installation lui ajoute alors une adresse de retour.

- Les trois fournisseurs comparent l'adresse reçue à une adresse inscrite, caractère par caractère. Google refuse les jokers, et Dropbox n'en propose pas.
- Microsoft limite une application à 256 adresses de retour, sans relèvement possible. Il conseille de porter la destination dans le paramètre `state` au-delà de cette limite.
- Chaque création d'installation, chaque domaine personnalisé et chaque suppression demandent un geste dans trois consoles.

## Décision

- Deux variables d'environnement, vides par défaut, ouvrent une adresse de retour commune :
  - `ESPACE_FICHIERS_RETOUR` porte l'adresse commune, en https et sans requête. Le serveur y ajoute le segment du fournisseur : `/sharepoint`, `/google` ou `/dropbox`.
  - `ESPACE_FICHIERS_RETOUR_ETIQUETTE` porte l'étiquette de l'installation : minuscules, chiffres et tirets, 63 caractères au plus. Le démarrage refuse l'adresse commune sans étiquette.
- Avec l'adresse commune, le serveur envoie cette adresse au fournisseur, à l'autorisation comme à l'échange du code.
- L'état de la connexion prend alors la forme `<étiquette>.<aléa>`. L'aléa reste celui de l'ADR 0038 : 32 octets aléatoires, à usage unique, gardés dix minutes dans Valkey avec la personne, l'organisation et le vérificateur PKCE.
- Au retour, l'installation n'accepte qu'un état de la forme qu'elle émet : son étiquette, un point, puis l'aléa. Sans adresse commune, elle n'accepte que l'aléa seul.
- Le logiciel ne fournit pas le relais. L'exploitant place à l'adresse commune un relais qui lit l'étiquette dans `state`. Le relais redirige ensuite vers `/medias/espace-fichiers/retour/<fournisseur>` de l'installation, avec la requête reçue intacte.
- Le relais tire l'adresse de l'installation d'un gabarit fixe ou d'une liste qu'il tient lui-même. Il ne prend jamais une adresse dans la requête qu'il reçoit.
- Sans ces variables, rien ne change : une installation seule garde son adresse de retour sous son origine.
- Nextcloud n'est pas concerné : sa connexion (Login Flow v2) n'utilise pas d'adresse de retour.

## Conséquences

- Chaque application de fournisseur n'inscrit qu'une adresse de retour par fournisseur. La limite de Microsoft et le geste à chaque installation disparaissent.
- Le relais ne garde aucune donnée et ne connaît aucun secret. Il voit passer un code et un état, et ne peut rien en faire : l'échange du code exige le secret de l'application et le vérificateur PKCE, que seule l'installation détient.
- Un code renvoyé à une autre installation échoue : cette installation ne trouve pas l'état dans son Valkey. L'étiquette ne donne aucun droit, elle ne fait que désigner l'installation.
- Le relais devient un point de passage commun. Une panne du relais empêche les nouvelles connexions de toutes les installations qui en dépendent. Les connexions déjà établies continuent, car le renouvellement des jetons ne passe pas par l'adresse de retour.
- Une organisation qui inscrit sa propre application chez un fournisseur y inscrit l'adresse commune de son installation, ou une installation sans adresse commune.
- Une connexion commencée avant l'ouverture de l'adresse commune échoue au retour : l'admin la relance.
- `infra/README.md` décrit les deux variables et donne un exemple de relais Caddy, sur un domaine d'exemple.

## Sécurité

- Le relais ne redirige que vers les installations de l'exploitant : le gabarit ou la liste fixe l'hôte, et l'étiquette se contrôle par la même règle que la variable. Une étiquette inconnue mène à une adresse qui ne répond pas, jamais à un site extérieur.
- Le journal d'accès du relais ne garde pas la requête : le code et l'état y passent, même s'ils ne servent qu'une fois.
- Au retour, l'installation garde tous les contrôles de l'ADR 0038 : état à usage unique, session de la personne qui a commencé la connexion, rôle d'admin de l'organisation, vérificateur PKCE.
