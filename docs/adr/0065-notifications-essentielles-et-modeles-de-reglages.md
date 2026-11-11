# ADR 0065 — Notifications essentielles, modèles de réglages et fenêtre de regroupement

- **Statut** : proposée
- **Date** : 2026-11-09
- Complète l'ADR 0011 (contact principal), l'ADR 0028 (assignation entre référents), l'ADR 0029 (commentaires), l'ADR 0032 (préférences par organisation), l'ADR 0033 (notifications d'admin) et l'ADR 0063 (mails de suivi).
- Remplace la règle de l'ADR 0011 « Les rappels et les notifications ne changent pas. » Le contact principal reste une information sans droit supplémentaire.

## Contexte

Le 09/11, l'adresse d'un périmètre a reçu ce résumé :

> Léa Martin a retiré Paul Durand de la tâche « Relire les catégories » (Natation).
> Léa Martin s'occupe de la tâche « Relire les catégories » (Natation).

La personne qui lit cette adresse n'est ni l'autrice ni la personne retirée. Elle reçoit ces lignes parce qu'elle est affectée au périmètre. Quatre défauts expliquent ce mail.

1. **Chaque référent reçoit toute l'activité de ses périmètres.** Une assignation entre deux autres personnes, une modification, un commentaire ou une fiche modifiée arrivent chez toute l'équipe. Le seul filtre est le réglage « Activité de vos périmètres », coché par défaut.
2. **Aucune notification de tâche n'est regroupée.** Un retrait suivi d'un ajout produit deux notifications. Le mail « une de vos tâches a été modifiée » part à chaque enregistrement.
3. **Le résumé empile les lignes.** Il reprend les 30 dernières notifications non lues, une par ligne. Il reprend aussi celles qu'un mail immédiat a déjà portées.
4. **Les rôles ne servent pas au routage.** Une tâche en retard sans personne assignée prévient toute l'équipe du périmètre, alors qu'un contact principal est désigné pour être sollicité en premier.

Les réglages actuels sont une douzaine d'interrupteurs. Aucun ensemble ne correspond à un rôle. Une personne qui veut recevoir moins ne sait pas quoi couper.

Une équipe qui reçoit trop de notifications cesse de les lire. Les notifications utiles se perdent alors avec les autres.

## Décision

Par défaut, chaque personne ne reçoit que ce qui la concerne et ce qui lui demande une action. Elle peut choisir un modèle de réglages plus complet selon son rôle, ou régler chaque point.

### L'importance d'une notification

Chaque notification reçoit, pour chaque destinataire, une **importance** calculée à sa création :

- **Vous concerne** : la personne est nommée, assignée ou convoquée, ou elle doit agir ;
- **Suivi** : un fait utile à la conduite du périmètre ;
- **Détail** : le reste de l'activité du périmètre.

| Événement | Vous concerne | Suivi | Détail |
|---|---|---|---|
| Assignation, retrait | La personne assignée ou retirée | Les autres personnes assignées | Les autres référents |
| Tâche modifiée, commentée, statut autre que « faite » | Les personnes assignées | | Les autres référents |
| Tâche passée à « faite » | Les personnes assignées | Les autres référents | |
| Tâche créée | La personne assignée | Les référents, quand la tâche n'a personne | Les référents, quand la tâche a quelqu'un |
| Déclinaison proposée | Les contacts principaux du périmètre cible, ou à défaut ses référents | Les autres référents du périmètre cible | |
| Déclinaison acceptée ou refusée | La personne qui l'a proposée | Les référents du périmètre d'origine | |
| Échéance proche, retard | Les personnes assignées. Sans personne assignée : les contacts principaux, ou à défaut l'équipe | | |
| Déclinaison en retard (ADR 0063) | Les personnes assignées à la tâche partagée | | |
| Fiche connexe | | Les référents du périmètre cible | |
| Fiche créée ou modifiée | | | Les référents |
| Réunion, sondage, place modifiée | La personne concernée | | |
| Demande reçue, candidature, souhait de formule, accès à valider, bénévole retiré | Les admins | | |
| Invitation acceptée | L'admin qui a invité | | |
| Demande traitée par un autre admin, affectation, personne, rôle d'admin | | | Les admins |

