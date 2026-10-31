# ADR 0055 — Charge de l'équipe et co-réalisation des tâches

- **Statut** : proposée
- **Date** : 2026-10-31
- Complète l'ADR 0014 (consultation), l'ADR 0028 (assignation) et l'ADR 0041 (répartition des bénévoles).

## Contexte

Une tâche accepte plusieurs personnes assignées. La vue « Répartition » (ADR 0041) montre la couverture des séquences du programme. Aucun écran ne montre pourtant la charge d'une personne de l'équipe : combien de tâches lui restent, combien sont en retard, combien de places elle tient au programme.

Une référente ou un référent qui répartit les tâches d'un périmètre ne sait pas si une autre personne est déjà très sollicitée ailleurs dans l'activité. Un admin d'activité qui prépare une édition ne voit pas non plus qui porte le plus de travail.

Seule la requête `mesTaches` liste des tâches par personne, et seulement pour la personne connectée. L'écran Équipe montre l'avancement par périmètre, pas par personne.

À la clôture, une tâche n'accepte qu'une personne réalisatrice. Une tâche menée à deux ou à trois ne crédite qu'une seule personne dans le score de participation.

## Décision

### La charge d'une personne

- La charge d'une personne, pour une édition, réunit trois mesures :
  - ses tâches assignées ;
  - ses places au programme (séquences) ;
  - le nombre de périmètres où elle est affectée.
- L'unité reste la tâche et la place. Relaytour ne demande aucune estimation d'effort.
- L'écran trie les personnes par charge ou par nom. Il n'affiche ni seuil ni qualificatif comme « surchargé ».
- Les personnes listées sont celles qui sont affectées à l'édition, ou qui y ont une tâche assignée ou une place au programme. Les fiches bénévoles sans compte restent dans la vue « Répartition ».
- Les déclinaisons qui ne sont pas acceptées ne comptent pas (ADR 0026).

### Deux temps de lecture

- « Maintenant » compte les tâches ouvertes (à faire ou en cours) et les places à venir. Les tâches ouvertes se répartissent en quatre groupes :
  - en retard ;
  - échéance dans les 7 jours ;
  - échéance plus lointaine ;
  - sans échéance.
- « Maintenant » compte aussi les tâches ouvertes partagées avec d'autres personnes assignées.
- « Toute l'édition » compte toutes les tâches assignées, par statut et par phase (ADR 0025), et toutes les places de l'édition.
- Les jours s'entendent à l'heure de Paris, comme les échéances.

### Qui voit la charge

- Toute personne de l'équipe qui voit les tâches de l'activité voit la charge de chacun : une personne affectée à un périmètre de l'activité, ou un admin. La règle suit la consultation (ADR 0014) : les personnes assignées à une tâche y sont déjà lisibles.
- Une personne qui découvre l'activité (rattachement ou souhait seul) ne voit pas la charge.
- Le nombre de tâches qu'une personne a réalisées suit la règle de la clôture : il n'est visible que par la personne et par les admins, comme le score de participation. L'équipe voit les tâches assignées terminées.

### Le cumul toutes activités

- Le détail d'une personne affiche aussi sa charge dans les autres activités de l'organisation, pour l'édition en cours ou à venir de chacune.
- Le cumul ne compte que les activités dont la personne qui consulte voit les tâches. Un admin de l'organisation voit toutes les activités.

### La co-réalisation d'une tâche

- Une tâche faite porte une liste de personnes réalisatrices. Chacune est affectée au périmètre pour l'édition.
- Au moment de cocher, l'espace organisateur propose les personnes assignées. La personne qui coche modifie la liste.
- Une liste vide crédite la personne qui coche, comme avant cette décision.
- Chaque personne réalisatrice reçoit les points pleins de la tâche : 3 points, et 1 point de plus si la tâche est faite à temps.
- Rouvrir une tâche vide la liste. Les points disparaissent avec elle.
- La liste reste soumise à la règle de la clôture : seule la personne qui a coché et les admins la lisent.

## Conséquences

- Une table `TacheRealisation` relie une tâche et ses personnes réalisatrices. La migration recopie la personne réalisatrice actuelle de chaque tâche. La colonne `realiseeParId` reste en place jusqu'à une migration de suppression distincte.
- `changerStatutTache` reçoit `realisateurs`, une liste de 20 personnes au plus. Le type `Tache` expose `realisateurs`. L'argument `realiseeParId` et le champ `realiseePar` restent, dépréciés, pour une application installée qui garde l'ancienne coquille jusqu'à son rechargement (ADR 0023).
- L'export complet d'une organisation écrit `realisateurs`, une liste d'adresses. Il garde `realiseePar`, la première personne réalisatrice, pour un outil qui lit l'ancien format. Aucun import ne lit ces clés.
- Trois requêtes s'ajoutent : `chargeEquipe` pour une édition, `tachesDe` pour le détail d'une personne et `chargeCumulee` pour le cumul.
- L'espace organisateur reçoit une page « Charge », ouverte à l'équipe. L'écran Équipe et « Mon espace » y renvoient.

## Revue de sécurité

- `chargeEquipe` et `tachesDe` vérifient l'édition dans l'organisation active, puis la consultation de l'activité. Une personne en découverte reçoit le même refus qu'une personne extérieure.
- `tachesDe` ne renvoie que les tâches des périmètres de l'activité de l'édition. Les champs restreints d'une tâche (`clotureePar`, `realisateurs`) gardent leur propre garde.
- `chargeCumulee` filtre les activités par les droits de la personne qui consulte, lus côté serveur. Une activité invisible n'apparaît ni dans la liste ni dans les totaux.
- `changerStatutTache` vérifie l'affectation de chaque personne réalisatrice, et non la liste envoyée par le navigateur.
