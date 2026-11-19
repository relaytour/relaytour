# ADR 0068 — Périodes de travail des tâches

- **Statut** : proposée
- **Date** : 2026-11-19
- Complète l'ADR 0025 (phases), l'ADR 0059 (priorités), l'ADR 0062 (jalons) et l'ADR 0063 (mails de suivi).
- Ne remplace aucune règle de l'ADR 0025. La durée estimée n'est pas un champ de priorité : elle ne classe pas les tâches entre elles.

## Contexte

Une tâche ne porte qu'une date : son échéance. Les phases (ADR 0025), le panneau Priorités (ADR 0059) et les rappels s'en déduisent. Une tâche entre dans les priorités quand son échéance tombe avant le prochain point d'équipe. Elle reçoit un rappel sept jours avant, puis la veille.

Une activité préparée sur un an par des bénévoles fait apparaître deux limites :

- Une tâche longue n'apparaît qu'au moment où elle devient urgente. Une recherche de partenaires qui demande deux mois entre dans les priorités deux à quatre semaines avant son échéance. Il est alors trop tard pour la commencer sereinement.
- La seule notion de date limite crée du stress. Une tâche en cours, menée au rythme prévu, s'affiche en orange dès que son échéance approche. Les écrans signalent ainsi une urgence là où le travail avance normalement.

Une équipe a besoin de savoir ce qu'elle peut commencer dans les semaines qui viennent, et pas seulement ce qui arrive à échéance.

L'ADR 0025 a refusé un champ de priorité parce qu'il doublait l'échéance : une tâche proche ou en retard était déjà signalée. Une durée estimée ne double pas l'échéance. Deux tâches qui ont la même échéance peuvent demander trois jours ou deux mois de travail. L'échéance dit quand le travail doit être fini. Seule la durée dit quand il faut le commencer.

### Options écartées

- **Une date de début saisie sur chaque tâche.** Une seconde date double la saisie et se périme quand l'échéance bouge. Les deux dates finiraient par se contredire, et l'équipe devrait corriger les deux à chaque report.
- **Une durée libre, en jours.** Une estimation au jour près donne une précision que personne n'a sur une tâche de bénévoles. Elle invite aussi à discuter le chiffre plutôt que le travail.
- **Une durée qui ajoute des points au score.** Le score classe ce qui doit être fini avant le prochain point (ADR 0059). Une tâche longue au score gonflé passerait devant une tâche courte déjà en retard.
- **Compter comme « en retard » une tâche à faire dont la période de travail a commencé.** Toute tâche longue deviendrait une alerte le jour où elle devient possible. Le but est inverse : présenter ce jour comme une invitation à commencer.

## Décision

### La durée estimée

- Une tâche porte une **durée estimée** facultative. La personne la choisit parmi quatre valeurs.

| Valeur | Libellé | Jours retenus | Contenu (`duree`) |
|---|---|---|---|
| `QUELQUES_JOURS` | Quelques jours | 7 | `quelques-jours` |
| `DEUX_A_TROIS_SEMAINES` | 2 à 3 semaines | 21 | `deux-a-trois-semaines` |
| `UN_A_DEUX_MOIS` | 1 à 2 mois | 60 | `un-a-deux-mois` |
| `DEUX_A_TROIS_MOIS` | 2 à 3 mois | 90 | `deux-a-trois-mois` |

- Chaque valeur retient la borne haute de son intervalle. La période de travail s'ouvre ainsi assez tôt pour laisser de la marge.
- Une tâche plus longue que trois mois se découpe en plusieurs tâches, ou devient un jalon (ADR 0062).
- La durée fait partie du contenu de la tâche, comme l'échéance. La modifier change la version de la tâche et prévient les personnes assignées.

### La période de travail

- La **période de travail** d'une tâche va du jour de son échéance moins sa durée jusqu'au jour de son échéance.
- Le premier jour de la période de travail se calcule à la lecture. Aucune date de début ne se saisit ni ne se stocke.
- Une tâche sans durée ou sans échéance n'a pas de période de travail. Elle se comporte comme aujourd'hui.
- Reporter l'échéance déplace la période de travail sans autre geste.
- La période de travail ne change ni la phase d'une tâche (ADR 0025) ni son rangement dans le rétroplanning. Les deux restent rangés par échéance.

### Les signaux d'une échéance

Une tâche ouverte, à faire ou en cours, avec une échéance, reçoit l'un de ces signaux :

| Situation | Signal |
|---|---|
| L'échéance est dépassée. | « En retard », en rouge, comme aujourd'hui. |
| La tâche a une période de travail, elle est à faire et sa période de travail a commencé. | « À commencer », en orange. |
| La tâche a une période de travail et elle est en cours. | Aucun signal avant l'échéance. |
| La tâche a une période de travail, elle est à faire et sa période de travail n'a pas commencé. | Aucun signal. |
| La tâche n'a pas de période de travail et son échéance tombe dans les sept jours. | « Échéance proche », en orange, comme aujourd'hui. |

- Le retard garde sa règle : une échéance dépassée sur une tâche ouverte. Le champ `enRetard` et tous les décomptes de retard (Mon espace, Charge, rétroplanning, avancement, jalons, mails) ne changent pas.
- Une tâche en cours dans sa période de travail ne s'affiche plus en orange. Le travail avance au rythme prévu, et l'écran ne le présente pas comme une urgence.
- Le signal « À commencer » remplace le signal « Échéance proche » pour une tâche qui a une période de travail. Il apparaît sur la carte de tâche, dans les listes de tâches, dans Mon espace, dans le rétroplanning et dans le panneau Priorités.
- La carte d'une tâche affiche sa période de travail : « Période de travail : du 3 mars au 24 mars ».

