# ADR 0030 — Cloisonnement des organisations d'une installation partagée

- **Statut** : acceptée
- **Date** : 2026-10-10
- Remplace la règle de l'ADR 0018 « le serveur rattache le compte existant d'une autre organisation ». Précise l'ADR 0008 (compte global, appartenances multiples, premier admin d'une organisation) et l'ADR 0013 (import d'une équipe).

## Contexte

Un compte est global (ADR 0008) : une adresse a un seul compte, qui appartient à une ou plusieurs organisations. L'ADR 0018 a décidé que l'invitation d'une adresse déjà connue d'une autre organisation rattache ce compte à l'organisation de l'inviteur, sans que la personne y consente, et que la réponse de la mutation renvoie le compte tel qu'il existe, avec son nom et sa date de création.

Cette règle convient à une installation qui porte une seule organisation : le cas n'y arrive jamais. Elle ne convient pas à une installation partagée entre des organisations distinctes, comme celle d'un hébergeur :

- une organisation apprend qu'une adresse a un compte ailleurs sur l'installation, et le nom que porte ce compte ;
- une personne se retrouve membre d'une organisation qu'elle n'a pas choisie, dont les admins lisent son adresse (ADR 0018) et lui écrivent (ADR 0020) ;
- une affectation et des souhaits sont créés en son nom avant tout accord.

L'audit de sécurité d'octobre 2026 a relevé ces trois points. Le principe retenu est que les organisations d'une installation sont cloisonnées : rien ne passe de l'une à l'autre sans un geste de la personne concernée.

## Décision

### Une invitation vers une adresse connue ailleurs reste en attente

- Quand l'adresse invitée a un compte qui n'appartient pas à l'organisation, le serveur n'écrit aucune appartenance, aucune affectation, aucun souhait. Il enregistre une **invitation** : l'organisation, le compte, le rôle, le nom saisi par l'inviteur, les périmètres demandés (affectations et souhaits, avec la marque de contact principal quand elle est demandée), l'origine de l'invitation et une date d'expiration à 30 jours.
- L'origine est une personne (un admin, par `inviterPersonne` ou `accepterDemande`), l'import d'une équipe, ou l'administration de l'installation. Seule la première porte un auteur : les deux autres s'exécutent sans personne connectée.
- Le mail d'invitation part comme pour un nouveau compte. Il dit que l'organisation invite la personne, et qu'elle choisit d'accepter ou non après connexion.
- La personne voit l'invitation dans son espace organisateur, à côté de ses organisations. Elle l'**accepte** ou la **refuse**. L'acceptation crée l'appartenance, puis les affectations et les souhaits de l'invitation. Le refus supprime l'invitation sans rien dire à l'organisation : une invitation refusée ou expirée apparaît comme « sans réponse ».
- L'acceptation prévient par notification la personne qui a invité. Pour une invitation née d'un import, elle prévient les admins de l'organisation. Pour celle d'un premier admin, aucune notification ne part : l'organisation n'a pas encore d'admin, et l'hébergeur lit l'état de l'organisation par l'API d'administration.
- La marque de contact principal d'une invitation s'applique à l'acceptation seulement si le périmètre n'a pas de contact principal pour la période à ce moment-là (ADR 0011). Sinon l'affectation naît sans la marque : la désignation faite entre-temps l'emporte.
- L'expiration se contrôle à chaque lecture et à chaque mutation : une invitation dont la date est passée n'existe plus pour personne, qu'il s'agisse de l'accepter, de la relancer ou de la lister. La purge nocturne ne fait qu'effacer la ligne.
- Une invitation en attente se relance comme une invitation ordinaire (`renvoyerInvitation`), dans la même limite d'une relance par heure.

### Ce que l'organisation qui invite voit