- Le contact principal reçoit en premier ce qui demande une réponse du périmètre : une déclinaison à accepter, une tâche sans personne qui arrive à échéance. Sans contact principal, toute l'équipe la reçoit, comme aujourd'hui.
- L'importance ne remplace pas le niveau de notification de l'ADR 0033 (référent, admin d'activité, admin de l'organisation). Elle s'y ajoute.

### Les réglages de suivi

Les préférences d'une organisation (ADR 0032) gagnent trois réglages :

- **Suivi de vos périmètres**, avec trois choix :
  - « Ce qui vous concerne », par défaut ;
  - « L'essentiel du périmètre », qui ajoute le Suivi ;
  - « Tout le détail », qui ajoute le Détail.
- **Tout le détail des périmètres dont vous êtes contact principal**, décoché par défaut. Il ajoute le Détail pour ces seuls périmètres.
- **Suivi d'admin**, avec deux choix :
  - « Les actions à mener », par défaut ;
  - « Tout le détail ».

Ces réglages remplacent les interrupteurs « Activité de vos périmètres » et « Nouvelles de l'équipe ».

Une notification n'est créée que pour les destinataires dont le réglage couvre son importance. Une notification qui vous concerne s'affiche toujours dans la cloche. Ses mails et ses notifications push suivent les réglages actuels.

### Les modèles de réglages

Un **modèle de notifications** remplit tous les réglages en un geste. La personne peut ensuite changer un réglage. La page affiche alors « Personnalisé ».

| Réglage | Essentiel | Référent·e | Contact principal | Admin d'activité |
|---|---|---|---|---|
| Suivi de vos périmètres | Ce qui vous concerne | L'essentiel du périmètre | L'essentiel du périmètre | L'essentiel du périmètre |
| Détail des périmètres de contact | Non | Non | Oui | Non |
| Suivi d'admin | Les actions à mener | Les actions à mener | Les actions à mener | Tout le détail |
| Résumé par mail | Hebdomadaire | Hebdomadaire | Quotidien | Quotidien |
| Mail des priorités (ADR 0063) | Mes périmètres | Mes périmètres | Mes périmètres | Toute l'activité |
| Mails de vos tâches, échéances, demandes | Oui | Oui | Oui | Oui |
| Push de l'équipe | Non | Non | Non | Oui |

- Le modèle Essentiel s'applique par défaut à toute personne, quel que soit son rôle.
- La page des préférences recommande le modèle du rôle le plus large de la personne dans l'organisation : Admin d'activité pour un admin, Contact principal pour un contact principal d'une période non archivée, Essentiel pour toute autre personne. Le modèle Référent·e reste un choix de la personne. La page n'applique pas ce modèle d'office.
- Le serveur ne garde pas le nom du modèle. Il le déduit des réglages. Un changement dans la définition d'un modèle ne modifie donc les réglages de personne.
- Les autres réglages (fréquence du résumé, mails immédiats, familles de push) gardent leur sens actuel.

### La proposition du modèle du rôle

- Un changement de rôle ne change pas les réglages (décision de Quentin, 09/11). L'espace propose alors le modèle du nouveau rôle, sans l'appliquer.
- Un avis discret, en bas de l'écran, propose le modèle recommandé quand les réglages de la personne ne le suivent pas. Il se montre au plus une fois par jour et par navigateur.
- L'avis porte trois actions : « Appliquer », « Voir mes préférences » et « Ne plus proposer ». Le refus se garde dans l'organisation. Un changement de place ou un modèle appliqué l'efface, et la proposition revient alors si les réglages ne suivent pas le rôle.
- La notification « Votre place dans l'équipe a changé » invite à adapter ses notifications à son rôle, et son lien mène aux préférences.
- La désignation d'un contact principal prévient dans l'application la personne nommée et celle qui perd ce rôle. Aucun mail ne part (ADR 0012).
- Le mail d'équipe ajoute la proposition quand le nouveau rôle appelle un autre modèle que les réglages de la personne.

### L'avis d'une nouvelle notification