### La section « À commencer » des priorités

- Chaque périmètre du panneau Priorités gagne une section **« À commencer »**, sous ses priorités.
- Une tâche y figure quand elle remplit toutes ces conditions :
  - elle est à faire ;
  - elle a une période de travail, qui commence au plus tard le dernier jour de l'horizon ;
  - son échéance tombe après l'horizon ;
  - aucun ajustement haut ou épinglé ne la fait déjà entrer dans les priorités.
- Une tâche en cours n'y figure pas : elle est déjà commencée.
- Une tâche dont l'échéance tombe dans l'horizon garde sa place dans les priorités. Elle n'entre pas dans « À commencer ».
- Une déclinaison qui n'est pas acceptée n'y figure pas (ADR 0026). Une tâche partagée y figure avec sa propre échéance et sa propre durée.
- Les tâches se rangent par premier jour de leur période de travail, puis par échéance.
- Un périmètre montre au plus cinq tâches à commencer. Le panneau en montre trois, puis « Voir les autres », comme les priorités. Le nombre de tâches au-delà de cinq s'affiche avec un lien vers le périmètre.
- Chaque tâche indique le premier jour de sa période de travail : « Peut commencer dès le 3 mars », ou « Période de travail commencée le 3 mars ».
- Les filtres du panneau s'appliquent à cette section. Le filtre « À prendre » ne garde que les tâches sans personne assignée.
- La ligne « Ensuite » ne s'affiche que pour un périmètre sans priorité et sans tâche à commencer.

### Le score des priorités

- Le score ne change pas. La durée estimée n'ajoute aucun point et n'en retire aucun.
- Les tâches à commencer ne reçoivent pas de score. Elles ne sont pas des priorités, comme la ligne « Ensuite ».
- Le score classe ce qui doit être fini avant le prochain point. La section « À commencer » montre ce qui peut commencer avant ce point. Les deux listes répondent à deux questions distinctes et ne se mélangent pas.

### Le mail des priorités

- Le mail des priorités (ADR 0063) reprend la section « À commencer ». Elle forme une rubrique sous les priorités de chaque périmètre, avec trois tâches au plus et « et N autres ».
- Chaque tâche à commencer donne son titre, le premier jour de sa période de travail et son échéance.
- Une période dont les périmètres retenus n'ont ni priorité ni tâche à commencer n'envoie pas de mail.
- Le mail de rappel du jour et le résumé ne changent pas.

### Contenu, API et reprise

- Une tâche type déclare sa durée par la clé facultative `duree`, avec une valeur de la colonne « Contenu » du tableau. Une déclinaison déclarée par le contenu peut déclarer sa propre durée. Sans durée, elle reprend celle de sa tâche partagée.
- `orga:importer` écrit la durée des tâches qu'il crée. Comme pour l'échéance, il ne modifie pas une tâche déjà présente.
- `orga:exporter` réécrit la clé `duree` des tâches types. L'export complet de l'organisation donne la durée de chaque tâche.
- Une déclinaison créée dans l'application reprend la durée de sa tâche partagée.
- La reprise des tâches (ADR 0048) garde la durée de chaque tâche reprise.
- Le contrat GraphQL gagne l'énumération `DureeTache`, les champs `Tache.duree` et `Tache.debutTravail`, et l'argument facultatif `duree` de `creerTache` et de `modifierTache`. Dans `modifierTache`, null efface la durée.
- La requête `tachesACommencer` renvoie, pour une période, les tâches à commencer de chaque périmètre et leur nombre au-delà du plafond. Elle se lit avec la consultation, comme les priorités.
- Les tâches à commencer ne s'ajoutent pas à la requête `priorites`. La requête de l'espace organisateur dépasserait sinon le plafond de complexité du serveur (2 000).
- L'API REST (ADR 0064) lit `duree` et `debutTravail` sur chaque tâche, et accepte `duree` à la création et à la modification.

### Hors de cette décision

- Un rappel au premier jour de la période de travail. Il ajouterait un mail, alors que le but est d'alléger la pression. Le mail des priorités couvre ce besoin pour les personnes qui s'y abonnent.
- Le changement des rappels à sept jours et à la veille pour une tâche en cours.
- L'affichage de la période de travail comme une barre dans le rétroplanning.
- La durée dans l'import de tâches depuis un tableur. L'import garde ses colonnes actuelles.
- Le calcul de la charge d'une personne à partir des durées.

## Conséquences

- Une migration additive ajoute l'énumération `DureeTache` et la colonne `Tache.duree`, nulle par défaut. Aucune tâche existante ne change de comportement.
- Une équipe voit une tâche longue plusieurs semaines avant son échéance, sans l'ajuster à la main.
- Une tâche en cours ne s'affiche plus en orange avant son échéance. Une échéance proche reste visible par la date et par le score des priorités.
- Les tâches sans durée gardent exactement leurs signaux actuels. Une équipe adopte la durée tâche par tâche.
- Le glossaire gagne « durée estimée » et « période de travail ».
- `packages/commun/src/periodes-de-travail.ts` porte les jours de chaque durée et le calcul du premier jour. Le serveur et l'espace organisateur lisent cette même table.
