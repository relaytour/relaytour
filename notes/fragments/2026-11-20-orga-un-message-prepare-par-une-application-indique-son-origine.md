---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Un message préparé par une application indique son origine
  texte: >-
    Quand une application ou un programme prépare un message en votre nom,
    l'écran « Messages » l'indique sous l'auteur : « Préparé par une
    application », avec son nom et son hôte, ou « Préparé par un programme »,
    avec le libellé du jeton. Une application dont le nom n'est pas vérifié
    porte la mention « non vérifiée ». Les admins qui relisent le message
    savent ainsi qu'un programme a rédigé le texte. L'objet et le corps du
    message restent inchangés. Dans l'écran « Organisation », le panneau
    « API » indique le nombre de messages en cours que chaque jeton et
    chaque application ont préparés.
en:
  titre: >-
    A message prepared by an application shows its origin
  texte: >-
    When an application or a program prepares a message on your behalf, the
    “Messages” screen shows it under the author: “Prepared by an
    application”, with its name and host, or “Prepared by a program”, with
    the label of the token. An application whose name is not verified carries
    the mention “not verified”. The admins who review the message thus know
    that a program wrote the text. The subject and the body of the message
    stay unchanged. On the “Organization” screen, the “API” panel shows the
    number of in-progress messages that each token and each application
    prepared.
---

Le serveur remplit l'origine depuis le jeton de la requête dans `creerMessage`
(`origineDuJeton`, `schema/messages.ts`), jamais depuis un argument. Le message
garde des copies du nom, de l'hôte et de la source, et les références
`clientApplicationId` et `jetonAccesId` en `onDelete: SetNull`. La révocation, le
refus et la purge des applications laissent la mention intacte. Le panneau lit
`JetonOrganisation.messagesEnCours` : un jeton d'accès compte par
`jetonAccesId`, une autorisation par son application et sa personne, pour garder
les messages d'une autorisation remplacée par une réautorisation. L'export
complet d'une organisation porte l'origine, sans identifiant de jeton. ADR 0071.
