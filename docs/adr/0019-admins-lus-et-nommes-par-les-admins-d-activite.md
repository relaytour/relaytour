# ADR 0019 — Admins lus et nommés par les admins d'activité

- **Statut** : acceptée
- **Date** : 2026-10-07
- Remplace deux règles de l'ADR 0010 : « un admin d'activité ne nomme pas d'autre admin » et « un admin d'activité lit null pour le rôle d'admin de l'organisation ». Complète l'ADR 0018 : une affectation fait aussi entrer une personne dans l'équipe dès l'invitation.

## Contexte

Trois limites sont apparues à l'usage des ADR 0010 et 0018 :

- Un admin d'activité ne sait pas qui administre l'organisation. L'écran « Rédaction » ne peut pas lui indiquer que ces personnes rédigent déjà toutes les fiches.
- Seul un admin de l'organisation nomme un admin d'activité. Une activité ne peut pas partager sa gestion sans passer par le bureau.
- Un admin d'activité invite une personne avec un périmètre souhaité, puis l'affecte dans un second temps. La plupart des invitations visent pourtant une place déjà décidée.

## Décision

### Lire les admins de l'organisation

- Tout admin d'activité lit le nom des admins de l'organisation (requête `adminsOrganisation`) et le rôle d'organisation des personnes qu'il lit déjà (`estAdmin`).
- L'adresse d'un admin de l'organisation garde la règle de l'ADR 0018. Un admin d'activité la lit seulement si cette personne fait partie de son équipe.
- Une personne qui n'administre rien lit toujours `null` pour le rôle d'une autre personne.

### Agir sur un admin de l'organisation

- Un admin d'activité n'agit pas sur un admin de l'organisation. Le serveur refuse l'affectation, le retrait d'une affectation, les souhaits, le droit de rédaction, la relance de l'invitation et la nomination comme admin d'activité.
- Le refus est explicite (`SAISIE_INVALIDE`) quand l'admin d'activité désigne la personne par son identifiant : il lit déjà son rôle.
- Une invitation par l'adresse d'un admin de l'organisation répond « Cette adresse ne peut pas être invitée », comme pour un compte archivé. L'admin d'activité n'apprend pas quel compte porte l'adresse.
- Seul un admin de l'organisation nomme ou retire un admin de l'organisation.

### Nommer un admin d'activité

- Un admin d'activité nomme et retire les admins des activités qu'il administre, parmi les personnes de ses équipes.
- Il ne retire pas son propre rôle : il ne pourrait plus le rétablir.
- Un admin de l'organisation nomme toujours tout membre admin de toute activité.

### Inviter avec une affectation

- `inviterPersonne` reçoit des périmètres affectés (`perimetresAffectes`) en plus des périmètres souhaités, pour la même période.
- Un admin d'activité invite avec au moins un périmètre, souhaité ou affecté. Le refus d'une invitation sans périmètre précède toujours toute lecture de compte.
- Une personne invitée reçoit l'invitation, qui liste ses périmètres. Une personne déjà membre apprend son affectation par le mail d'équipe (ADR 0012).

### Écran « Admins »

- Le groupe « Gérer l'organisation » du menu porte un écran « Admins », réservé aux admins de l'organisation. Il liste les admins de l'organisation, puis les admins de chaque activité.
- La nomination d'un admin de l'organisation se fait sur cet écran seulement. La fenêtre d'un compte, sur l'écran « Personnes », ne la propose plus.
- Un admin d'activité retrouve les admins sur l'écran « Personnes » de son activité, par le filtre « Admins ». Il y nomme et retire les admins de l'activité affichée, depuis la fenêtre d'un compte.

### Écrans « Personnes » et « Annuaire »

- L'écran « Personnes », dans « Gérer l'activité », liste l'équipe de l'activité affichée pour tout admin, admin de l'organisation compris. Un filtre par périmètre remplace le filtre par activité. Une invitation y porte au moins un périmètre.
- Un admin d'activité n'y gère que l'activité affichée, même s'il en administre une autre. Le serveur garde la règle de l'ADR 0018 : cette limite est celle de l'interface.
- L'écran « Annuaire », dans « Gérer l'organisation », liste tous les membres pour les admins de l'organisation. Il se filtre par activité ou sans activité, et porte le nom, l'archivage et la restauration d'un compte.

## Conséquences

- Aucune migration.
- `exigerMembreGere` porte le refus d'agir sur un admin de l'organisation. Les retraits par identifiant (`retirerAffectation`, `retirerSouhait`) et l'acceptation d'une demande appellent `refuserAdminDeLOrganisation`.
- Un admin de l'organisation déjà affecté dans une activité garde sa place. L'admin de cette activité le lit dans son équipe, sans pouvoir le modifier.

## Revue de sécurité

- Un admin d'activité apprend le nom des admins de l'organisation, pas leur adresse. Ces personnes sont les contacts attendus d'une activité.
- L'invitation ne relie pas une adresse à un rôle : sa réponse pour un admin de l'organisation est celle d'un compte archivé.
- Les contrôles se prouvent par le refus (invariant 11) : `admins-activite.integration.test.ts` joue chaque opération refusée avec la session d'un admin d'activité, et la lecture des admins avec celle d'une référente.
