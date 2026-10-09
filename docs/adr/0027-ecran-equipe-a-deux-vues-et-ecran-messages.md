# ADR 0027 — Écran « Équipe » à deux vues et écran « Messages »

- **Statut** : proposée
- **Date** : 2026-10-09
- Amende l'ADR 0020 sur un point : l'emplacement de l'historique des messages d'une activité.

## Contexte

Les écrans « Équipe » et « Avancement » affichaient la même liste : une carte par périmètre, pour une période. Le premier montrait l'effectif et les affectations, le second l'état des tâches. Aucun lien ne les reliait, et la période choisie se perdait de l'un à l'autre. L'écran « Équipe » n'avait ni filtre par groupe, ni recherche, ni tri.

L'ADR 0020 a placé l'historique des messages dans un onglet de l'écran « Personnes ». Un admin écrit pourtant le plus souvent depuis l'écran « Équipe », qui ne menait pas à cet onglet.

## Décision

### Un écran « Équipe », deux vues

- L'écran « Équipe » réunit les deux écrans. La vue « Équipe » porte l'effectif, les affectations, les souhaits et le réglage des périmètres. La vue « Avancement » porte l'état des tâches.
- L'entrée « Avancement » quitte le menu. L'adresse `admin/avancement` redirige vers la vue « Avancement », et l'adresse `admin` vers l'écran « Équipe ».
- Les deux vues partagent la période, un filtre par groupe de périmètres, une recherche et un tri. La recherche compare le nom du périmètre et les noms des personnes affectées.
- Ces réglages se lisent dans l'adresse de la page (`vue`, `edition`, `groupe`, `q`, `tri`, `filtre`). Ils restent en place au changement de vue et au retour depuis la page d'un périmètre.
- Chaque carte rappelle l'autre vue : la barre d'avancement dans la vue « Équipe », le compteur d'effectif dans la vue « Avancement ».
- Le nom d'une carte ouvre la page du périmètre. Cette page porte, pour les admins de l'activité, un bouton « Gérer l'équipe » qui ramène à la carte.
- Les cartes gardent leur place et leur présence jusqu'au prochain changement de réglage : une affectation ne déplace pas la carte en cours de modification.

### Un écran « Messages »

- L'historique des messages d'une activité se lit dans un écran « Messages » du groupe « Gérer l'activité » (`admin/messages`). L'onglet « Messages » quitte l'écran « Personnes » d'une activité, et son ancienne adresse redirige.
- L'écran « Équipe » porte un lien vers cet historique, à côté du bouton « Écrire à l'équipe ».
- L'écran « Annuaire » garde son onglet « Messages » : il montre aux admins de l'organisation les messages de toutes les activités.
- Les autres règles de l'ADR 0020 ne changent pas : qui écrit, à qui, ce que le serveur enregistre, et le statut déclaré par l'auteur.

## Conséquences

- Le serveur et le contrat GraphQL ne changent pas. L'écran « Équipe » lit les requêtes `PostesAPourvoir` et `AvancementGlobal`, et les joint par périmètre.
- L'écran « Messages » lit les adresses de l'équipe pour rouvrir un message, comme la fenêtre d'écriture de l'écran « Équipe ». La limite de l'ADR 0020 reste vraie : une personne sortie de l'équipe n'a plus d'adresse lisible.
- Les modes d'emploi et leurs captures suivent ces deux écrans.

## Revue de sécurité

- Aucun contrôle d'accès ne change. La route `admin/messages` vit sous la même garde que les autres écrans d'administration, et la requête `messages` vérifie toujours que la personne administre l'activité.
- Les réglages placés dans l'adresse ne portent aucune donnée personnelle saisie par l'application. La recherche y écrit ce que l'admin tape, qui peut être le nom d'une personne de son équipe : cette adresse reste dans son navigateur.
