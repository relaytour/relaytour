# ADR 0057 — Export pour un admin d'une installation en sommeil

- **Statut** : proposée
- **Date** : 2026-10-31
- Complète l'ADR 0008 (administration de l'installation et export d'une organisation), l'ADR 0034 (plafond quotidien des mails) et l'ADR 0054 (rappel des adresses d'un membre).

## Contexte

Un hébergeur peut garder une installation dont l'hébergement a pris fin sans la faire tourner. Sa pile reste arrêtée, et l'hébergeur sert à sa place une page statique. Cette installation est dite « en sommeil ». Ses données restent sur le disque jusqu'à la suppression.

Pendant le sommeil, un admin de l'organisation doit pouvoir récupérer ses données. Il saisit son adresse sur la page de sommeil. L'hébergeur réveille alors brièvement la pile, sans le worker, pour produire l'export. Avant la suppression, l'hébergeur fait aussi partir un dernier export à tous les admins.

L'hébergeur ne doit pas apprendre qui est admin de l'organisation. L'API d'administration ne rend aucune donnée des membres (ADR 0008), et la page de sommeil ne doit pas révéler si une adresse est connue. Le worker ne tourne pas pendant le réveil : un mail mis en file ne partirait qu'au réveil suivant.

Enfin, l'export complet n'existait que par le script `organisation:exporter` et la mutation `demanderExport` de l'hébergeur. Un admin ne pouvait pas l'obtenir depuis l'application, en particulier pendant la lecture seule qui suit la fin d'un essai.

## Décision

### Deux mutations d'administration

- Les mutations `preparerExportPourAdmin(organisation, courriel)` et `envoyerLienDExport(organisation, jeton)` s'ouvrent au seul jeton `JETON_ADMINISTRATION` (ADR 0013 et 0035).
- `preparerExportPourAdmin` vérifie que l'adresse appartient à un admin actif de l'organisation. Un admin archivé et un membre sans le rôle d'admin ne reçoivent rien. Elle écrit ensuite l'export complet dans `EXPORTS_DIR`, comme `demanderExport`, et tire un jeton aléatoire de 32 octets. Elle renvoie le nom du fichier et le jeton.
- Elle renvoie `null` quand l'adresse n'appartient à aucun admin actif, ou quand un lien est déjà parti pour l'organisation depuis moins de 24 heures. La réponse ne distingue pas les deux cas.
- Sans adresse, elle prépare le dernier export pour tous les admins actifs, sans limite de 24 heures. Elle renvoie `null` quand l'organisation n'a aucun admin actif. Une adresse vide n'équivaut pas à une absence d'adresse : elle mène à `null`.
- `envoyerLienDExport` envoie tout de suite le lien `<ORIGINE_ORGA>/sommeil/telechargement/<jeton>` à chaque destinataire, sans la file du worker. Elle répond vrai quand l'envoi n'a pas d'erreur. Un jeton inconnu, expiré ou d'une autre organisation est refusé.

### Jeton et limite

- L'installation garde dans Valkey l'empreinte SHA-256 du jeton, l'organisation et les comptes destinataires, pendant une heure. Le jeton lui-même ne se garde pas.
- L'envoi prend le jeton en une seule commande (`GETDEL`). Deux appels simultanés ne l'obtiennent donc pas tous les deux, et le lien ne part qu'une fois.
- Une panne du transport rend le jeton avec les seuls destinataires que le lien n'a pas atteints, jusqu'à sa fin de validité d'origine. La mutation lève une erreur, et l'hébergeur peut relancer l'envoi sans écrire une seconde fois aux admins déjà servis.
- Un export demandé par un admin réserve l'organisation pendant la validité de son jeton. Une autre demande rend alors `null` et n'écrit aucun fichier : le disque ne se remplit pas d'exports jamais envoyés. La réservation se pose après la vérification de l'adresse, pour qu'une adresse inconnue ne retarde pas la demande d'un admin.
- La limite de 24 heures prend le relais quand le lien est parti. La limite et la réservation se lisent avant l'adresse : une panne de Valkey se produit de la même façon pour une adresse connue ou inconnue.
- Le dernier export, préparé sans adresse, n'a ni réservation ni limite. Seul l'hébergeur l'appelle, une fois avant la suppression.
- Valkey garde ses données sur le disque (`appendonly`) : la limite tient entre deux réveils.

### Le mail

- Le mail « L'export de vos données » se compose dans la langue de l'admin (ADR 0047), aux couleurs de l'organisation. Il précise que le lien reste valable 7 jours et que le fichier contient des noms et des adresses.
- Il ne porte pas de `Reply-To`, comme le rappel des adresses (ADR 0054).
- Il entre dans le plafond quotidien des mails (ADR 0034), mais n'est jamais reporté, comme le code de connexion. Un lien reporté au lendemain arriverait après l'arrêt de la pile.
- Les adresses se relisent en base à l'envoi. Un admin archivé depuis la préparation ne reçoit pas le lien.

### Ce que l'installation ne fait pas

- L'installation ne sert pas le fichier. L'hébergeur copie le fichier de `EXPORTS_DIR` à l'emplacement que sert sa page de sommeil, sous le jeton, et le supprime après 7 jours. Ces règles relèvent de son exploitation (ADR 0007).
- L'installation ne limite pas le nombre de réveils. La page de sommeil et l'hébergeur les limitent.

### Export depuis l'application

- La requête `exportOrganisation` rend l'export complet à un admin de l'organisation, au format JSON de l'ADR 0008. L'espace organisateur la propose dans la page « Organisation », à côté de l'archive du contenu.
- Une requête ne demande pas le droit d'écriture : l'export reste possible quand l'organisation est en lecture seule, après la fin d'un essai ou quand une limite est atteinte.
- Le journal note le téléchargement, avec l'organisation et la taille du fichier.

## Conséquences

- Un hébergeur peut proposer l'export depuis la page de sommeil sans lire aucune donnée de l'organisation. Il transmet une adresse et apprend seulement si un export a été préparé.
- Le script de l'hébergeur ne doit rendre à la page de sommeil que la même réponse pour toute adresse. La durée du réveil dépend peu de l'adresse, car le démarrage de la pile domine l'écriture de l'export.
- Un admin d'une organisation en lecture seule télécharge l'export complet lui-même. Le fichier quitte alors l'installation sous sa seule responsabilité.
