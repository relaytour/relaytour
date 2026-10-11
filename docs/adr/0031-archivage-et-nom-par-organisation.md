# ADR 0031 — Archivage par organisation et nom tenu par la personne

- **Statut** : proposée
- **Date** : 2026-10-11
- Remplace les règles de l'ADR 0008 « l'archivage porte sur le compte » et « un admin de l'organisation modifie le nom d'un compte ». Complète l'ADR 0030 (cloisonnement des organisations).

## Contexte

Un compte est global : une adresse a un seul compte, qui appartient à une ou plusieurs organisations (ADR 0008). Deux de ses attributs sont aujourd'hui tenus par une organisation pour toutes les autres.

- **L'archivage.** `User.archivedAt` est porté par le compte. Un admin qui archive une personne de son organisation la bloque partout : ses sessions sont fermées, et aucune autre organisation ne peut plus l'inviter. Pour limiter cet effet, l'archivage d'un compte membre d'une autre organisation est refusé, avec un message qui le dit.
- **Le nom.** Un admin modifie le nom d'un compte de son organisation. Le nom d'un compte membre d'une autre organisation ne se modifie plus, avec le même message, et aucune opération ne permet à la personne de le changer elle-même.

L'audit du cloisonnement d'octobre 2026 a relevé trois conséquences :

- une organisation produit un effet chez les autres : un compte qu'elle archive ne peut plus être invité ailleurs, et une organisation tierce l'apprend par le refus de son invitation ;
- les deux refus disent à un admin lesquels de ses membres appartiennent à une autre organisation ;
- le nom d'un compte membre de deux organisations est figé pour toujours.

Le principe de l'ADR 0030 s'applique : rien ne passe d'une organisation à une autre sans un geste de la personne concernée.

## Décision

### L'archivage porte sur l'appartenance

- Archiver une personne la retire de l'organisation, sans toucher à son compte. L'appartenance porte la date d'archivage ; une appartenance sans cette date est **active**.
- Le mot « archiver » et la mutation `archiverPersonne` restent. Leur portée change : l'organisation, et plus le compte.
- Une personne archivée dans une organisation :
  - ne peut plus la choisir comme organisation active, et ne la voit plus dans la liste de ses organisations ;
  - disparaît de l'équipe, des sélecteurs, de la recherche et des destinataires ; l'annuaire la montre encore avec l'option « comptes archivés » ;
  - ne reçoit plus ni mail ni notification push de cette organisation ;
  - garde ses affectations, ses souhaits et son historique, que le rétablissement lui rend.
- Ses autres organisations ne changent pas : elle y travaille, y reçoit ses mails, et toute organisation peut l'inviter (ADR 0030).
- L'archivage ne refuse plus un compte membre d'une autre organisation, et ne ferme plus aucune session : l'accès à l'organisation tombe à la requête suivante, puisque le contexte relit l'appartenance à chaque requête.
- Un admin ne s'archive pas lui-même, comme aujourd'hui.

### Inviter une adresse archivée

- Une adresse archivée dans l'organisation qui l'invite n'est pas invitée de nouveau : un admin de l'organisation lit « ce compte est archivé dans votre organisation » et le rétablit. Un admin d'activité reçoit le refus neutre d'aujourd'hui.
- Une adresse archivée dans une autre organisation se traite comme tout compte extérieur : une invitation à accepter (ADR 0030). L'organisation qui invite n'apprend rien de cet archivage.

### La connexion ne dépend plus de l'archivage

- Tout compte demande un code et ouvre une session, même sans aucune appartenance active. Il lit alors ses invitations en attente, et rien d'autre.
- C'est nécessaire à l'ADR 0030 : une personne archivée dans sa seule organisation doit pouvoir accepter l'invitation d'une autre.

### `User.archivedAt` devient une valeur dérivée

- Le code ne lit plus `User.archivedAt` pour décider d'un accès. Il la tient à jour : elle porte une date quand le compte n'a aucune appartenance active, et rien sinon.
- Elle sert un retour à une version antérieure, qui la lit encore : un compte archivé depuis cette décision y reste bloqué.
- La migration reporte la date d'archivage de chaque compte déjà archivé sur toutes ses appartenances. Elle est additive et ne modifie pas `User.archivedAt`.

### Le nom appartient à la personne

- La personne modifie son nom elle-même, dans ses préférences (`modifierMonNom`). Le nom vaut pour toutes ses organisations.
- Un admin de l'organisation ne modifie le nom d'une personne que tant qu'elle ne s'est jamais connectée : il corrige ainsi une faute de saisie à l'invitation. Après la première connexion, le nom ne se modifie plus que par la personne.
- La règle ne dépend d'aucune autre organisation : le refus ne dit plus si le compte en a une.

## Conséquences

- Une migration additive : `Appartenance.archiveLe`, renseignée pour les comptes déjà archivés.
- `exigerMembre` ne compte plus les autres organisations d'un compte. Les deux messages « ce compte appartient aussi à une autre organisation » disparaissent.
- Toute lecture de l'archivage d'un compte passe par l'appartenance à l'organisation concernée : contexte, annuaire, équipe, recherche, postes, messages, demandes, invitations, rappels, résumés, mails, push, export, import d'une équipe et commandes d'administration.
- `Personne.archive` rend l'archivage dans l'organisation active. L'export d'une organisation porte l'archivage de chaque appartenance.
- Le premier admin d'une organisation se compte parmi les admins actifs : une organisation dont tous les admins sont archivés peut en recevoir un nouveau par l'administration de l'installation.
- L'espace organisateur : la confirmation d'archivage dit que la personne quitte l'organisation et garde son compte ; les préférences portent le champ du nom ; la fenêtre d'une personne ne propose plus de modifier le nom d'une personne déjà connectée.
- Les modes d'emploi des trois rôles suivent.

## Revue de sécurité

- Une organisation ne produit plus aucun effet hors d'elle-même : ni blocage du compte, ni fermeture de session, ni refus d'invitation chez une autre.
- Aucune réponse ne dépend plus des autres organisations d'un compte.
- Une session reste ouverte après l'archivage dans la dernière organisation. Elle ne donne accès à aucune organisation : le contexte n'en trouve aucune d'active.
- Un compte archivé partout peut de nouveau demander un code de connexion. La limite par adresse et par jour de l'ADR 0002 borne ces envois.
- Les contrôles se prouvent par le refus (invariant 11) : une personne archivée dans A et active dans B perd A à la requête suivante et garde B ; l'admin de A ne modifie plus son nom après sa première connexion ; l'invitation de B vers une adresse archivée dans A se comporte comme pour tout compte extérieur.
