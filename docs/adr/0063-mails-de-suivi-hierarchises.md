# ADR 0063 — Mails de suivi hiérarchisés

- **Statut** : proposée
- **Date** : 2026-11-06
- Complète l'ADR 0026 (tâches partagées), l'ADR 0032 (notifications par organisation), l'ADR 0050 (désabonnement en un clic), l'ADR 0059 (priorités) et l'ADR 0061 (rattachement).

## Contexte

Relaytour envoie deux mails de suivi :

- le mail de rappel du jour, qui liste les tâches assignées dont l'échéance approche ou est dépassée ;
- le résumé quotidien ou hebdomadaire, qui reprend les nouvelles non lues et les échéances des 14 prochains jours.

Les deux mails rangent leurs lignes par activité seulement. Chaque ligne nomme son périmètre entre parenthèses, et une tâche en retard se mêle aux tâches à venir. Une personne qui suit plusieurs périmètres lit donc une liste plate, où les retards ne ressortent pas.

Depuis l'ADR 0061, une coordination suit les pôles par des tâches partagées, sans y être affectée. Le 05/11, une activité a rattaché 51 tâches de dix pôles à sept tâches partagées de sa coordination. La personne qui porte une tâche partagée n'apprend pourtant pas qu'une déclinaison passe en retard. Le rappel de retard ne prévient que les personnes assignées à la déclinaison, ou à défaut l'équipe de son périmètre.

Enfin, les priorités d'une période (ADR 0059) ne se lisent que dans l'application. Le modèle de message « Priorités » prépare un mail qu'un admin envoie lui-même avant le point d'équipe (ADR 0020). Une personne qui veut recevoir ces priorités chaque semaine ne peut pas s'y abonner.

## Décision

### Une mise en page commune

- Le mail de rappel, les échéances du résumé et le mail des priorités suivent la même hiérarchie :
  1. l'activité, en intertitre, ou la période quand l'activité en a plusieurs d'ouvertes ;
  2. le périmètre, en sous-titre ;
  3. une rubrique, dans un ordre fixe : « En retard », puis « Échéance proche » (ou « À venir » dans le résumé), puis « Déclinaisons en retard » ;
  4. les tâches de la rubrique.
- Une rubrique vide ne s'affiche pas. Un périmètre sans ligne ne s'affiche pas.
- Les périmètres suivent l'ordre de l'activité, comme dans l'espace organisateur.
- Une ligne de tâche ne répète plus le périmètre, que le sous-titre porte déjà. Elle donne le titre et l'échéance.
- La partie texte du mail suit la même hiérarchie, avec un retrait de deux espaces par niveau.

### Le résumé d'une tâche partagée

- Une tâche partagée qui figure dans un de ces mails affiche, en retrait sous sa ligne, le résumé de ses déclinaisons acceptées : « Déclinaisons : 2 en retard, 3 en cours, 4 faites sur 10 ».
- Le résumé donne des nombres, sans le détail des déclinaisons. Un nombre nul ne s'affiche pas.
- Une déclinaison en attente d'accord ou refusée ne compte pas (ADR 0026). Une déclinaison abandonnée sort du total, comme dans l'espace organisateur.

### Alerte de retard d'une déclinaison

- Chaque matin, le calcul des rappels ajoute une notification « déclinaison en retard ».
- Elle part vers les personnes assignées à la tâche partagée, quand une de ses déclinaisons acceptées est à faire ou en cours après son échéance.
- La tâche partagée doit elle-même être à faire ou en cours. Une tâche partagée faite ou abandonnée ne suit plus ses déclinaisons.
- Une personne déjà assignée à la déclinaison ne reçoit pas cette alerte : son propre rappel de retard la prévient.
- Sans personne assignée à la tâche partagée, aucune alerte ne part. L'équipe du périmètre de la tâche partagée n'est pas prévenue à sa place, pour ne pas multiplier les messages.
- L'alerte part une fois par déclinaison, par personne et par échéance. Une échéance repoussée puis de nouveau dépassée déclenche une nouvelle alerte.
- L'alerte s'affiche dans la cloche et dans le mail de rappel du jour. Elle ne déclenche aucune notification push (décision de Quentin, 06/11).
- Le réglage « Échéances » des préférences commande aussi son mail. La cloche l'affiche toujours.
- La notification porte le périmètre de la tâche partagée, qui est le périmètre suivi. Son lien mène à la déclinaison, que la consultation ouvre (ADR 0014).
- Dans le mail de rappel, l'alerte s'affiche sous le périmètre de la tâche partagée, dans la rubrique « Déclinaisons en retard ». La tâche partagée forme une ligne. Ses déclinaisons en retard suivent en retrait : « Ville et lieux : Réservation piscine, en retard depuis le 26 octobre ».
- Dans la cloche, l'alerte se lit : « La déclinaison « Réservation piscine » (Ville et lieux) de votre tâche « Vérifier les tâches des pôles » est en retard depuis le 26 octobre ».