- Une notification qui arrive dans la cloche pendant que l'espace est ouvert s'annonce par un avis discret, en bas de l'écran, pendant dix secondes.
- L'avis nomme l'activité et le périmètre, puis reprend le texte de la notification. Un clic sur l'avis ou sur « Ouvrir » mène à l'objet de la notification et la marque comme lue. « Voir dans la cloche » ouvre la cloche.
- Les notifications déjà présentes à l'ouverture de l'espace ne s'annoncent pas. Au-delà de trois nouvelles notifications à la fois, un seul avis les compte.
- Les notifications d'admin gardent leur écran et ne s'annoncent pas.
- Une saisie en cours (une fiche, une tâche ou un commentaire) demande une confirmation avant de quitter la page, depuis un avis comme depuis la cloche. Le brouillon d'une fiche reste gardé dans le navigateur (ADR 0038).

### La fenêtre de regroupement

- Les notifications de création, de modification, de statut, d'assignation et de retrait d'une tâche attendent la fin d'une **fenêtre** fixe de 10 minutes, comme le mail d'équipe (ADR 0012).
- Pendant la fenêtre, la notification n'apparaît ni dans la cloche, ni dans le résumé, ni en push.
- À la fin de la fenêtre, le serveur compare l'état de la tâche avant et après la fenêtre, pour chaque destinataire :
  - une personne retirée puis remise, ou ajoutée puis retirée, ne fait l'objet d'aucune notification ;
  - un statut revenu à sa valeur de départ ne fait l'objet d'aucune notification ;
  - plusieurs modifications donnent une seule notification et un seul mail ;
  - une tâche supprimée pendant la fenêtre ne laisse aucune notification.
- Le push et le mail d'une notification de tâche partent donc au plus 10 minutes après l'action.
- Un commentaire reste immédiat (ADR 0029). Il ne s'annule pas comme une assignation.
- Une fenêtre fixe peut séparer un retrait et un ajout de part et d'autre de sa fin. Le résumé regroupe alors les deux lignes de la même tâche (voir plus bas).

### Les mails

- Le résumé ne reprend plus une notification qu'un mail immédiat a déjà portée.
- Le résumé regroupe les notifications d'une même tâche sur une ligne, qui donne l'effet net sur la période : « Léa Martin s'occupe de la tâche « Relire les catégories » à la place de Paul Durand ».
- Les commentaires d'une même tâche forment aussi une ligne : « Léa Martin et une autre personne ont laissé 3 commentaires sur la tâche « Relire les catégories » ». La cloche garde une ligne par commentaire.
- Le résumé range ses lignes par activité, puis par périmètre, comme les mails de l'ADR 0063.
- Au-delà de 30 lignes, le résumé l'indique : « et 12 autres nouvelles dans l'application ».
- Le mail des priorités gagne une rubrique « Vos nouvelles » pour une personne en résumé hebdomadaire. Cette rubrique reprend ses notifications non lues, qui comptent ensuite comme résumées.
- Le mail des priorités part aussi quand une période n'a aucune priorité, si la personne a des nouvelles.
- Le résumé hebdomadaire du lundi ne part pas quand un mail des priorités a porté les nouvelles dans les six jours précédents. Le mail des priorités remplace donc le résumé hebdomadaire.
- Une personne sans affectation, par exemple un admin seul, ne reçoit pas de mail des priorités. Elle garde son résumé hebdomadaire.
- Le lien de désabonnement du mail des priorités le remet à « Aucun » (ADR 0050). Le résumé hebdomadaire reprend alors.

### Les réglages existants

- Un rattrapage unique, fait par la migration, règle chaque membre actif de chaque organisation selon son rôle du jour (décision de Quentin, 09/11) :
  - un admin de l'organisation ou d'une activité reçoit le modèle Admin d'activité ;
  - un contact principal d'une période non archivée reçoit le modèle Contact principal ;
  - tout autre membre reçoit le modèle Essentiel.
- Le rattrapage vaut aussi pour les personnes qui ont déjà enregistré leurs préférences. Il applique les réglages du modèle, pour que la page affiche ce modèle.
- Le rattrapage ne rallume jamais un mail coupé :
  - un résumé réglé sur « Jamais » le reste, et un résumé hebdomadaire passe à chaque jour pour les modèles qui le demandent ;
  - un mail immédiat coupé le reste ;
  - le mail des priorités prend la valeur du modèle seulement quand il valait « Aucun » avec un résumé hebdomadaire, c'est-à-dire les réglages par défaut d'avant cette décision.
