# ADR 0039 — Fiches connexes et mentions de périmètre ou de groupe

- **Statut** : acceptée
- **Date** : 2026-10-20
- Complète l'ADR 0009 (source de vérité du contenu) et l'ADR 0014 (consultation) : une fiche de périmètre se lit dans d'autres périmètres qu'elle désigne. Remplace, dans l'ADR 0026, la règle « une déclinaison ne cite qu'une fiche commune de l'activité ».

## Contexte

Une fiche appartient à un périmètre, ou elle est commune à toute l'activité. Les personnes affectées à un périmètre lisent ses fiches et les fiches communes. Elles ne lisent pas les fiches des autres périmètres : la consultation ne les ouvre pas (ADR 0014).

Une fiche sert pourtant souvent à plusieurs périmètres. La fiche du pôle Bénévoles sur le planning des créneaux intéresse la Logistique et l'Accueil. La fiche d'un sport sur la remise des médailles intéresse le pôle Protocole. Trois réponses existent aujourd'hui, et aucune ne convient :

- Copier la fiche dans chaque périmètre. Les copies divergent dès la première correction.
- Rendre la fiche commune. Elle apparaît alors dans tous les périmètres, et le périmètre qui la tient n'est plus visible.
- Ne rien faire. Les autres périmètres ignorent que la fiche existe.

Le même manque touche les tâches partagées : une déclinaison ne peut citer qu'une fiche commune (ADR 0026). Une tâche du pôle Bénévoles déclinée dans neuf sports ne peut donc pas renvoyer à la fiche du pôle.

Une première idée était de déclencher le partage par une mention dans le texte : écrire `@logistique` dans une fiche l'aurait affichée dans le périmètre Logistique. Cette idée a quatre défauts :

- Un accès se cacherait dans le texte. Supprimer un mot pendant une relecture retirerait un accès sans que personne ne le voie.
- Le dépôt de l'organisation et l'espace de fichiers (ADR 0038) recevraient une syntaxe sans effet hors de Relaytour.
- Le renommage d'un périmètre casserait le lien.
- Une coordination qui mentionne tous les périmètres créerait une fausse fiche commune.

La décision garde la mention comme raccourci de saisie, et porte le partage dans un réglage explicite de la fiche.

## Décision

### Fiche connexe

- Une fiche de périmètre déclare une liste **« Concerne aussi »** : d'autres périmètres non archivés de la même activité, et des groupes de cette activité.
- Un groupe de la liste concerne tous ses périmètres non archivés, aujourd'hui et plus tard. Un périmètre qui rejoint le groupe reçoit la fiche sans autre geste. Le périmètre de la fiche n'est jamais concerné par son propre groupe.
- Pour chacun des périmètres concernés, elle est une **fiche connexe**. Elle reste la fiche de son périmètre d'origine, avec son historique et ses rédactrices et rédacteurs.
- Une fiche commune n'a pas de liste « Concerne aussi » : elle concerne déjà tous les périmètres.
- Une fiche connexe se lit dans le périmètre cible et ne s'y modifie pas. Le droit de rédaction reste celui du périmètre d'origine.
- Une personne qui peut rédiger la fiche modifie sa liste. Un admin de l'activité aussi.

### Lecture

- Une personne lit une fiche connexe quand elle lit les fiches du périmètre cible : elle y a été affectée au moins une fois, ou elle administre son activité (ADR 0014).
- La consultation d'un périmètre n'ouvre toujours aucune fiche, connexe ou non.
- La recherche trouve une fiche connexe pour les personnes qui la lisent.
- Le panneau « Tâches liées » d'une fiche connexe ne montre que les tâches que la personne peut lire.
- L'historique des versions reste réservé aux admins de l'activité de la fiche.
- Les ressources liées à une fiche depuis l'espace de fichiers (ADR 0038) gardent leur règle : une personne ne les ouvre que si elle lit leur dossier lié. Dans une fiche connexe, une ressource que la personne ne peut pas ouvrir porte la mention « Réservée au périmètre d'origine ».

### Affichage

