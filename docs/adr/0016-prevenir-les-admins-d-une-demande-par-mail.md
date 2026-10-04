# ADR 0016 — Prévenir les admins d'une demande par un mail regroupé

- **Statut** : acceptée
- **Date** : 2026-10-05
- Remplace, dans l'ADR 0015, la règle « Aucun mail immédiat ne part » de la section « Prévenir les admins ». Le reste de l'ADR 0015 s'applique.

## Contexte

Une demande reçue crée une notification pour les admins de l'activité, une fois par jour au plus (ADR 0015). Le résumé par mail la reprend, chaque lundi par défaut.

Une personne qui remplit le formulaire public attend une réponse. Un admin qui n'ouvre pas l'espace organisateur apprend la demande par le résumé, jusqu'à une semaine plus tard. La cloche ne suffit donc pas pendant la constitution d'une équipe.

Deux options étaient possibles :

- un mail par demande ;
- un mail regroupé, qui annonce un nombre.

Un mail par demande porterait le nom d'une personne qui n'est pas membre, ou partirait jusqu'à soixante fois par heure quand le formulaire reçoit beaucoup de dépôts.

## Décision

- Une demande reçue place un mail différé pour chaque admin à prévenir. Les destinataires sont ceux de la notification : les admins de l'activité, sinon ceux de l'organisation. La personne qui propose n'est pas prévenue de sa propre proposition.
- Les demandes d'une activité se regroupent par fenêtre fixe d'une heure. Un admin reçoit au plus un mail par activité et par heure.
- Le mail porte le nom de l'activité, un nombre de demandes et un lien vers la file de revue. Il ne cite aucune personne et aucune adresse.
- Le mail se compose à la fin de la fenêtre. Il compte les demandes de l'activité qui attendent une décision à ce moment. Une demande déjà traitée ne s'annonce pas, et aucun mail ne part quand le compte est nul.
- Le rôle se relit à l'envoi. Une personne qui n'administre plus l'activité ne reçoit rien.
- Une préférence, `mailDemandes`, désactive ce mail. Elle est active par défaut, et l'écran « Préférences » la montre aux personnes qui administrent une activité. Le mail porte le lien de désabonnement vers cet écran.
- La notification et le résumé de l'ADR 0015 restent inchangés.

## Conséquences

- Une migration additive ajoute la colonne `mailDemandes` à `PreferenceNotification`.
- La file des mails reçoit la sorte `demandes`, avec ses gabarits. L'identifiant du job porte l'activité, la personne et le début de la fenêtre : BullMQ ignore les demandes suivantes de la même heure.
- La fenêtre se déduit de l'heure du signalement, qui suit la validation de la transaction. Le mail d'une fenêtre part à sa fin : une demande signalée pendant la fenêtre est donc toujours en base quand le mail se compose. Le mail compte un état, les demandes en attente, et non les écritures d'une fenêtre : aucune marge de temps n'entre dans le calcul.
- Une demande plus ancienne, encore en attente, est comptée de nouveau dans le mail suivant. Le nombre annoncé est celui que la file de revue affiche.
- `modifierPreferencesNotification` reçoit un argument facultatif : un client qui ne l'envoie pas ne change pas le réglage.
- Les modes d'emploi décrivent le mail et son réglage.

## Revue de sécurité

- Le mail ne contient aucune donnée d'une personne qui n'est pas membre. Il révèle seulement qu'une activité a reçu des demandes, à une personne qui administre cette activité au moment de l'envoi.
- La charge utile du job ne porte que des identifiants (invariant 5). L'adresse du destinataire se relit en base à l'envoi.
- Le formulaire public reste borné par ses limites de débit. Le mail ne multiplie pas les envois : un dépôt massif produit un mail par admin et par heure.