### Mail des priorités

- Les préférences de notification gagnent un réglage « Mail des priorités », avec trois choix :
  - « Aucun », par défaut ;
  - « Mes périmètres » : les priorités des périmètres où la personne est affectée ;
  - « Toute l'activité » : les priorités de tous les périmètres de l'activité, comme le panneau Priorités.
- La personne choisit elle-même. Toute personne qui voit une activité lit déjà les priorités de tous ses périmètres (ADR 0059). Le choix « Toute l'activité » n'ouvre donc aucune lecture nouvelle.
- Le mail porte sur chaque période non archivée d'une activité où la personne a une place :
  - « Mes périmètres » demande une affectation dans la période ;
  - « Toute l'activité » demande une affectation dans la période, ou un rôle d'admin de l'activité ou de l'organisation.
- Une personne en découverte (ADR 0012) ou seulement rattachée (ADR 0045) ne reçoit donc rien.
- Le mail part à 7 h, dans le fuseau de l'organisation :
  - la veille de chaque point d'équipe de la période (ADR 0059) ;
  - le lundi, quand aucun point d'équipe ne tombe du lundi au dimanche suivant.
- Le mail reprend le calcul du panneau Priorités : même horizon, même score, au plus cinq tâches par périmètre. Il ajoute « et N autres » quand un périmètre en a davantage.
- En tête, une phrase annonce le prochain point d'équipe et sa date, ou la fin de l'horizon sans point prévu.
- Chaque tâche donne son titre, son échéance et ses personnes assignées. Une tâche en retard le dit. Une tâche partagée affiche le résumé de ses déclinaisons.
- Une période sans aucune priorité dans les périmètres retenus n'envoie pas de mail. Un mail ne part qu'une fois par personne, par période et par jour.
- Le lien de désabonnement du mail remet le réglage à « Aucun » (ADR 0050).

## Conséquences

- Le rendu des mails accepte une liste à trois niveaux : intertitre, sous-titre, rubrique. Chaque ligne peut porter des lignes en retrait. Chaque texte reste échappé séparément, et aucun fragment HTML ne vient d'une valeur saisie.
- `TypeNotification` gagne `DECLINAISON_EN_RETARD`, par une migration additive.
- `PreferenceOrganisation` gagne `mailPriorites`, une énumération `MailPriorites` (`AUCUN`, `MES_PERIMETRES`, `ACTIVITE`) par défaut `AUCUN`, par une migration additive.
- Le calcul des priorités sort du résolveur GraphQL dans `lib/priorites-periode.ts`, pour que le worker et l'API lisent le même classement.
- La planification gagne le job `priorites`, lancé chaque jour à 7 h dans le fuseau de l'organisation. Un nouveau gabarit `priorites` entre dans `courriel/gabarits/`.
- Le contrat GraphQL gagne le champ `mailPriorites` des préférences, et l'argument facultatif du même nom de `modifierPreferencesNotification`.
- La page des préférences propose le réglage « Mail des priorités ».
- Le désabonnement en un clic reconnaît le mail `priorites`.

## Revue de sécurité

- Le mail des priorités ne liste que des tâches que la personne lit déjà dans l'application : périmètres de son affectation, ou tous les périmètres d'une activité qu'elle voit. Une activité en découverte ou un simple rattachement n'envoient rien.
- Une personne archivée dans l'organisation ne reçoit ni alerte ni mail des priorités (ADR 0031).
- L'alerte de retard d'une déclinaison nomme une tâche d'un autre périmètre de la même activité. La consultation (ADR 0014) l'ouvre déjà à toute personne assignée à la tâche partagée.
- Une organisation en lecture seule, suspendue ou archivée ne reçoit ni rappel, ni résumé, ni mail des priorités, comme aujourd'hui.
- Les tests prouvent les refus : personne archivée, activité en découverte, déclinaison en attente ou refusée, tâche partagée close, préférence « Aucun », désabonnement.