- La fiche indique son périmètre, puis « Concerne aussi : Logistique, Accueil ».
- Dans un périmètre cible, la section « Fiches connexes » suit la section des fiches du périmètre. Chaque fiche y porte son périmètre d'origine et la mention « Lecture seule ».
- L'écran « Fiches » range une fiche connexe sous son périmètre d'origine. Le filtre d'un périmètre cible l'affiche dans une section « Fiches connexes ».

### Mention d'un périmètre ou d'un groupe

- Dans le texte d'une fiche, `@` suivi de l'identifiant d'un périmètre de l'activité forme une **mention**, par exemple `@logistique`.
- `@groupe:` suivi de la clé d'un groupe de l'activité mentionne ce groupe, par exemple `@groupe:sport`. Le préfixe évite toute confusion entre un périmètre et un groupe.
- L'éditeur propose les périmètres et les groupes de l'activité dès la saisie de `@`.
- La lecture affiche une mention comme l'étiquette du périmètre ou du groupe. L'étiquette d'un périmètre mène à sa page. L'étiquette d'un groupe ouvre une bulle qui liste ses périmètres : au survol sur un ordinateur, à l'appui sur un téléphone.
- Une mention d'un périmètre ou d'un groupe inconnu reste du texte, comme celle d'un périmètre archivé.
- Une mention ne donne aucun accès. À l'enregistrement, l'éditeur liste les périmètres et les groupes mentionnés absents de « Concerne aussi », et propose de les y ajouter. Un groupe s'ajoute comme groupe, et non comme la liste de ses périmètres du moment. Rien ne s'ajoute sans l'accord de la personne qui enregistre.
- Retirer une mention ne retire rien de la liste.

### Seuil d'une large diffusion

- Le seuil compte les périmètres concernés, groupes compris. Une liste d'au moins quatre périmètres, qui dépasse aussi la moitié des périmètres non archivés de l'activité, ouvre une fenêtre de confirmation à l'enregistrement. Une petite activité n'affiche donc pas cette fenêtre pour deux ou trois périmètres.
- La fenêtre s'affiche pour toute personne qui rédige la fiche, admin ou non. Une mention de groupe y mène souvent : elle reste admise.
- La fenêtre rappelle que la fiche apparaîtra dans ces périmètres, et propose de la rendre commune.
- La personne confirme la liste, ou revient à l'éditeur pour la modifier. Rien ne l'oblige à réduire la liste, et aucun admin ne valide la diffusion.

### Masquage par le périmètre cible

- Le partage ne demande pas d'accord préalable : une fiche en lecture seule n'impose aucun travail au périmètre cible.
- Une personne qui écrit dans le périmètre cible masque une fiche connexe pour ce périmètre. Le masquage vaut pour tout le périmètre, et le journal le garde.
- Une fiche masquée quitte la section « Fiches connexes » du périmètre cible. Elle reste lisible par son lien, et la fiche affiche « Masquée par Logistique ».
- Une personne du périmètre cible ou un admin de l'activité affiche de nouveau une fiche masquée.

### Tâches partagées

- Une déclinaison peut citer la fiche de sa tâche partagée, même quand cette fiche appartient au périmètre d'origine.
- Tant que la déclinaison est acceptée, la fiche est connexe pour le périmètre cible. Ce lien vient de la tâche : il ne s'écrit pas dans la liste « Concerne aussi », et la fiche indique « Connexe par la tâche … ».
- Une déclinaison refusée ou en attente n'ouvre pas la fiche.
- Une déclinaison peut toujours citer une fiche commune.

### Contenu

- L'en-tête d'une fiche gagne deux clés facultatives : `concerne`, avec les identifiants des périmètres, et `concerneGroupes`, avec les clés des groupes.

  ```markdown
  ---
  slug: planifier-les-creneaux
  titre: Planifier les créneaux des bénévoles
  concerne: [logistique, accueil]
  concerneGroupes: [sport]
  ---
  ```

