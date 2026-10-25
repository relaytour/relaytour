# ADR 0048 — Premiers pas d'une activité et reconduction d'une édition

- **Statut** : acceptée
- **Date** : 2026-10-25
- Réalise le point « Transmission d'une période à la suivante » de la feuille de route, sauf la note de passation. Complète l'ADR 0003 (tâches types), l'ADR 0009 (source de vérité du contenu) et l'ADR 0026 (tâches partagées).

## Contexte

Une organisation neuve reçoit une première activité, créée avec elle, sans période ni périmètre. Son premier admin ouvre « Mon espace » et lit « Aucune édition n'est en préparation. » L'écran ne propose aucune action.

Pour arriver à une période prête, l'admin doit trouver seul cinq écrans dans l'ordre :

1. les réglages de l'activité (nom, nature, groupes) ;
2. « Éditions », pour créer la période ;
3. « Équipe », pour créer les périmètres ;
4. chaque périmètre, pour créer les tâches une à une ;
5. « Personnes », pour inviter l'équipe.

Les tâches types d'un périmètre ne deviennent des tâches datées que par la commande `orga:importer --edition`. Un admin sans accès au serveur ne peut donc pas les appliquer. Aucun écran ne reprend non plus les tâches d'une période passée : chaque année, l'équipe ressaisit des tâches presque identiques.

## Décision

### La liste « Premiers pas »

- « Mon espace » affiche une liste « Premiers pas » à toute personne qui administre l'activité, tant qu'une étape reste à faire.
- La liste compte cinq étapes, dans cet ordre :

| Étape | Faite quand |
|---|---|
| Décrire l'activité | Un admin a confirmé le nom, la nature et les groupes de l'activité |
| Créer la première période | L'activité a au moins une période non archivée |
| Créer les périmètres | L'activité a au moins un périmètre non archivé |
| Préparer les tâches | La période courante a au moins une tâche non abandonnée |
| Inviter l'équipe | Une autre personne que celle qui lit la liste est rattachée à l'activité, admin de l'activité ou affectée à un périmètre (ADR 0045) |

- La période courante est la plus récente des périodes non archivées de l'activité.
- Le serveur calcule l'état de chaque étape à partir des données, sauf pour la première étape. Une étape faite par un autre chemin (un autre écran, un import, la ligne de commande) est donc cochée.
- Chaque étape ouvre une fenêtre qui contient le formulaire de l'écran concerné. L'admin n'a pas besoin de quitter « Mon espace ».
- L'étape « Préparer les tâches » propose plusieurs voies : appliquer les tâches types, importer un tableur (ADR 0049) ou créer une tâche dans un périmètre.
- Un admin masque la liste pour toute l'activité, et peut l'afficher de nouveau depuis le menu du compte. La liste disparaît d'elle-même quand toutes les étapes sont faites.
- Une personne qui n'administre pas l'activité ne voit pas la liste. Quand aucune période n'existe, elle lit un texte d'attente, par exemple « Les admins de l'activité préparent la prochaine édition. » Le mot suit la nature de l'activité (édition, saison ou mandat).
- Les écrans vides (Rétroplanning, périmètre, Équipe) renvoient vers l'étape qui les remplit.

### Le modèle de départ

- L'étape « Créer les périmètres » propose un modèle de départ, ou un départ à vide.
- Un modèle de départ est une activité d'un dossier de contenu au format des dossiers d'organisation (ADR 0003), livrée avec le logiciel. Elle apporte des périmètres, leurs tâches types et des fiches.
- Le premier modèle décrit un événement multisports fictif : c'est l'activité « rencontres » du contenu d'exemple (`content/exemple`, et `content/exemple-en` pour une requête en anglais). La CI valide déjà ces dossiers, et aucune copie n'est à tenir à jour. Le modèle reste générique et ne reprend le contenu d'aucune organisation réelle (invariant du dépôt public).
- Les groupes du modèle que l'activité ne déclare pas s'ajoutent à ses groupes. Les libellés déjà choisis par l'admin ne changent pas.
- Une fiche d'une autre activité qui porte le même slug n'est ni déplacée ni remplacée : elle se signale en conflit, et le modèle s'applique sans elle.
- Un admin applique un modèle de départ seulement à une activité sans périmètre. Le modèle ne fusionne donc jamais avec un contenu existant.
- L'application passe par l'import des modèles, restreint à l'activité. Elle ne modifie ni l'identité de l'organisation ni les autres activités.
- Si une période existe déjà, les tâches de cette période sont créées dans la foulée, à partir des tâches types du modèle.

### Les tâches types appliquées depuis l'espace organisateur

