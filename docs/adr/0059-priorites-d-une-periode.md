# ADR 0059 — Priorités d'une période

- **Statut** : proposée
- **Date** : 2026-11-04
- **Amendée** : 2026-11-05 (point d'équipe, voir « Horizon » et « Amendement du 2026-11-05 »)
- Complète l'ADR 0014 (consultation des périmètres), l'ADR 0026 (tâches partagées), l'ADR 0037 (agenda et réunions) et l'ADR 0020 (messages à l'équipe).
- Remplace en partie la règle de l'ADR 0025 « Aucune étiquette libre et aucun champ de priorité ne s'ajoutent à la tâche. » Seul le champ de priorité est concerné. L'interdiction des étiquettes libres et le reste de l'ADR 0025 ne changent pas.

## Contexte

Une équipe qui prépare un événement se retrouve à intervalles réguliers pour faire le point. Avant chaque point, une personne de la coordination rédige souvent un mail des priorités. Ce mail liste, pour chaque périmètre, les quelques tâches à faire avant le point suivant.

Les tâches de l'application portent déjà ce qu'il faut pour établir cette liste : une échéance, un statut, des personnes assignées et des déclinaisons dans d'autres périmètres. La consultation (ADR 0014) permet à chaque personne de l'activité de lire les tâches de tous les périmètres. Aucun écran ne montre pourtant ce qui compte pour toute l'équipe dans les jours qui viennent. « Mon espace » ne montre que les tâches de la personne et les tâches à prendre dans ses propres périmètres.

L'ADR 0025 a refusé un champ de priorité sur la tâche, parce qu'il doublait l'échéance. Cette raison vaut pour une priorité permanente, posée tâche par tâche. Elle ne répond pas au besoin d'une liste commune, bornée dans le temps et lisible par toute l'équipe.

Une liste tenue à la main se périme dès que personne ne la met à jour. Une liste calculée seule ignore ce que l'équipe sait du terrain. Une activité peut aussi compter plusieurs centaines de tâches réparties sur dix mois : une liste sans limite de temps ne sert à rien.

### Options écartées

- **Une marque « prioritaire » posée à la main sur chaque tâche.** La liste dépend alors du travail d'une personne. Elle reste fausse les semaines où personne ne la reprend.
- **Un classement par un modèle de langage.** Le résultat ne se reproduit pas d'un appel à l'autre et ne s'explique pas. Il enverrait aussi les tâches de l'organisation à un service tiers.
- **Un score propre à chaque personne**, qui favoriserait ses propres périmètres. Deux personnes verraient deux classements différents pour une même tâche, et la liste lue en réunion ne serait plus commune.

## Décision

L'application calcule les **priorités** d'une période : un score commun à toute l'équipe, calculé à partir des tâches, dans une limite de temps. Un ajustement manuel s'ajoute au score. Chaque personne filtre ensuite l'affichage, sans changer le score.

### Horizon

- L'**horizon** est la période que couvre la liste. Il commence aujourd'hui et se termine le jour du prochain point.
- Le prochain point est le prochain **point d'équipe** de l'activité qui n'est pas annulé.
- Un point d'équipe est une réunion de l'agenda global (ADR 0037) que la personne qui l'écrit marque comme telle. Une réunion de périmètre n'est jamais un point d'équipe.
- Une autre réunion de l'agenda global, comme un rendez-vous à quelques personnes, ne fixe pas l'horizon.
- L'horizon dure au moins 14 jours et au plus 30 jours. Sans prochain point d'équipe, il dure 14 jours.
- Les jours se comptent dans le fuseau de l'organisation, comme dans l'agenda.

### Tâches retenues

- Une tâche entre dans les priorités quand elle est à faire ou en cours, et qu'elle remplit l'une de ces conditions :
  - son échéance est dépassée ;
  - son échéance tombe dans l'horizon ;
  - un ajustement la marque haute ou épinglée.
- Une tâche sans échéance n'entre que par un ajustement.
- Une déclinaison refusée ou en attente d'accord n'entre pas dans les priorités du périmètre cible. La tâche partagée d'origine compte l'accord attendu dans son score.

### Score

Le score classe les tâches retenues. Il ne décide pas de leur entrée dans les priorités : l'horizon et l'ajustement en décident. Le score est la somme des points ci-dessous. Chaque point ajouté porte une raison, que l'écran affiche sous la tâche.

| Critère | Points |
|---|---|
| Échéance dépassée depuis 14 jours au plus | 45 |
| Échéance dépassée depuis plus de 14 jours (raison « à revoir ») | 30 |
| Échéance dans 7 jours au plus | 35 |
| Échéance dans 8 à 14 jours | 25 |
| Échéance dans 15 à 30 jours | 12 |
| Échéance avant le prochain point (sans point : dans les 7 jours) | 15 |
| Tâche liée à une réunion à venir (ADR 0037) | 10 |
| Tâche partagée, par déclinaison active | 5, et 15 au plus |
| Tâche partagée dont une déclinaison attend l'accord | 5 |
| Personne n'est assignée | 8 |
| Tâche en cours | 3 |

- Une tâche partagée prend l'échéance la plus proche entre la sienne et celles de ses déclinaisons ouvertes. Une déclinaison garde sa propre échéance.
- Un retard ancien reçoit moins de points qu'un retard récent. Une échéance dépassée depuis plusieurs semaines signale souvent une date à corriger. La raison « à revoir » invite les référentes et les référents à la mettre à jour.
- Le schéma ne connaît aucun lien de dépendance entre deux tâches. Les tâches partagées sont le seul lien que le score utilise.
- Les dates clés n'entrent pas dans le score. Aucune tâche n'est liée à une date clé, et la seule proximité des jours produit des rapprochements sans rapport.
- En cas d'égalité, la tâche dont l'échéance est la plus proche passe devant.
- Les poids sont fixés dans le code. Ils ont été réglés sur les tâches réelles de deux activités d'une organisation : un événement d'une journée, à quatre semaines de sa date, et un événement de trois jours, à dix mois de sa date.

### Ajustement manuel

- Un **ajustement** modifie la place d'une tâche dans les priorités. Il prend l'un de ces niveaux :
  - basse : 20 points en moins ;
  - haute : 20 points en plus, et la tâche entre dans les priorités quelle que soit son échéance ;
  - épinglée : la tâche entre dans les priorités et passe en tête de son périmètre.
- Une tâche sans ajustement est au niveau normal.
- Les admins de l'activité, les admins de l'organisation et les personnes affectées au périmètre pour la période ajustent une tâche. La consultation n'ouvre pas ce droit.
- L'ajustement n'est pas une priorité permanente. Le score part de l'échéance, comme le voulait l'ADR 0025, et l'ajustement ne fait que le corriger pour un temps.
- Un ajustement reste valable jusqu'à la fin de l'horizon du jour où il a été posé. Il cesse ensuite de compter, sans tâche planifiée ni écriture. Un ajustement oublié ne fausse donc pas la liste pendant des semaines.
- L'écran affiche l'ajustement comme une raison, avec son auteur et sa date.
- Chaque ajustement entre dans le journal de la tâche. Le fil de la tâche ne le reprend pas : il garde les cinq événements de l'ADR 0029. Le panneau affiche déjà l'auteur et la date de l'ajustement.
- Un ajustement ne change pas la version de la tâche, comme le statut et les assignations.

### Limites de la liste

- Un périmètre montre au plus 5 priorités, classées par score. Le plafond s'applique aussi aux tâches épinglées.
- Un périmètre sans priorité montre sa prochaine tâche ouverte, sur une ligne « Ensuite », avec son échéance. Cette ligne n'est pas une priorité et ne reçoit pas de score affiché.
- La liste n'a pas de plafond global. Un plafond global masquerait des périmètres entiers.

### Affichage dans « Mon espace »

- Le panneau « Priorités » est le premier panneau de « Mon espace ». Il se place sous le titre, avant « Premiers pas » et « Vos périmètres ».
- Son en-tête indique la fin de l'horizon et le prochain point d'équipe, avec l'horaire et le lien de visio de la réunion. Sans point d'équipe prévu, il indique que les priorités couvrent les 14 prochains jours.
- Les périmètres suivent leur ordre dans l'activité. Les périmètres de la personne portent une pastille, sans changer de place.
- Le panneau montre 3 priorités par périmètre. Un lien « Voir les autres » montre les suivantes, jusqu'au plafond de 5.
- Chaque tâche montre son titre, son échéance, les personnes assignées et les raisons de son score.
- Le panneau reste affiché quand aucune tâche n'entre dans les priorités. Il l'indique alors par une phrase.
- Le panneau n'apparaît pas quand aucune période de l'activité n'est en préparation.

### Filtres

- La vue par défaut montre tous les périmètres que la personne consulte. Toute l'équipe lit ainsi la même liste.
- La personne peut restreindre la vue :
  - à ses périmètres ;
  - aux tâches que personne n'a prises ;
  - à un groupe de périmètres.
- Le choix se garde dans le navigateur, comme l'épingle des tableaux. Il ne change ni le score ni l'ordre.
- Quand un filtre vide la liste alors que d'autres périmètres ont des priorités, le panneau le dit et propose de revenir à tous les périmètres.
- Le filtre « À prendre » couvre tous les périmètres consultés. Prendre une tâche reste réservé aux personnes affectées au périmètre (ADR 0014).

### Droits

- Les priorités se lisent avec la consultation (ADR 0014). Elles n'ouvrent la lecture d'aucune donnée nouvelle.
- Une personne seulement rattachée à l'activité (ADR 0045) ou en découverte (ADR 0012) ne voit pas les priorités.

### Message des priorités

- La page des messages (ADR 0020) reçoit un modèle « Priorités ». Il reprend les priorités par périmètre, avec les référentes et les référents, la fin de l'horizon et le prochain point.
- Le modèle suit les règles des autres messages. L'admin relit le texte et l'envoie depuis sa propre messagerie.

### Calcul et API

- Une fonction pure du serveur (`packages/server/src/lib/priorites.ts`) calcule l'horizon, le score et le classement. Des tests unitaires couvrent chaque critère.
- Le serveur calcule les priorités à la lecture. Il ne stocke ni score ni classement.
- Une requête renvoie, pour une période, l'horizon, le prochain point et les priorités de chaque périmètre consulté. Elle renvoie aussi la ligne « Ensuite » et le nombre de priorités au-delà du plafond.
- Chaque raison est un code accompagné de ses valeurs (nombre de jours, nombre de déclinaisons). L'espace organisateur la traduit (ADR 0047).
- Une mutation pose ou retire l'ajustement d'une tâche. Elle émet le signal de la tâche (ADR 0017).
- Une migration additive ajoute à `Tache` le niveau d'ajustement, son auteur, sa date et sa fin de validité.
- Une seconde migration additive ajoute à `Reunion` le marqueur `pointEquipe` (amendement du 2026-11-05).

### Hors de cette décision

- Un lien « bloque » entre deux tâches, qui transmettrait l'urgence d'une tâche aux tâches qui la bloquent. Il demande sa propre décision : détection des cycles, saisie, lecture entre périmètres.
- Le réglage des poids par activité.
- L'historique des priorités d'un point à l'autre.
- Une notification ou un mail quand une tâche entre dans les priorités.

## Amendement du 2026-11-05 : le point d'équipe

### Contexte

La première version retenait comme prochain point la prochaine réunion de l'agenda global, quelle qu'elle soit. Une équipe qui place dans cet agenda des points à deux ou des rendez-vous avec un pôle voyait alors l'horizon de toute l'équipe raccourcir. Les équipes ne peuvent pas déplacer ces rendez-vous dans un agenda de périmètre quand ils concernent plusieurs périmètres.

### Décision

- La réunion porte un marqueur « point d'équipe ». Seule une réunion de l'agenda global le porte, et le serveur le refuse sur une réunion de périmètre.
- Les admins de l'activité, qui écrivent dans l'agenda global, posent ou retirent le marqueur dans le formulaire de la réunion.
- À la création, la case est cochée quand la réunion convoque toute l'équipe. La personne peut la décocher, ou la cocher pour une réunion qui convoque des personnes choisies, comme les contacts principaux.
- Une réunion créée depuis un sondage de toute l'équipe est cochée d'office.
- Une modification qui ne transmet pas le marqueur garde sa valeur.
- La migration marque les réunions globales à venir qui convoquent toute l'équipe. Les points d'équipe déjà saisis gardent ainsi leur effet.
- Le détail de la réunion affiche le repère « Point d'équipe ».
- Sans point d'équipe à venir, l'horizon dure 14 jours. Aucune autre réunion ne le remplace.

### Options écartées

- **Retenir les seules réunions qui convoquent toute l'équipe.** La règle évitait une migration. Elle liait pourtant l'horizon à l'envoi des convocations : un point d'équipe annoncé par un autre canal ne comptait pas. La cible par défaut d'une réunion globale est aussi « toute l'équipe » : un rendez-vous saisi sans changer ce réglage aurait encore fixé l'horizon.
- **Revenir à l'ancienne règle quand aucune réunion n'est marquée.** Le comportement aurait changé sans avertissement à la première case cochée. La case cochée d'office couvre déjà les activités qui ne s'occupent pas du marqueur.

## Conséquences

- Les priorités restent à jour sans aucun geste de l'équipe. L'ajustement sert à corriger le calcul, pas à tenir la liste.
- Une tâche sans échéance n'apparaît pas d'elle-même. Les équipes qui veulent voir une tâche dans les priorités lui donnent une échéance ou un ajustement.
- Un retard ancien reste visible avec la raison « à revoir ». Les échéances périmées deviennent ainsi un signal pour l'équipe.
- Le classement s'explique tâche par tâche. Une personne qui conteste une place lit les raisons, puis ajuste la tâche si elle en a le droit.
- Un nouveau critère s'ajoute à `lib/priorites.ts`, avec son code de raison, sa traduction et son test.
- Un rendez-vous de l'agenda global ne change plus l'horizon de toute l'équipe. Une équipe qui veut qu'une réunion fixe l'horizon la marque comme point d'équipe.