- Une personne qui avait coupé un de ces mails garde donc des réglages personnalisés.
- Après le rattrapage, un changement de rôle ne change plus les réglages. La page recommande le nouveau modèle.
- Une note de version d'audience `organisateurs` annonce le changement et indique où choisir un modèle.

## Options écartées

- **Des préférences par type d'événement.** Une trentaine de cases à cocher demandaient de connaître chaque événement. Personne ne les aurait réglées.
- **Un abonnement par périmètre.** Il multipliait les réglages pour un gain faible, comme les préférences par activité écartées par l'ADR 0032. Le contact principal couvre le cas d'une personne qui suit un périmètre de près.
- **Un modèle appliqué d'office selon le rôle.** Les réglages auraient changé à chaque nomination, sans action de la personne. Une personne nommée contact principal aurait reçu plus de mails sans l'avoir choisi.
- **Une fenêtre glissante.** Une suite de modifications rapprochées aurait repoussé la notification sans limite. La fenêtre fixe borne le délai à 10 minutes.
- **Un filtre au moment de la lecture.** La notification serait créée pour toute l'équipe, puis masquée. La table aurait grossi d'autant, et le nombre de la cloche aurait demandé le même filtre partout.

## Conséquences

- Une migration additive ajoute à `PreferenceOrganisation` les colonnes `suiviPerimetres` (énumération `SuiviPerimetres` : `MOI`, `SUIVI`, `DETAIL`), `detailContactPrincipal` et `suiviAdmin` (énumération `SuiviAdmin` : `ACTIONS`, `DETAIL`). Les colonnes `applicationPerimetre` et `applicationEquipe` restent en base et ne sont plus écrites.
- La même migration passe le défaut de `mailPriorites` à `MES_PERIMETRES`. Elle fait ensuite le rattrapage par rôle, et crée une ligne de préférences pour chaque membre actif qui n'en a pas.
- `Notification` gagne `disponibleLe`, nul pour une notification visible. `Journal` gagne `statutPrecedent`, écrit à chaque changement de statut.
- `lib/importance-notifications.ts` porte le classement, et `lib/modeles-notification.ts` les modèles. Les points d'émission des notifications de tâche, de fiche et de retard passent par le même calcul des destinataires.
- La file `planification` reçoit le job `consolider-tache`, mis en file au premier événement d'une tâche dans une fenêtre.
- Le contrat GraphQL gagne les trois réglages, les champs `modele`, `modeleRecommande` et `propositionModele`, et les mutations `appliquerModeleNotification` et `ecarterPropositionModele`.
- `PreferenceOrganisation` gagne `modeleEcarte`, le modèle proposé que la personne a refusé.
- La page des préférences s'ouvre sur le choix du modèle. Le détail des réglages se déplie en dessous.
- L'espace organisateur gagne un registre des saisies en cours (`lib/modifications-en-cours.ts`), que l'éditeur de fiche, le formulaire de tâche et le fil de commentaires renseignent.
- Le gabarit du résumé et celui des priorités changent.
- Le job des priorités passe avant celui du résumé.
- Le glossaire reçoit « importance d'une notification » et « modèle de notifications ». Les modes d'emploi et leurs captures des préférences sont à reprendre.

## Revue de sécurité

- L'importance ne donne accès à aucun contenu nouveau : elle ne fait que retirer des destinataires. Chaque destinataire restant lisait déjà la tâche ou la demande.
- Le contact principal ne gagne aucun droit. Il reçoit en premier une notification que toute l'équipe recevait.
- Une personne archivée, une organisation suspendue, en lecture seule ou archivée ne reçoivent rien, comme aujourd'hui (ADR 0031).
- Une notification en attente dans sa fenêtre ne s'affiche à personne. Le job relit les assignations et les droits à la fin de la fenêtre.
- Les préférences restent lues par la seule personne concernée (ADR 0032).
- Les tests prouvent les refus : personne archivée, organisation suspendue, préférences d'une autre organisation, notification en attente invisible dans la cloche et le résumé.