- La réponse de `inviterPersonne` ne renvoie plus le compte : elle renvoie un résultat qui dit si la personne est **membre** (compte créé ou déjà membre) ou si son invitation est **en attente**. Dans les deux cas, l'écran affiche le nom saisi par l'inviteur. Le nom du compte existant n'est lu qu'après acceptation.
- Les admins lisent leurs invitations en attente (nom saisi, adresse, périmètres, date), les relancent et les retirent. Une invitation ne figure ni dans l'annuaire, ni dans une équipe, ni dans un sélecteur, ni dans la recherche.
- L'organisation apprend ainsi qu'un compte existe sur l'installation pour cette adresse, sans savoir où ni sous quel nom. Cette information est assumée : la masquer demanderait que toute invitation reste en attente jusqu'à la première connexion, y compris pour un compte nouveau, ce qui empêcherait les admins de constituer une équipe avant l'arrivée des personnes.

### Les scripts et le premier admin

- `equipe-importer` (ADR 0013) suit la même règle : une adresse connue d'une autre organisation donne une invitation en attente, comptée à part dans le compte rendu de l'import. L'invitation garde les affectations, les souhaits et la désignation de contact principal que le fichier déclare.
- `inviterPremierAdmin` (ADR 0008) suit la même règle : le premier admin d'une organisation neuve qui a déjà un compte ailleurs reçoit une invitation avec le rôle d'admin, et l'organisation n'a aucun admin tant qu'il ne l'a pas acceptée. L'hébergeur en est informé par la réponse.

### Ce qui ne change pas

- Un compte nouveau naît membre de l'organisation qui l'invite, avec ses affectations et ses souhaits (ADR 0018).
- Une adresse déjà membre de l'organisation reçoit la même réponse qu'un compte créé (ADR 0018).
- Une demande du formulaire public (ADR 0015) acceptée pour une adresse connue ailleurs donne aussi une invitation en attente : la demande vaut souhait de rejoindre l'équipe, pas consentement à l'appartenance, et la personne qui a rempli le formulaire n'est pas forcément la titulaire du compte.
- Le nom appartient au compte et ne change pas (ADR 0018). Une personne qui accepte une invitation apparaît ensuite avec le nom de son compte.

## Conséquences

- Une migration additive : la table `InvitationOrganisation`, dont l'auteur est facultatif et l'origine obligatoire.
- Le schéma GraphQL change : `inviterPersonne` et `accepterDemande` renvoient un résultat (`membre` ou `invitationEnAttente`) à la place d'une personne ; deux mutations `accepterInvitation` et `refuserInvitation` pour la personne ; `mesInvitations` pour la personne et `invitationsEnAttente` pour les admins ; `retirerInvitation` pour un admin.
- L'espace organisateur : une invitation en attente s'affiche dans le menu du compte, avec « Accepter » et « Refuser » ; l'écran « Personnes » et l'écran « Équipe » listent les invitations en attente de l'organisation.
- Un mail : le gabarit d'invitation dit « vous invite à rejoindre » et « vous choisissez d'accepter après connexion » quand l'invitation est en attente.
- La purge nocturne efface les invitations expirées, que les lectures et les mutations ignorent déjà.
- Un audit du cloisonnement suit cette décision : bascule d'organisation par l'en-tête, annuaire et recherche, mails et résumés, exports, images servies par empreinte, et la table des refus croisés (ADR 0010) étendue au cas « même compte, deux organisations ».

## Revue de sécurité

- Avant acceptation, aucune donnée de la personne n'est lisible par l'organisation qui invite, hors l'adresse qu'elle a elle-même saisie et le nom qu'elle a elle-même donné.
- Le refus et l'expiration ne se distinguent pas pour l'organisation.
- Une invitation expirée ne s'accepte pas, même avant le passage de la purge.
- L'acceptation exige une session de la personne : un lien dans un mail ne suffit pas, puisque le code de connexion est le seul secret (ADR 0002).
- Les contrôles se prouvent par le refus (invariant 11) : une organisation ne lit pas, ne relance pas et ne retire pas l'invitation d'une autre ; une personne n'accepte pas une invitation qui ne lui est pas adressée.
