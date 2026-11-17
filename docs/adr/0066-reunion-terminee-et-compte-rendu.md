# ADR 0066 — Réunion terminée et compte rendu

- **Statut** : proposée
- **Date** : 2026-11-17
- Complète l'ADR 0037 (agenda, réunions et abonnements) et l'ADR 0064 (accès programmatique).
- Ne modifie aucune règle de convocation ni d'annulation de l'ADR 0037.

## Contexte

Une réunion de l'agenda porte un statut stocké : `PREVUE` ou `ANNULEE` (ADR 0037). Une réunion qui a eu lieu reste donc « prévue » dans l'API, dans l'espace organisateur et pour tout programme qui lit l'agenda.

Le 17/11/2026, un programme d'assistance a lu par l'API les réunions d'une activité. Une personne lui avait demandé de clore les réunions des 2, 9 et 16 novembre, qui avaient eu lieu. Le programme n'a trouvé qu'une seule action : l'annulation. Elle aurait marqué ces trois réunions comme annulées et envoyé un mail d'annulation à chacune des 19 personnes convoquées.

L'équipe range aussi ses notes de réunion dans une fiche. Rien ne relie aujourd'hui cette fiche à la réunion qu'elle décrit.

Trois besoins se dégagent :

- Une réunion passée doit se lire comme terminée, par une personne comme par un programme.
- Une réunion terminée ne doit plus recevoir de geste qui prévient les personnes convoquées à tort.
- Une équipe veut retrouver le compte rendu d'une réunion depuis l'agenda.

### Options écartées

- **Un statut stocké « tenue », posé par une action « Clore la réunion ».** Une réunion que personne ne clôt resterait « prévue », et l'état lu dépendrait d'un oubli. L'action ajouterait aussi un geste à chaque réunion, sans information de plus que l'horaire.
- **Une migration de l'énumération `StatutReunion`.** Une version antérieure ne lirait plus une ligne au statut inconnu (invariant 8). L'état terminé se déduit de la fin de la réunion, sans écrire en base.
- **Un texte de compte rendu sur la réunion.** Une fiche porte déjà un éditeur, un historique des versions, des droits de rédaction et l'export vers le fournisseur cloud. Un second texte libre doublerait ces règles.
- **Un lien vers un document du fournisseur cloud.** Le fournisseur cloud reste facultatif (ADR 0038). Une fiche existe dans toute installation.

## Décision

### L'état d'une réunion

- Une réunion a un **état**, que le serveur déduit à la lecture : prévue, terminée ou annulée.
- Une réunion est **terminée** quand elle n'est pas annulée et que sa fin est passée. Aucun geste ne la clôt, et l'état terminé n'envoie ni mail ni notification.
- Le statut stocké ne change pas : `PREVUE` ou `ANNULEE`. Le champ GraphQL `etat` porte l'état déduit, et le champ `statut` reste lisible pour les programmes existants.
- Une réunion en cours, commencée et pas encore finie, reste prévue.

### Ce qu'une réunion terminée accepte

- Une réunion terminée ne se modifie plus et ne s'annule plus. Le serveur refuse ces deux gestes avec une erreur de saisie : un nouveau mail de convocation ou d'annulation tromperait les personnes convoquées.
- Une personne convoquée répond encore à sa convocation après la réunion. Sa réponse note sa présence.
- Les personnes qui écrivent dans l'agenda de la réunion relisent encore les convocations et les réponses nominatives.
- L'espace organisateur affiche « Terminée » dans le volet de la réunion et dans la liste de l'agenda. Le bouton de visio disparaît d'une réunion terminée.

### Le compte rendu

- Une réunion cite au plus une fiche de **compte rendu**.
- Une personne qui écrit dans l'agenda de la réunion lie la fiche, la remplace ou retire le lien. Le lien se pose avant, pendant ou après la réunion, et une réunion annulée le refuse.
- La fiche appartient à l'activité de la réunion et n'est pas archivée. Une réunion de l'agenda global cite une fiche commune ou une fiche de tout périmètre de l'activité. Une réunion de périmètre cite une fiche commune ou une fiche de son périmètre.
- La personne qui lie la fiche doit la lire (ADR 0010, 0039). Une fiche hors de ces règles vaut une fiche inconnue.
- Le lien ne change pas la version de la réunion, ni sa version iCalendar. Il n'envoie aucun mail et ne crée aucune notification. Le flux des changements publie un signal de l'agenda (ADR 0017).
- Le compte rendu se lit avec le détail de la réunion, par une personne qui lit aussi la fiche. En consultation, la réunion de périmètre ne montre ni le lien ni la fiche (ADR 0014).
- Une fiche archivée après le lien reste citée. Elle se lit selon les règles des fiches archivées.
- L'export complet de l'organisation donne le compte rendu de chaque réunion, par l'identifiant de contenu de sa fiche.

## Conséquences

- La migration ajoute une colonne facultative `compteRenduFicheId` à `Reunion`, avec une clé étrangère vers `Fiche` (suppression en `SET NULL`). Elle est additive.
- Le schéma GraphQL ajoute l'énumération `EtatReunion`, les champs `etat`, `compteRendu` et `peutLierCompteRendu` de `Reunion`, et la mutation `lierCompteRenduReunion`.
- `peutModifier` devient faux sur une réunion terminée. Un programme qui lisait ce champ pour proposer l'annulation ne la propose donc plus.
- Un programme qui lit l'agenda par l'API lit `etat` plutôt que `statut` pour savoir si une réunion a eu lieu.
- Une réunion saisie après coup, avec une date passée, se crée encore. Elle se lit aussitôt terminée.

## Hors de cette décision

- Un modèle de fiche de compte rendu, créé depuis la réunion.
- Le relevé des présences réelles, distinct des réponses aux convocations.
- Un rappel qui invite l'équipe à rédiger le compte rendu après la réunion.
