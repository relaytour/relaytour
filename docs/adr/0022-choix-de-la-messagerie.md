# ADR 0022 — Choix de la messagerie qui reçoit un message

- **Statut** : proposée
- **Date** : 2026-10-07
- Complète l'ADR 0020 (messages écrits dans l'application, envoyés depuis la messagerie de l'admin).

## Contexte

L'ADR 0020 ouvre la messagerie de l'admin par un lien `mailto:`. Ce lien ouvre l'application de mail par défaut de l'appareil. Une page web ne peut pas en désigner une autre.

Beaucoup d'admins lisent leurs mails dans un navigateur (Gmail, Outlook sur le web) et n'ont jamais réglé d'application par défaut. Le lien ouvre alors une application qu'ils n'utilisent pas, et ils recopient le message à la main.

Deux autres moyens existent. Une messagerie en ligne accepte une adresse de composition, qui ouvre un nouveau message dans un onglet. Certaines applications répondent à un schéma d'URL qui leur est propre.

## Décision

### Les cibles

- L'admin choisit la cible qui reçoit ses messages, parmi une liste fixée dans le code (`packages/orga/src/lib/messagerie.ts`).
- La cible par défaut reste le lien `mailto:` de l'ADR 0020.
- Cinq messageries en ligne s'ouvrent dans un nouvel onglet : Gmail, Outlook sur le web (compte professionnel ou associatif), Outlook.com (compte personnel), Yahoo Mail et Proton Mail.
- Deux applications s'ouvrent par leur schéma d'URL : Gmail (`googlegmail://`) et Outlook (`ms-outlook://`).
- Une cible nouvelle s'ajoute à cette liste avec sa source. Aucune adresse de composition ne se saisit dans l'interface.

### Ce que chaque cible reprend

| Cible | Adresse | Systèmes | Champs Cc et Cci |
|---|---|---|---|
| Messagerie par défaut | `mailto:` (RFC 6068) | tous | repris |
| Gmail | `https://mail.google.com/mail/?view=cm&fs=1` | tous, dans un navigateur | repris |
| Outlook sur le web | `https://outlook.cloud.microsoft/mail/deeplink/compose?mailtouri=` | tous, dans un navigateur | repris (lien `mailto:` entier) |
| Outlook.com | `https://outlook.live.com/mail/0/deeplink/compose?mailtouri=` | tous, dans un navigateur | non confirmés |
| Yahoo Mail | `https://compose.mail.yahoo.com/` | tous, dans un navigateur | non confirmés |
| Proton Mail | `https://mail.proton.me/inbox/#mailto=` | tous, dans un navigateur | repris (lien `mailto:` entier) |
| Application Gmail | `googlegmail:///co` | iOS et iPadOS seulement | non confirmés |
| Application Outlook | `ms-outlook://compose` | iOS, iPadOS et Android ; ni macOS ni Windows | non confirmés |

- Outlook pour Mac déclare le schéma `ms-outlook:` et refuse l'adresse `compose` (« hôte d'URL inconnu », essai du 7 octobre 2026 sur la version 16.113). Sur un ordinateur, Outlook s'ouvre par `mailto:` quand il est l'application par défaut.
- Outlook sur le web ignore un paramètre `bcc` : le message s'ouvre sans les adresses cachées. Il reprend les champs « Cc » et « Cci » d'un lien `mailto:` entier passé dans `mailtouri` (essai du 7 octobre 2026 sur un compte professionnel). La même forme sert pour Outlook.com, sans essai.
- Le lien vise `outlook.cloud.microsoft`, le domaine actuel d'Outlook sur le web. Depuis `outlook.office.com`, une reconnexion renvoie vers ce domaine sans rouvrir le message (constaté dans Firefox le 7 octobre 2026). Le lien direct ouvre le message au premier clic dans Chrome et dans Firefox.
- Seul Proton Mail documente son adresse de composition. Les autres adresses sont d'usage courant, sans engagement de leur éditeur.
- Une cible dont les copies ne sont pas confirmées porte la marque `copiesEtablies: false`. La fenêtre de rédaction demande alors à l'admin de relire les champs « Cc » et « Cci » dans sa messagerie.
- La limite de 2 000 caractères de l'ADR 0020 vaut pour toutes les cibles. Le texte, puis les adresses, sortent du lien dans le même ordre.

