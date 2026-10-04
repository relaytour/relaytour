# ADR 0015 — Demandes pour rejoindre l'équipe

- **Statut** : acceptée
- **Date** : 2026-10-04
- Complète les ADR 0002, 0010 et 0012. L'inscription reste fermée : aucun compte ne naît sans la décision d'un admin.

## Contexte

Seul un admin invite une personne, et l'invitation crée son compte aussitôt (ADR 0002). Deux limites sont apparues pendant la constitution d'une équipe :

- Une référente connaît une personne prête à rejoindre son périmètre. Elle ne peut pas la faire entrer : elle écrit à un admin, qui ressaisit le nom et l'adresse.
- Une personne extérieure à l'organisation ne peut rien déposer. Les organisations recueillent les intérêts sur une fiche papier, puis un admin les ressaisit.

Le souhait (ADR 0012) ne répond à aucun des deux cas : il exige un compte.

Deux options étaient possibles pour la proposition d'une référente :

- lui donner le droit d'inviter, limité à son périmètre ;
- lui laisser proposer, et garder la décision aux admins.

Le droit d'inviter créerait un troisième niveau de droits, écarté par l'ADR 0011, et ouvrirait l'annuaire à une personne qui ne le lit pas.

## Décision

### Une notion nouvelle : la demande

- Une **demande** porte le nom et l'adresse d'une personne qui demande à rejoindre l'équipe d'une période, avec les périmètres qui l'intéressent.
- Une demande a deux origines. Une **proposition** vient d'une personne affectée à un périmètre, pour ce périmètre. Le **formulaire public** est rempli par la personne elle-même, sans session.
- Une demande est en attente, acceptée ou refusée. Une adresse a au plus une demande en attente par période : une seconde proposition s'ajoute à la demande existante. Chaque personne qui propose y garde sa propre ligne, même pour un périmètre déjà proposé.
- Aucun compte n'existe avant la revue. Une demande ne donne aucun accès, et aucun contrôle d'accès ne la lit.

### Proposition par une référente ou un référent

- La personne propose pour un périmètre où elle peut écrire : elle y est affectée pour la période, ou elle administre l'activité. La période n'est pas archivée.
- Elle saisit le prénom et le nom, l'adresse, et un mot facultatif de 280 caractères au plus.
- La réponse est la même que l'adresse soit inconnue, déjà membre ou déjà proposée. La proposition ne dit rien de l'annuaire.
- Une personne a au plus 20 propositions en attente.
- Elle lit ses propres propositions et leur état, sans adresse. Elle ne lit pas celles des autres. Elle retire une proposition tant que la demande attend.
- La personne proposée ne reçoit aucun mail avant la décision d'un admin.

### Revue par les admins

- Les admins de l'activité lisent ses demandes, avec l'adresse, les périmètres demandés, l'auteur de chaque proposition et son mot.
- Accepter crée le compte, ou rattache le compte existant de l'adresse (ADR 0008). L'admin choisit les périmètres à affecter. Les autres périmètres demandés deviennent des souhaits. Tout s'écrit dans une même transaction.
- Une personne nouvelle reçoit le mail d'invitation. Une personne déjà membre reçoit le mail d'équipe (ADR 0012).
- Refuser ne crée aucun compte et n'envoie aucun mail. L'adresse peut être proposée de nouveau.
- Une demande d'une période archivée ne se traite plus. Un compte archivé ne se rétablit pas par une demande.
- Les souhaits des membres gardent leur mécanisme. L'écran « Équipe » compte les demandes en attente de chaque périmètre, et l'onglet « Demandes » de l'écran « Personnes » porte la file de revue.

### Prévenir les admins

- Une demande reçue crée une notification pour les admins de l'activité. Sans admin d'activité, elle va aux admins de l'organisation.
- Chaque admin reçoit au plus une notification par activité et par jour. Elle ne cite pas la personne et mène à la file de revue.
- Le résumé par mail la reprend, comme toute notification non lue. Aucun mail immédiat ne part.

### Formulaire public

Le formulaire arrive dans une PR suivante. Cette ADR en fixe les règles.

- Un admin de l'activité ouvre et ferme le formulaire. Il est fermé par défaut, et un import de contenu ne l'ouvre jamais.
- Le formulaire présente les périmètres de l'activité par groupe, avec leur description. Il demande le prénom et le nom, l'adresse, les périmètres qui intéressent la personne, sa disponibilité parmi des paliers, un texte libre et une question complémentaire.
- Les paliers, la question complémentaire et le texte d'introduction se règlent par activité. Ils font partie du contenu (ADR 0009).
- Un dépôt se confirme par un message à l'écran. Aucun mail ne part vers une adresse saisie par un tiers.
- La réponse est toujours la même. Elle ne dit pas si l'adresse a déjà un compte.
- Le formulaire se protège sans service tiers : limites par adresse IP et par adresse mail, plafond de demandes en attente par activité, champ piège, tailles bornées, liens refusés.
- Une description de périmètre qui contient une coordonnée personnelle n'est pas publiée.

### Conservation

- Une demande vit en base seulement. Elle n'est jamais exportée dans Git (invariants 2 et 16).
- Les admins lisent les demandes d'une période jusqu'à son archivage. Une purge planifiée supprime ensuite toutes les demandes de la période, quel que soit leur état.
- Le compte, les affectations et les souhaits créés par une acceptation restent : ils suivent les règles des membres.
- La mention du formulaire public énonce cette durée et le contact pour l'accès et la suppression.

## Conséquences

- Une migration additive crée les tables `Demande` et `DemandePerimetre`, et ajoute à `Notification` le type `DEMANDE_RECUE` et la colonne `activiteId`.
- La création de compte et l'affectation passent par les fonctions partagées `creerOuRattacherCompte` et `creerAffectations`, dans la transaction de l'acceptation.
- La table des refus croisés couvre les six opérations nouvelles. Des tests prouvent le refus d'une référente d'un autre périmètre, d'un membre sans affectation et d'une requête sans session.
- Le formulaire public, la purge et l'export des demandes arrivent dans des PR suivantes.
- Un rôle bénévole reste hors de cette décision (feuille de route).

## Revue de sécurité

- Une demande porte des données d'une personne qui n'est pas membre : son nom, son adresse, et le mot d'un tiers. Seuls les admins de l'activité les lisent. La personne qui propose ne relit que le nom.
- Le mot est un texte libre sur une personne. Il est borné, visible des seuls admins, et supprimé avec la demande.
- La proposition ne révèle ni l'existence d'un compte, ni une appartenance, ni une demande déjà en attente.
- Une demande inconnue, d'une autre organisation ou d'une autre activité reçoit le même refus.
- L'acceptation ne promeut personne : le compte créé a le rôle de membre.
