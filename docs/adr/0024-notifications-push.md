# ADR 0024 — Notifications push

- **Statut** : proposée
- **Date** : 2026-10-07
- S'appuie sur l'ADR 0023 : le service worker reçoit les notifications push. Respecte l'ADR 0007 : le canal est facultatif et se règle par des variables.

## Contexte

Une personne apprend aujourd'hui un changement par la cloche de l'espace organisateur, par un mail immédiat ou par le résumé. La cloche ne prévient que sur un écran ouvert : le flux des changements se ferme quand l'onglet n'est plus visible (ADR 0017).

Sur un téléphone, une notification du système prévient la personne sans qu'elle ouvre l'application. Le standard Web Push le permet depuis un service worker. Sur iPhone, il ne fonctionne que dans l'application installée (iOS 16.4 et versions suivantes).

Une notification push ne va pas directement du serveur au téléphone. Elle passe par le service de push du navigateur : Apple, Google ou Mozilla. C'est le premier appel sortant de Relaytour vers un tiers, en dehors du mail.

## Décision

### Un canal facultatif

- Le serveur envoie les notifications push avec la bibliothèque `web-push` (licence MPL-2.0).
- Un exploitant active le canal par trois variables : `PUSH_VAPID_PUBLIQUE`, `PUSH_VAPID_PRIVEE` et `PUSH_VAPID_SUJET`. Sans elles, le serveur n'envoie rien et l'espace organisateur masque le réglage.
- La paire de clés VAPID identifie l'installation auprès des services de push. Elle se crée une fois et ne change plus : un changement de clés invalide tous les abonnements.

### Abonnement par appareil

- Une personne active les notifications sur un appareil, depuis ses préférences, par un bouton. Le navigateur lui demande alors son autorisation.
- Le serveur garde un abonnement par appareil : la personne, l'adresse fournie par le service de push, les deux clés de chiffrement et un libellé d'appareil.
- Un abonnement appartient à une personne, pas à une organisation, comme les préférences de notification.
- La personne désactive les notifications d'un appareil depuis ses préférences. La déconnexion supprime l'abonnement de l'appareil.
- Le serveur supprime un abonnement quand le service de push répond qu'il n'existe plus.

### Ce qui part en notification push

- Une notification push reprend une notification de l'application : même texte, même lien.
- Partent en push : une tâche assignée à la personne ou qui lui est retirée, la modification d'une de ses tâches par une autre personne, une échéance proche, un retard et une demande reçue.
- Ne partent pas en push : la création d'une tâche et les changements de fiche annoncés à tout un périmètre. Ils restent dans la cloche et dans le résumé.
- Une préférence par famille (tâches, échéances, demandes) coupe le push sans couper le mail. Le worker relit les préférences au moment de l'envoi.
- Un passage à « faite » ne nomme personne, comme dans l'application et dans le mail.

### Envoi

- La création d'une notification met un travail dans une file BullMQ `push`. La charge utile ne porte que l'identifiant de la notification (invariant 5).
- Le worker compose le titre et le lien avec les fonctions de la cloche (`messageNotification`, `lienNotification`), puis envoie un message par appareil.
- Le message est chiffré pour l'appareil. Le service de push le transporte sans pouvoir le lire.
- Un envoi en échec est repris par la file. Une notification lue avant l'envoi ne part pas.
- La mise en file ne lève jamais, comme celle des mails : une panne de la file laisse l'écriture aboutir.

### Sur l'appareil

- Le service worker affiche la notification. Un appui ouvre l'application sur l'écran concerné, ou y ramène une fenêtre déjà ouverte.
- L'icône de l'application porte le nombre de notifications non lues, sur les systèmes qui le permettent.
- Chaque message reçu affiche une notification. Les navigateurs retirent l'abonnement d'un site qui reçoit des messages sans rien afficher.

## Conséquences

- Le serveur reçoit une dépendance, `web-push`, un modèle `AbonnementPush` (migration additive) et une file `push`.
- Les préférences de notification reçoivent trois champs pour le push.
- `infra/compose/.env.example` porte les trois variables. La note pour les exploitants explique comment créer la paire de clés.
- Le worker ouvre des connexions sortantes vers les services de push d'Apple, de Google et de Mozilla. Un pare-feu sortant doit les laisser passer.
- La clé privée VAPID est un secret d'exploitation. Elle ne vit que dans le `.env` de l'installation.
- Le guide d'installation explique l'activation, et précise qu'un iPhone exige l'application installée.
- Le simulateur iOS n'offre pas de service de push : l'envoi se vérifie sur un téléphone, ou dans Chrome sur un poste.
- La notification d'un message (ADR 0020) et la notification d'une nouvelle version restent hors de cette décision.

## Revue de sécurité

- `abonnerPush` et `desabonnerPush` exigent une session. Une personne ne lit, ne crée et ne supprime que ses propres abonnements, et des tests prouvent chaque refus.
- L'adresse d'un abonnement doit être en `https://` et désigner le service de push d'un navigateur connu : Google, Apple, Mozilla ou Microsoft. Sans cette liste, une personne ferait appeler une adresse de son choix par le serveur. Le worker l'appelle avec un délai borné, et retire un abonnement dont l'adresse n'est plus admise.
- Une personne garde dix abonnements au plus. Au-delà, le plus ancien est retiré.
- Le journal ne contient ni l'adresse d'un abonnement ni ses clés (invariant 6).
- Le texte d'une notification push suit les règles de la cloche : il ne nomme pas la personne qui a coché une tâche, et il ne porte aucune adresse.
- Le service de push connaît l'appareil, l'heure et la taille du message. Il ne connaît ni le texte, ni la personne, ni l'organisation.
- La clé publique VAPID se lit sans session : le navigateur en a besoin pour s'abonner.
