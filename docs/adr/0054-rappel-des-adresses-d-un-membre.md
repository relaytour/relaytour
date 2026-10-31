# ADR 0054 — Rappel des adresses d'un membre

- **Statut** : proposée
- **Date** : 2026-10-31
- Complète l'ADR 0008 (administration de l'installation), l'ADR 0035 (connexion uniforme et jeton local) et l'ADR 0041 (espace bénévole).

## Contexte

Chaque installation de Relaytour a sa propre adresse. Un hébergeur qui exploite plusieurs installations sert souvent une page d'accès à la racine de son domaine. Une personne y saisit l'adresse de son espace pour l'ouvrir.

Une personne qui a oublié cette adresse ne peut pas la retrouver seule. Elle doit chercher un ancien mail ou la demander à l'équipe d'organisation. Seule l'installation sait si une adresse mail appartient à l'un de ses membres.

L'hébergeur ne doit pas apprendre qui est membre de quelle organisation. L'API d'administration de l'installation ne rend aucune donnée des membres (ADR 0008). Une page publique ne doit pas non plus révéler si une adresse est connue.

## Décision

### Une mutation d'administration

- La mutation `rappelerAdresses(courriel)` s'ouvre au seul jeton `JETON_ADMINISTRATION`, avec les mêmes règles que les autres champs de l'administration (ADR 0013 et 0035).
- Elle répond toujours vrai. La réponse ne dit jamais si l'adresse est connue, si elle est mal formée ou si une limite est atteinte.
- L'installation écrit elle-même, depuis son expéditeur habituel. L'hébergeur transmet une adresse et n'apprend rien en retour.
- La mutation reçoit une donnée personnelle en entrée, mais n'en rend aucune. La règle de l'ADR 0008 reste donc vraie : le jeton ne lit aucune donnée des membres par l'API.

### Ce que l'installation envoie

- Un compte qui a au moins une appartenance active, dans une organisation active ou en lecture seule, reçoit le mail « L'adresse de votre espace ». Le mail nomme ses organisations et mène à l'écran de connexion.
- Une fiche bénévole joignable reçoit de nouveau son lien personnel, par le mail existant de l'ADR 0041. La fiche doit avoir déjà reçu ce lien, et la personne doit avoir confirmé son adresse depuis son espace. Une adresse que l'équipe aurait saisie par erreur ne reçoit donc rien de plus que le premier mail.
- Une adresse inconnue, un compte archivé dans toutes ses organisations et une organisation suspendue ou archivée ne reçoivent rien.
- Le mail « L'adresse de votre espace » ne porte pas de `Reply-To` : l'équipe d'organisation n'est pas à l'origine de la demande. Il précise qu'une personne qui n'a rien demandé peut l'ignorer.

### Limites

- Une adresse reçoit au plus un rappel toutes les dix minutes, et trois par jour. Chaque demande compte, qu'elle mène à un mail ou non.
- Le rappel entre dans le plafond quotidien des mails (ADR 0034). Quand le plafond est atteint, le rappel ne part pas. Un rappel reporté au lendemain ne servirait plus.
- Le journal ne garde que l'adresse tronquée d'une demande limitée et le nombre de mails mis en file (invariant 6).

## Conséquences

- Un hébergeur peut proposer « Recevoir mes adresses par courriel » sur sa page d'accès. Il transmet l'adresse à chacune de ses installations, sans apprendre lesquelles la connaissent.
- La page d'accès de l'hébergeur doit répondre la même chose pour toute adresse, et limiter elle aussi les demandes. Ces règles relèvent de son exploitation (ADR 0007).
- Une personne membre de plusieurs installations reçoit un mail par installation.
- Une installation unique peut appeler la mutation depuis sa propre page d'accueil, avec les mêmes garanties.
