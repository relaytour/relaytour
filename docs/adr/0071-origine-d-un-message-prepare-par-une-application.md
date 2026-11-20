# ADR 0071 — Origine d'un message préparé par une application

- **Statut** : proposée
- **Date** : 2026-11-20
- Complète l'ADR 0020 (messages écrits dans l'application), l'ADR 0027 (écran « Messages »), l'ADR 0064 (jetons d'accès) et l'ADR 0067 (autorisation d'applications tierces).
- Ne remplace aucune règle d'une ADR acceptée. Relaytour n'envoie toujours aucun message.

## Contexte

Un admin prépare un message dans l'espace organisateur, puis l'envoie depuis sa propre messagerie (ADR 0020). Le serveur garde le texte, les destinataires et le statut que l'auteur déclare. Le statut « en cours » désigne déjà un message préparé et non envoyé.

`creerMessage` demande la portée `gestion`. Un jeton d'accès (ADR 0064) ou un jeton d'application (ADR 0067) d'un admin d'activité peut donc créer un message. Le message porte la personne comme auteur.

Rien ne distingue ensuite ce message d'un texte écrit par la personne elle-même. L'écran « Messages » (ADR 0027) affiche l'auteur, l'objet, le corps et les destinataires. Il n'indique pas qu'un programme a rédigé le texte.

Plusieurs personnes relisent pourtant ce message :

- L'auteur ouvre plus tard le message dans sa messagerie. Il peut ne plus se souvenir qu'une application l'a préparé, ni lequel de ses accès l'a fait.
- Les autres admins de l'activité relisent les messages de l'activité. Ils croient lire un texte écrit par leur collègue.
- Un admin de l'organisation qui révoque une application ne sait pas quels messages elle a préparés.

Un texte rédigé par un programme peut contenir une erreur, une formulation inattendue ou un contenu injecté par une donnée lue. La personne qui l'envoie à des bénévoles doit savoir qu'elle relit le travail d'un programme.

Un statut « brouillon » n'apporte rien. Le statut « en cours » joue déjà ce rôle, et le message n'est jamais envoyé par Relaytour.

## Décision

### Ce que le message garde

- Un message garde l'origine de sa création : une session, un jeton d'accès ou une application autorisée.
- Pour une application autorisée, le message garde l'application (`clientApplicationId`), une copie de son nom et une copie de l'hôte de son `client_id`. Il garde aussi la source du client (`CIMD` ou `DCR`).
- Pour un jeton d'accès créé dans « Jetons et API », le message garde le jeton (`jetonAccesId`) et une copie de son libellé.
- Pour une session, ces champs restent nuls.
- Le serveur remplit ces champs à partir du jeton de la requête, jamais à partir d'un argument. Un programme ne choisit pas l'origine qu'il déclare.
- Les copies figent ce que la personne a autorisé au moment de la création. Un nom changé plus tard dans le document de métadonnées de l'application ne modifie pas un message déjà créé.

### Ce que l'API rend

- Le type `Message` gagne un champ `origine`, nul pour une session.
- `origine` porte une sorte (`APPLICATION` ou `JETON_ACCES`), un nom et, pour une application, l'hôte de son `client_id` et un booléen `nonVerifiee` (source `DCR`).
- `origine` se lit par les personnes qui lisent déjà le message : les admins de l'activité, ou les admins de l'organisation pour un message de l'annuaire. Elle n'ouvre aucune lecture de plus.
- L'API ne rend ni l'identifiant du jeton ni son aperçu. Le nom et l'hôte suffisent à reconnaître l'accès dans « Jetons et API ».

### Ce que l'écran affiche

- L'écran du message et sa ligne dans l'écran « Messages » affichent une mention sous l'auteur.
- Pour une application : « Préparé par une application : <nom> (<hôte>) ». Une application non vérifiée reçoit la mention « non vérifiée », comme sur l'écran de consentement (ADR 0067).
- Pour un jeton d'accès : « Préparé par un programme : <libellé du jeton> ».
- Les boutons qui ouvrent la messagerie restent les mêmes. La mention reste visible au-dessus d'eux.
- La mention ne s'ajoute ni à l'objet ni au corps du message. Le texte copié vers la messagerie reste celui que l'application a préparé.

### Révocation, refus et oubli de l'application

- La révocation d'une autorisation ne change pas l'origine d'un message. L'origine décrit un fait passé.
- Le refus d'une application par un admin de l'organisation ou par l'installation (ADR 0067) ne change pas non plus l'origine.
- L'installation oublie une application 30 jours après la fin de sa dernière autorisation (ADR 0067). La référence `clientApplicationId` devient alors nulle (`onDelete: SetNull`). Le nom, l'hôte et la source copiés restent, et l'écran les affiche toujours.
- La suppression d'un jeton d'accès met de même `jetonAccesId` à null. Le libellé copié reste.
- Le panneau « API » de l'écran « Organisation » indique, pour chaque autorisation, le nombre de messages en cours que l'application a préparés. L'admin qui révoque une application sait ainsi quels messages relire.
- La révocation ne supprime aucun message et n'en change pas le statut. L'auteur décide de chaque message, comme aujourd'hui.

### Hors de cette décision

- Les autres écritures d'une application (tâches, fiches, commentaires) ne gardent pas leur origine dans cette décision. Le message est le seul contenu qu'une personne transmet ensuite hors de Relaytour, à des personnes qui ne lisent pas l'application.
- Un message créé depuis l'espace organisateur avec une session reste sans origine, même si la personne a collé un texte venu d'ailleurs.

### Raisons du choix

- L'origine se déduit du jeton de la requête, qui est déjà résolu dans le contexte (ADR 0064 et 0067). Le programme ne peut ni l'omettre ni la falsifier.
- Les copies du nom et de l'hôte gardent l'information après l'oubli de l'application. Une simple référence la perdrait.
- La mention hors du corps laisse le texte intact. La personne qui envoie garde le choix de ce que reçoivent les bénévoles.

## Options écartées

### Un statut « brouillon »

- Un nouveau statut désignerait un message préparé par un programme et pas encore relu.
- Le statut « en cours » désigne déjà un message préparé et non envoyé. Un second statut ne dirait pas qui a préparé le texte.

### Une mention ajoutée au corps du message

- Le serveur ajouterait une ligne au corps : « Ce message a été préparé par une application ».
- Cette ligne partirait vers les bénévoles, alors que la personne qui envoie a relu et assumé le texte.
- L'auteur pourrait l'effacer dans sa messagerie. Les autres admins ne la verraient plus dans l'historique.

### Une simple référence à l'application

- Le message garderait seulement `clientApplicationId`.
- L'oubli d'une application, 30 jours après sa dernière autorisation, effacerait l'origine de ses messages.
- Un nom changé dans le document de métadonnées changerait l'origine affichée d'un message ancien.

### Interdire la création de messages aux applications

- `creerMessage` refuserait un jeton d'application.
- Cette option retire un usage légitime : préparer un message qu'une personne relit et envoie elle-même.
- Elle traiterait l'application autrement que la personne qui l'a autorisée. L'ADR 0064 veut qu'un jeton réduise les droits de sa personne sans en créer d'autres, et rien de plus.

## Conséquences

- Une migration additive ajoute à `Message` les colonnes `origineSorte`, `origineNom`, `origineHote`, `origineNonVerifiee`, `clientApplicationId` et `jetonAccesId`, toutes nulles. Les messages existants restent sans origine.
- Un retour à une version antérieure ignore ces colonnes. L'écran n'affiche plus la mention, sans perte de données.
- Le contrat GraphQL gagne le type de l'origine et le champ `Message.origine`. `yarn codegen` régénère les contrats.
- Le message reste hors de l'export Git (ADR 0020). L'export complet d'une organisation contient l'origine.
- Le glossaire reçoit le terme « origine d'un message » (anglais « message origin »).
- Le mode d'emploi de l'API indique qu'un message créé par un jeton porte son origine, visible par les admins.

## Revue de sécurité

Les tests de la mise en œuvre prouvent chaque contrôle par le refus :

- un message créé avec une session n'a pas d'origine ;
- un message créé avec un jeton d'application porte le nom et l'hôte de l'application, et aucun argument de `creerMessage` ne les change ;
- un message créé avec un jeton d'accès porte le libellé du jeton ;
- un admin d'une autre activité ou d'une autre organisation ne lit pas l'origine d'un message ;
- l'origine ne rend ni l'identifiant du jeton, ni son aperçu, ni son empreinte ;
- la révocation de l'autorisation, le refus de l'application et l'oubli de l'application laissent la mention du message intacte ;
- le corps et l'objet du message ne contiennent aucune mention ajoutée par le serveur.

## Plan de mise en œuvre

1. Serveur : colonnes, remplissage depuis le jeton dans `creerMessage`, champ `Message.origine`, compte des messages dans le panneau « API », tests (cette ADR, une fois acceptée).
2. Espace organisateur : mention dans l'écran du message et dans l'écran « Messages », compte dans le panneau « API ».
3. Mode d'emploi de l'API, glossaire, et passage de l'ADR à « acceptée ».
