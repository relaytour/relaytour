# ADR 0039 — Fiches connexes et mentions de périmètre

- **Statut** : proposée
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

- Une fiche de périmètre déclare une liste **« Concerne aussi »** : d'autres périmètres non archivés de la même activité.
- Pour chacun de ces périmètres, elle est une **fiche connexe**. Elle reste la fiche de son périmètre d'origine, avec son historique et ses rédactrices et rédacteurs.
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

### Mention d'un périmètre

- Dans le texte d'une fiche, `@` suivi de l'identifiant d'un périmètre de l'activité forme une **mention**, par exemple `@logistique`.
- L'éditeur propose les périmètres de l'activité dès la saisie de `@`.
- La lecture affiche une mention comme l'étiquette du périmètre, avec un lien vers sa page. Une mention d'un périmètre inconnu ou archivé reste du texte.
- Une mention ne donne aucun accès. À l'enregistrement, l'éditeur liste les périmètres mentionnés absents de « Concerne aussi », et propose de les y ajouter. Rien ne s'ajoute sans l'accord de la personne qui enregistre.
- Retirer une mention ne retire pas le périmètre de la liste.

### Seuil d'une large diffusion

- Au-delà de la moitié des périmètres non archivés de l'activité, l'éditeur affiche un avertissement. Il rappelle que la fiche apparaîtra dans ces périmètres, et propose de la rendre commune.
- L'avertissement ne bloque pas l'enregistrement. La personne qui enregistre confirme la liste.
- Quand cette personne n'est pas admin de l'activité, les admins de l'activité reçoivent une notification d'admin (ADR 0033), qui nomme la fiche et le nombre de périmètres. Ils retirent des périmètres de la liste s'ils le jugent utile.

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

- L'en-tête d'une fiche gagne une clé facultative `concerne`, avec la liste des identifiants des périmètres :

  ```markdown
  ---
  slug: planifier-les-creneaux
  titre: Planifier les créneaux des bénévoles
  concerne: [logistique, accueil]
  ---
  ```

- La validation (`orga:valider`) refuse un périmètre inconnu, un périmètre d'une autre activité, le périmètre de la fiche et la clé sur une fiche commune.
- L'import applique la liste. L'export l'écrit, triée par identifiant, et l'export vers l'espace de fichiers la reprend avec le reste de l'en-tête (ADR 0038).
- Le masquage et les liens venus d'une déclinaison vivent en base seulement. Ils n'entrent pas dans le contenu.
- Une mention reste du texte dans le contenu. Elle se lit `@logistique` hors de Relaytour.

### Notifications

- L'ajout d'un périmètre à la liste prévient ses référentes et référents dans l'application : « Une fiche du pôle Bénévoles concerne aussi votre périmètre ». Aucun mail ni aucune notification push ne part.
- Une clé par fiche et par tranche de dix minutes regroupe les ajouts successifs.
- Le retrait d'un périmètre et le masquage ne préviennent personne.
- L'ajout d'une fiche connexe ne donne aucun point de score.

## Conséquences

- Une migration additive crée la table `FicheConnexe` : `ficheId`, `perimetreId`, `ajouteeParId`, `ajouteeLe`, `masqueeParId`, `masqueeLe`. Un index unique porte sur `(ficheId, perimetreId)`. Cette clé est bornée par la fiche, elle-même rangée dans une activité (invariant 18).
- Le contrat GraphQL gagne les champs `concerneAussi`, `connexePar` et `masquee` de la fiche, la liste `fichesConnexes` du périmètre, et les mutations qui règlent la liste, masquent et affichent une fiche connexe.
- Une écriture de la liste ou un masquage publie le signal `FICHE` aux personnes qui lisent la fiche dans chaque périmètre concerné (ADR 0017).
- La lecture d'une fiche ajoute une condition : le périmètre de la personne figure dans les fiches connexes actives de la fiche, ou une déclinaison acceptée la relie à la fiche.
- Le rendu Markdown (`composants/Markdown.tsx`) reconnaît les mentions. Le guide de la syntaxe des fiches et le mode d'emploi « Écrire une fiche en Markdown » les présentent.
- L'éditeur de fiche gagne le champ « Concerne aussi », la proposition des périmètres mentionnés et l'avertissement de large diffusion.
- L'export complet d'une organisation porte les fiches connexes, leur masquage et leurs auteurs.
- Le glossaire gagne « fiche connexe » et « mention ».

## Revue de sécurité

- La fiche connexe ouvre une lecture nouvelle : des personnes d'un autre périmètre lisent une fiche. Seules les personnes qui peuvent rédiger la fiche, et les admins de l'activité, choisissent ces périmètres. La lecture reste bornée à l'activité de la fiche.
- Un périmètre d'une autre activité ou d'une autre organisation reçoit le même refus qu'un périmètre inconnu, à l'écriture comme à l'import.
- Une mention ne change aucun droit. Seule la liste « Concerne aussi », ou une déclinaison acceptée, ouvre une lecture.
- Le masquage n'écrit rien sur la fiche et ne la rend pas illisible. Seules les personnes qui écrivent dans le périmètre cible, et les admins de l'activité, le règlent.
- Une fiche qui contient une coordonnée personnelle est lue par plus de personnes. Le rappel de l'éditeur et la validation du contenu (invariant 16) s'appliquent sans changement.
- Les tests prouvent chaque refus : sans session, en consultation seule, depuis un périmètre absent de la liste, après un masquage pour la liste du périmètre, avec une déclinaison refusée ou en attente, depuis une autre activité et vers une autre organisation.

## Questions ouvertes

- Le seuil vaut « plus de la moitié des périmètres non archivés de l'activité ». Une activité de trois périmètres déclenche alors l'avertissement dès deux périmètres. Un minimum de quatre périmètres éviterait ce bruit.
- Une mention d'un groupe (`@sports`) pourrait désigner tous ses périmètres. Cette ADR ne la retient pas : elle mènerait vite au seuil de large diffusion.