- La validation (`orga:valider`) refuse un périmètre inconnu, un périmètre d'une autre activité, le périmètre de la fiche, un groupe que l'activité ne déclare pas, et ces clés sur une fiche commune.
- L'import applique la liste. L'export l'écrit, chaque clé triée, et l'export vers l'espace de fichiers la reprend avec le reste de l'en-tête (ADR 0038).
- Le masquage et les liens venus d'une déclinaison vivent en base seulement. Ils n'entrent pas dans le contenu.
- Une mention reste du texte dans le contenu. Elle se lit `@logistique` ou `@groupe:sport` hors de Relaytour.

### Notifications

- L'ajout d'un périmètre à la liste prévient ses référentes et référents dans l'application : « Une fiche du pôle Bénévoles concerne aussi votre périmètre ». L'ajout d'un groupe prévient ceux de chacun de ses périmètres. Aucun mail immédiat ni aucune notification push ne part : comme les autres nouvelles d'un périmètre, la notification entre dans le résumé.
- Un périmètre qui rejoint plus tard un groupe de la liste ne déclenche aucune notification : la fiche apparaît dans ses fiches connexes.
- Une clé par fiche et par tranche de dix minutes regroupe les ajouts successifs.
- Le retrait d'un périmètre ou d'un groupe et le masquage ne préviennent personne.
- L'ajout d'une fiche connexe ne donne aucun point de score.

## Conséquences

- Une migration additive crée trois tables, chacune avec un index unique borné par la fiche, elle-même rangée dans une activité (invariant 18) :
  - `FicheConnexe` : `ficheId`, `perimetreId`, `ajouteeParId`, `ajouteeLe`, unique sur `(ficheId, perimetreId)` ;
  - `FicheGroupeConnexe` : `ficheId`, `groupe`, `ajouteParId`, `ajouteLe`, unique sur `(ficheId, groupe)` ;
  - `FicheConnexeMasquee` : `ficheId`, `perimetreId`, `masqueeParId`, `masqueeLe`, unique sur `(ficheId, perimetreId)`. Le masquage vaut quel que soit le chemin du partage : périmètre, groupe ou déclinaison.
- Le contrat GraphQL gagne les champs `concerneAussi`, `concerneGroupes`, `connexePar` et `masquee` de la fiche, la liste `fichesConnexes` du périmètre, et les mutations qui règlent la liste, masquent et affichent une fiche connexe.
- Une écriture de la liste ou un masquage publie le signal `FICHE` aux personnes qui lisent la fiche dans chaque périmètre concerné (ADR 0017).
- La lecture d'une fiche ajoute une condition : la personne lit les fiches d'un périmètre concerné par la fiche, par la liste, par un groupe de la liste ou par une déclinaison acceptée.
- Le rendu Markdown (`composants/Markdown.tsx`) reconnaît les mentions de périmètre et de groupe. Le guide de la syntaxe des fiches et le mode d'emploi « Écrire une fiche en Markdown » les présentent.
- L'éditeur de fiche gagne le champ « Concerne aussi », la proposition des périmètres et des groupes mentionnés, et la fenêtre de confirmation de large diffusion.
- L'export complet d'une organisation porte les fiches connexes, leur masquage et leurs auteurs.
- Le glossaire gagne « fiche connexe » et « mention ».

## Revue de sécurité

- La fiche connexe ouvre une lecture nouvelle : des personnes d'un autre périmètre lisent une fiche. Seules les personnes qui peuvent rédiger la fiche, et les admins de l'activité, choisissent ces périmètres. La lecture reste bornée à l'activité de la fiche.
- Un périmètre d'une autre activité ou d'une autre organisation reçoit le même refus qu'un périmètre inconnu, à l'écriture comme à l'import.
- Une mention ne change aucun droit. Seule la liste « Concerne aussi », ou une déclinaison acceptée, ouvre une lecture.
- Le masquage n'écrit rien sur la fiche et ne la rend pas illisible. Seules les personnes qui écrivent dans le périmètre cible, et les admins de l'activité, le règlent.
- Une fiche qui contient une coordonnée personnelle est lue par plus de personnes. Le rappel de l'éditeur et la validation du contenu (invariant 16) s'appliquent sans changement.
- Les tests prouvent chaque refus : sans session, en consultation seule, depuis un périmètre absent de la liste, après un masquage pour la liste du périmètre, avec une déclinaison refusée ou en attente, depuis une autre activité et vers une autre organisation.
