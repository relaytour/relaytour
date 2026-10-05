# ADR 0017 — Flux des changements poussé par le serveur

- **Statut** : acceptée
- **Date** : 2026-10-05
- Complète l'ADR 0001 : le schéma unique reçoit un type `Subscription`. Respecte l'ADR 0007 : aucun réglage de proxy ne s'ajoute.

## Contexte

Plusieurs personnes travaillent en même temps sur les mêmes tâches et les mêmes fiches. Les écrans se relisent au retour sur l'onglet et chaque minute. Une personne voit donc le travail d'une autre avec une minute de retard au plus.

Trois options étaient possibles :

- garder la relecture périodique seule ;
- ouvrir un WebSocket ;
- pousser les changements par un flux SSE (Server-Sent Events).

La relecture seule laisse deux personnes écrire sur un état vieux d'une minute. Le contrôle de conflit protège l'écriture, mais la personne ne découvre le changement qu'au moment d'enregistrer. Un WebSocket demande un second protocole, un second chemin et un réglage de plus à chaque proxy. Un flux SSE reste une réponse HTTP : il passe par le chemin de l'API.

## Décision

### Un abonnement dans le schéma unique

- Le schéma reçoit le type `Subscription` et le champ `changements`. Aucun second schéma et aucune passerelle ne s'ajoutent.
- Le flux part en SSE sur `/graphql`, pour une requête `POST` qui demande `text/event-stream`. La bibliothèque `graphql-sse` (licence MIT) le sert. Toute autre requête continue vers Apollo Server.
- Le flux n'exécute que des abonnements. Une requête ou une mutation présentée au flux est refusée : elles gardent les protections d'Apollo Server.

### Un signal, jamais une donnée

- Un changement porte une entité (tâche, fiche, périmètre, équipe, demande, notification) et des identifiants : l'objet, l'activité, le périmètre, l'édition.
- Il ne porte aucun contenu. Le navigateur relit ses écrans par les requêtes habituelles, avec ses droits.
- Le flux est un accélérateur. Sans lui, l'application fonctionne : les écrans se relisent à leur rythme.

### Qui reçoit quoi

- Un signal suit les droits de lecture. Il va aux personnes de l'organisation qui voient l'activité concernée (ADR 0014).
- Le signal d'une demande va aux admins de son activité, qui seuls lisent les demandes (ADR 0015).
- Le signal d'une notification va à son seul destinataire.
- Un flux s'ouvre avec une session et une organisation active. Il revalide la session et relit les droits au plus une fois par minute. Il se ferme quand la session est fermée, le compte archivé ou l'organisation suspendue.

### Transport entre processus

- Une écriture publie son signal sur le pub/sub de Valkey, après sa transaction. Le worker publie les notifications qu'il crée.
- La publication est bornée à une seconde et n'attend pas la réponse de la mutation. Une panne de Valkey laisse l'écriture aboutir.
- Chaque processus garde un seul abonné, sur une connexion dédiée.
- Le pub/sub n'est pas durable : un signal publié pendant une reconnexion est perdu. La relecture périodique le rattrape.

### Cycle de vie

- Le serveur ferme un flux après quinze minutes. Le navigateur en rouvre un.
- Une personne garde quatre flux ouverts au plus, par processus.
- La bibliothèque envoie un battement toutes les douze secondes.
- À l'arrêt, le serveur ferme les flux avant de vider ses connexions HTTP.

## Conséquences

- Le serveur reçoit une dépendance, `graphql-sse`.
- Les mutations des tâches, des fiches, des périmètres, de l'équipe et des demandes publient un signal. Une mutation nouvelle publie le sien.
- Un proxy placé devant l'API laisse passer une réponse longue, sans la mettre en tampon ni la compresser. La note pour les exploitants le précise.
- Avec plusieurs processus, le pub/sub relie les écritures de l'un aux flux de l'autre. La limite de flux par personne se compte par processus.
- L'indicateur de présence (« qui regarde cette tâche ») et les webhooks sortants restent hors de cette décision (feuille de route).

## Revue de sécurité

- Un signal ne contient aucune donnée. Il dit qu'une chose existe et vient de changer : il suit donc les droits de lecture, et des tests prouvent chaque refus (autre organisation, activité invisible, demande pour une personne qui n'administre pas, notification d'une autre personne, requête sans session).
- Le refus sans session se décide à l'ouverture du flux, dans l'abonnement lui-même. La portée d'un champ d'abonnement ne se vérifie qu'à chaque signal livré.
- Le signal n'expose ni l'organisation ni le destinataire d'une notification.
- Une session fermée garde son flux une minute au plus, jusqu'au signal suivant. Le flux ne lui livre alors plus rien.
- Le flux n'accepte que `POST` avec un corps JSON : une page tierce ne l'ouvre pas avec les cookies de la personne. Le mode « connexion unique » de la bibliothèque, qui réserve un flux par un jeton, reste fermé.
- Quatre flux par personne et une file de deux cents signaux par flux bornent la mémoire. Au-delà, un flux laisse les signaux à la relecture périodique.
