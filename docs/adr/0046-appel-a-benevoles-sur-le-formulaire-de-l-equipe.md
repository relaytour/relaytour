# ADR 0046 — Appel à bénévoles indiqué sur le formulaire de l'équipe

- **Statut** : acceptée
- **Date** : 2026-10-23
- Complète l'ADR 0015 (formulaire public) et l'ADR 0041 (appels à bénévoles). Remplace, dans l'ADR 0041, la règle « l'adresse d'un appel est secrète » pour l'appel ouvert sur toute la période.

## Contexte

Le formulaire public d'une activité recrute l'équipe qui prépare l'activité (ADR 0015). Une personne qui voulait aider le jour J a rempli ce formulaire. Un admin l'a ensuite affectée à des périmètres, et elle a reçu les rappels de leurs tâches en retard.

Une telle personne relève d'un appel à bénévoles (ADR 0041). L'adresse d'un appel est secrète : ses gestionnaires choisissent à qui ils la transmettent. Le formulaire ne pouvait donc pas l'indiquer.

## Décision

- Le formulaire public précise qu'il sert à rejoindre l'équipe qui prépare l'activité.
- Quand un appel est ouvert sur toute la période du formulaire, le formulaire affiche son adresse. Un appel limité à un périmètre ou à une séquence, un appel fermé, un appel à venir et un appel d'import ne s'y affichent pas. Quand plusieurs appels conviennent, le plus récemment ouvert l'emporte.
- L'adresse d'un appel ouvert sur toute la période cesse donc d'être secrète tant que l'appel est ouvert et que le formulaire l'est aussi. Les adresses des autres appels restent secrètes.
- Sans appel qui convienne, le formulaire indique l'adresse de contact de l'activité.
- La lecture du formulaire n'écrit rien en base. Après un changement du secret du serveur, l'adresse calculée ne correspond plus à l'empreinte gardée : le formulaire n'affiche alors aucun lien, jusqu'à ce qu'un gestionnaire recopie l'adresse.

## Conséquences

- Le champ public `FormulaireRejoindre.appelBenevoles` porte le jeton de cet appel, ou rien.
- Un admin qui veut garder un appel de période confidentiel le ferme, ou ferme le formulaire public. Le mode d'emploi de l'admin d'activité le dit.
- Renouveler l'adresse d'un appel affiché ne la retire pas du formulaire : la nouvelle adresse s'y affiche à son tour.

## Revue de sécurité

- Le champ ne s'ajoute qu'au formulaire déjà public d'une activité dont le formulaire est ouvert. Il ne porte aucun identifiant de la base.
- Une personne qui suit le lien dépose une candidature soumise aux limites de l'ADR 0041. L'équipe accepte chaque séquence : le lien ne donne aucune place.
- Un visiteur sans session ne déclenche aucune écriture en lisant le formulaire.