### Où le choix se garde

- Le choix se garde dans le navigateur de l'admin (`localStorage`, clé `relaytour.messagerie`), jamais sur le serveur.
- Une cible dépend de l'appareil : une application installée sur un téléphone ne l'est pas sur un ordinateur. Un réglage par compte ouvrirait une cible absente sur un autre appareil.
- Ce choix n'entraîne ni migration, ni champ GraphQL.
- L'écran « Préférences » porte le réglage, pour les admins seulement. La fenêtre « Écrire un message » reprend ce réglage et permet de le changer pour un message, sans modifier le réglage.
- Un message rouvert depuis l'historique s'ouvre dans la cible du réglage.

### L'essai d'une application

- Aucun navigateur ne dit à une page si une application répond à un schéma d'URL.
- Le réglage propose donc un essai : l'application ouvre un message adressé à l'admin seul, en « À » et en « Cci ».
- La page observe pendant 2,5 secondes si elle perd le focus ou devient masquée. Sans ce signal, elle avertit que l'application ne semble pas s'être ouverte. Ce signal est un indice.
- L'admin répond ensuite lui-même : le message d'essai s'est ouvert, ou non. Sa réponse fait foi.
- Une application ne s'enregistre comme réglage qu'après un essai confirmé. Les autres cibles s'enregistrent sans essai.
- La fenêtre de rédaction laisse choisir une application sans essai, pour un message. Une icône d'avertissement et son explication l'accompagnent.

### Mode d'emploi

- La page `site/modes-d-emploi/messagerie.html` décrit chaque cible, le réglage de l'application par défaut de chaque système et l'essai.
- L'interface lie cette page depuis le réglage et depuis l'explication de chaque icône. L'adresse se compose à partir de `MODES_D_EMPLOI_URL`, comme celle des autres modes d'emploi.

## Conséquences

- Le serveur ne change pas. L'historique et le statut d'un message restent ceux de l'ADR 0020.
- L'application ne sait pas plus qu'avant si un message est parti.
- Un éditeur peut changer son adresse de composition sans préavis. La correction passe par une version de Relaytour ; d'ici là, l'admin revient à la messagerie par défaut ou copie le message.
- Un admin qui change d'appareil ou de navigateur retrouve la messagerie par défaut.
- Un schéma d'URL sans application installée ne produit rien dans la plupart des navigateurs. Certains navigateurs peuvent afficher une page d’erreur à la place de l'espace organisateur : le message est déjà enregistré, et l'admin le rouvre depuis l'historique.

## Revue de sécurité

- Une adresse de composition porte les adresses des destinataires, l'objet et le texte. Elle part vers le fournisseur de messagerie que l'admin a choisi, qui recevrait ces données à l'envoi.
- Cette adresse reste dans l'historique du navigateur de l'admin, comme un lien `mailto:` suivi dans une messagerie en ligne. Le fragment de Proton Mail ne part pas vers son serveur.
- La fenêtre de rédaction réserve l'onglet d'une messagerie en ligne pendant le clic, puis y charge la messagerie après l'enregistrement du message. Un onglet ouvert après cette attente serait bloqué par le navigateur. Elle ferme l'onglet si l'enregistrement échoue.
- Cet onglet réservé perd son lien avec l'espace organisateur (`opener`) avant de charger la messagerie. La messagerie reçoit en référent l'origine de l'espace organisateur, sans chemin : le domaine d'une installation n'est pas un secret.
- Les autres liens web (essai, réouverture) s'ouvrent avec `rel="noopener noreferrer"`.
- La liste des cibles est fixe. Aucune saisie de l'admin ni aucune donnée du serveur ne compose l'origine d'un lien.
- Une cible qui ignore le champ « Cci » ouvre le message sans ces destinataires. Aucune adresse cachée ne passe dans un champ visible.
- Le message d'essai ne porte que l'adresse de l'admin. Il n'est pas enregistré.
- Le journal du serveur ne reçoit rien de ce choix (invariant 6).
