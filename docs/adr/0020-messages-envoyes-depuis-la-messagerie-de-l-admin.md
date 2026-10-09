# ADR 0020 — Messages écrits dans l'application, envoyés depuis la messagerie de l'admin

- **Statut** : acceptée
- **Date** : 2026-10-07
- Complète l'ADR 0012 (mails d'équipe envoyés par l'application) et s'appuie sur l'ADR 0018 (personnes qu'un admin peut lire).
- Amendée par l'ADR 0027 : l'historique des messages d'une activité se lit dans l'écran « Messages ».

## Contexte

Un admin écrit souvent à son équipe : présentation de l'outil, lancement d'une période, rappel de tâches, informations du jour J, appel à bénévoles. Il le fait aujourd'hui hors de l'application. Il recopie les adresses une à une et réécrit chaque fois le même texte.

Les mails que l'application envoie elle-même sont des notifications : un code de connexion, une affectation, un rappel d'échéance (ADR 0012). Un envoi en nombre par le serveur est d'une autre nature. Il demande un service d'envoi dimensionné, une réputation d'expéditeur, une gestion des désinscriptions et un coût par message. Une petite organisation n'a ni ce budget ni ce besoin.

Chaque admin dispose déjà d'une messagerie sur son poste. Un lien `mailto:` l'ouvre avec des destinataires, un objet et un texte.

## Décision

### Ce qu'est un message

- Un message est un texte qu'un admin prépare dans l'espace organisateur, puis envoie depuis sa propre messagerie.
- L'application n'envoie aucun message. Elle compose le texte, ouvre la messagerie du poste et garde ce que l'admin a préparé.
- Le message part de l'adresse de l'admin. Les réponses lui reviennent directement.

### Qui écrit à qui

- Seuls les admins écrivent un message : l'admin de l'organisation et les admins d'activité.
- Un message d'une activité s'adresse à des personnes de l'équipe de cette activité (ADR 0018). Un admin de l'activité l'écrit depuis l'écran « Équipe » ou depuis l'écran « Personnes ».
- Un message de l'annuaire s'adresse à des membres de l'organisation, quelle que soit leur activité. Seul un admin de l'organisation l'écrit, depuis l'écran « Personnes ». Ce message ne porte aucune activité.
- Un compte archivé ne reçoit pas de message. L'auteur ne figure pas parmi ses propres destinataires : le serveur refuse un message qui le nomme.
- Un message compte 500 destinataires au plus.

### Champ des destinataires

- Un message à une seule personne utilise le champ « À ».
- Un message à plusieurs personnes utilise le champ « Cc » (adresses visibles) ou le champ « Cci » (adresses cachées). L'admin choisit.
- L'interface propose « Cci » quand l'admin écrit à toute la liste, et « Cc » quand il écrit à une sélection. Avec « Cc », un avertissement rappelle que chaque destinataire voit l'adresse des autres.
- En « Cci », le champ « À » porte l'adresse de l'auteur. Un message sans destinataire visible est souvent classé comme indésirable.
- En « Cci », l'admin peut garder les contacts principaux (ADR 0011) en copie visible.

### Modèles et informations de l'application

- L'espace organisateur propose des modèles : message libre, présentation de l'outil, lancement de la période, nouvelles de l'équipe, invitation à une réunion, message à un périmètre, rappel des tâches en cours, rappel des tâches en retard, arrivée le jour J, appel à rejoindre l'équipe, appel à bénévoles, remerciements.
- Un modèle porte des informations que l'application remplit : nom de l'organisation, de l'activité, de la période et du périmètre, dates, adresses de l'espace et du périmètre, tâches en cours et en retard, périmètres à pourvoir, lien du formulaire public.
- L'admin modifie librement l'objet et le texte. Il insère une information de l'application à l'endroit du curseur.
- Une information manquante laisse un passage entre crochets. L'interface signale les passages qui restent à compléter.
- Un message groupé porte le même texte pour tous. Aucune information ne change d'un destinataire à l'autre. Seul un message à une personne la salue par son prénom.
- Les modèles vivent dans le code de l'espace organisateur (`packages/orga/src/lib/messages.ts`). Le message garde la clé de son modèle de départ.

### Historique et statut

- Le serveur enregistre le message quand l'admin ouvre sa messagerie : objet, texte, modèle, champ, destinataires, activité, période et périmètre.
- Les destinataires s'enregistrent comme des comptes, jamais comme des adresses.
- Un message porte un statut déclaré par son auteur : « En cours » à l'ouverture de la messagerie, puis « Envoyé » ou « Annulé ». L'application ne peut pas vérifier l'envoi.
- Seul l'auteur change le statut. Il peut revenir sur sa déclaration.
- L'onglet « Messages » de l'écran « Personnes » montre l'historique : les messages de l'activité pour ses admins, tous les messages de l'organisation pour ses admins.
- Un message ne se modifie pas et ne se supprime pas dans l'interface.

### Limite du lien vers la messagerie

- Certaines messageries tronquent un lien de plus de 2 000 caractères environ.
- Au-delà, le lien ne porte plus le texte : l'application le copie, et l'admin le colle dans son message.
- Si les adresses dépassent seules cette longueur, le lien ne porte que l'objet. L'admin copie les adresses et le texte depuis la fenêtre.
- La fenêtre propose toujours la copie des adresses, de l'objet et du texte. Un admin qui utilise une messagerie en ligne s'en sert.

## Conséquences

- Une migration additive crée les tables `Message` et `MessageDestinataire`.
- Le schéma GraphQL gagne la requête `messages` et les mutations `creerMessage` et `definirStatutMessage`.
- Le flux des changements (ADR 0017) gagne l'entité `MESSAGE`. Le signal va aux admins de l'activité du message, ou aux admins de l'organisation pour un message de l'annuaire.
- L'export complet d'une organisation porte ses messages. Un message n'est jamais exporté dans le dossier de contenu.
- La suppression d'une activité supprime ses messages. La suppression d'un compte retire ce compte des destinataires.
- L'application ne sait rien de la remise d'un message : ni réception, ni ouverture, ni réponse.
- Les modèles sont les mêmes pour toutes les organisations. Une organisation qui veut ses propres modèles relève d'une décision ultérieure.
- Aucune purge ne supprime les messages d'une période archivée. Cette durée de conservation reste à décider (ticket #71).

## Revue de sécurité

- Le serveur vérifie chaque destinataire. Un compte inconnu, archivé, d'une autre organisation ou hors de l'équipe de l'activité donne le même refus, et rien n'est enregistré.
- Un admin d'activité ne crée ni ne lit un message de l'annuaire. Il ne lit pas les messages d'une autre activité.
- L'historique montre le nom des destinataires, sans adresse. Le type `Message` ne porte aucune adresse.
- Une personne qui quitte l'équipe garde son nom dans l'historique des messages qu'elle a reçus. Les admins de l'activité lisaient déjà ce nom à la date du message.
- Pour rouvrir un message, l'interface lit les adresses dans la liste que l'écran affiche. Une personne sortie de cette liste n'a plus d'adresse lisible.
- Le journal du serveur note l'identifiant du message, de son auteur et le nombre de destinataires. Il ne contient ni adresse ni texte (invariant 6).
- Le choix du champ « Cc » expose les adresses entre destinataires. L'interface avertit l'admin, qui reste responsable de son envoi.
- Les contrôles se prouvent par le refus (invariant 11) : `packages/server/src/schema/messages.integration.test.ts`.