- Un admin de l'activité crée les tâches d'une période à partir des tâches types de ses périmètres, depuis l'espace organisateur. Il peut limiter l'opération à certains périmètres.
- La règle est celle de `orga:importer --edition` : une tâche est créée une seule fois par tâche type, et une tâche déjà créée n'est jamais modifiée. La commande et l'écran partagent le même code.
- L'opération se simule d'abord. Le rapport indique les tâches à créer et celles qui existent déjà.

### La reconduction d'une période

- L'interface parle de « reprise des tâches » et du verbe « reprendre ». Le mot « reconduction » reste dans le titre de cette décision et dans les noms techniques (`reconduireEdition`, `simulerReconduction`).
- À la création d'une période, l'admin choisit son point de départ : une période vide, les tâches types, ou une période précédente de la même activité.
- Avec une période précédente, l'admin lit la liste de ses tâches, toutes cochées, et décoche celles qu'il ne reprend pas. La reconduction reste possible plus tard, depuis l'écran « Éditions ».
- Une tâche reconduite garde son titre, sa description, sa fiche liée, son périmètre et sa tâche type d'origine.
- Son échéance garde le même écart en jours avec le premier jour de la période. Sa phase suit donc cette nouvelle date (ADR 0025). Une tâche sans échéance reste sans échéance.
- Une tâche reconduite repart à faire. Elle ne garde ni son statut, ni ses assignations, ni ses commentaires, ni son journal.
- Une tâche créée depuis une tâche type ou reconduite n'a pas d'auteur, comme une tâche importée par la commande. Elle ne rapporte donc aucun point de création à l'admin qui l'applique.
- Une tâche ne garde sa fiche que si la règle de liaison l'accepte encore : une fiche commune de l'activité, une fiche de son périmètre ou, pour une déclinaison, la fiche de sa tâche partagée.
- Une tâche partagée est reconduite avec ses déclinaisons, sauf celles qui avaient été refusées. La reconduction est faite par un admin : ses déclinaisons sont donc acceptées d'office (ADR 0026).
- Les effectifs souhaités des périmètres sont reconduits.
- Les affectations ne sont pas reconduites. Une personne change souvent de rôle d'une année à l'autre, et une affectation envoie un mail d'équipe.
- Une tâche reconduite garde sa tâche type d'origine. Appliquer ensuite les tâches types ne crée donc pas de doublon.

## Conséquences

- Une migration additive ajoute la colonne facultative `Activite.premiersPas` (JSON). Elle garde la date de confirmation de la première étape et la date de masquage de la liste.
- Le contrat GraphQL gagne :
  - la requête `premiersPas(activiteId)` ;
  - les mutations `confirmerActivite`, `masquerPremiersPas` et `afficherPremiersPas` ;
  - la requête `simulerTachesTypes` et la mutation `appliquerTachesTypes(editionId, perimetreIds)` ;
  - la requête `simulerReconduction` et la mutation `reconduireEdition(sourceId, cibleId, tacheIds)` ;
  - la requête `simulerModeleDeDepart` et la mutation `appliquerModeleDeDepart(activiteId, modele)`.
- Comme pour l'import des fiches, la simulation est une requête qui suit le même chemin que la mutation, sans rien écrire.
- La création des tâches à partir des tâches types sort de `orga/importer.ts` dans une fonction partagée par la commande et par l'API.
- Les fenêtres de création d'une période et de réglage d'un périmètre sont partagées avec les « Premiers pas ». Une invitation courte (nom, adresse, périmètres facultatifs) complète l'écran Personnes, qui garde les autres réglages.
- La CI valide chaque modèle de départ avec `orga:valider`, puisqu'il appartient au contenu d'exemple. Le Dockerfile copie `content/exemple` et `content/exemple-en` dans l'image du serveur.
- La feuille de route ne garde que la note de passation du point « Transmission d'une période à la suivante ».
- Les modes d'emploi des admins décrivent les premiers pas et la reconduction. Le glossaire gagne « reprise des tâches », le mot affiché par l'interface, et « modèle de départ ».

## Revue de sécurité

- `premiersPas`, `confirmerActivite`, `masquerPremiersPas` et `afficherPremiersPas` exigent un admin de l'activité. Une activité d'une autre organisation donne le même refus qu'une activité inconnue.
- `appliquerTachesTypes` et `reconduireEdition` exigent un admin de l'activité, une période non archivée et une organisation en écriture. La période source et la période cible appartiennent à la même activité ; sinon, le serveur refuse comme pour une période inconnue.
- `tacheIds` ne retient que des tâches de la période source. Un identifiant étranger est ignoré et compté dans le rapport.
- `appliquerModeleDeDepart` n'accepte qu'un nom de modèle de la liste livrée avec le logiciel, jamais un chemin. Il exige un admin de l'activité et une activité sans périmètre.
- Un modèle de départ ne contient aucune donnée personnelle. `orga:valider` refuse une adresse ou un numéro de téléphone personnels dans une fiche.
