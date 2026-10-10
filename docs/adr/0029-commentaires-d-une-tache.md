# ADR 0029 — Commentaires d'une tâche

- **Statut** : acceptée
- **Date** : 2026-10-10

## Contexte

Une tâche porte un titre, une description, une échéance et un statut. Elle n'a aucun endroit où une équipe note son avancement : un compte rendu, une information reçue, une question à une autre personne.

Le contact principal d'un périmètre a demandé un espace de notes sur chaque tâche. La description peut en tenir lieu, avec trois défauts :

- la description d'origine et les notes partagent le même champ ;
- une note n'a ni date ni auteur ;
- chaque modification d'une tâche assignée demande une confirmation et envoie un mail aux personnes assignées.

Le journal garde déjà l'histoire d'une tâche : sa création, ses modifications, ses assignations et ses changements de statut. Aucun écran ne la montre.

## Décision

### La notion

- Un **commentaire** est un texte daté et signé, écrit par une personne sur une tâche. Le mot « note » reste réservé aux notes de version (ADR 0021).
- Une tâche porte un **fil** : ses commentaires et les événements de son journal, du plus ancien au plus récent.
- Un commentaire appartient à sa tâche. Une déclinaison a son propre fil, distinct de celui de sa tâche partagée (ADR 0026).

### Droits

- Une personne lit le fil d'une tâche quand elle lit son périmètre : elle administre l'activité, ou elle a été affectée au périmètre au moins une fois. Une personne en consultation (ADR 0014) lit la tâche sans son fil.
- Une personne écrit un commentaire quand elle écrit dans le périmètre de la tâche : elle y est affectée pour la période, ou elle administre l'activité. Une période archivée reste en lecture seule.
- Une déclinaison qui attend un accord, ou refusée, ne reçoit aucun commentaire.
- L'auteur modifie son commentaire. Le fil indique alors qu'il a été modifié.
- L'auteur supprime son commentaire. Un admin de l'activité supprime tout commentaire de ses périmètres. La suppression est définitive et ne laisse aucune trace dans le fil.

### Texte

- Un commentaire est un texte simple de 4 000 caractères au plus. Il garde ses retours à la ligne.
- L'espace organisateur rend cliquable une adresse `http` ou `https` écrite dans un commentaire. Une adresse de l'espace organisateur s'ouvre dans le même onglet. Toute autre adresse s'ouvre dans un nouvel onglet, sans transmettre l'onglet d'origine.
- Le premier lot ne porte ni mise en forme, ni mention d'une personne, ni pièce jointe.

### Événements du fil

- Le fil reprend cinq événements du journal : tâche créée, modifiée, assignée, retirée, changement de statut.
- Un passage à « faite » ne nomme personne, sauf pour la personne qui a coché et pour les admins de l'activité. La règle est celle des notifications.
- Les étapes de l'accord d'une déclinaison restent réservées aux admins de l'activité, dans leur écran actuel.

### Notifications

- Un commentaire prévient les personnes assignées à la tâche, sauf son auteur : une notification dans l'application, et une notification push si elles l'ont activée (famille « tâches », ADR 0024).
- Les autres référentes et référents du périmètre l'apprennent dans l'application, selon leur préférence « Activité de vos périmètres ». Une clé par tâche, auteur, destinataire et tranche de dix minutes évite le bruit.
- Aucun mail immédiat ne part. Le résumé par mail reprend ces notifications, comme les autres.
- La notification ne porte pas le texte du commentaire. Elle nomme l'auteur et la tâche, et ouvre le fil.

### Conservation

- Un commentaire vit en base seulement. Il n'entre jamais dans le dossier de contenu d'une organisation, et un import ne le touche pas.
- L'export complet d'une organisation porte les commentaires de chaque tâche. Leur auteur y est désigné comme les autres personnes de l'export.
- Un commentaire se conserve aussi longtemps que sa tâche. La durée de conservation des textes libres qui nomment des personnes se décide avec celle des messages (ticket 71).
- Un commentaire ne donne aucun point au score de participation.
- La recherche ne lit pas les commentaires.

## Conséquences

- Une migration additive crée la table `CommentaireTache` et ajoute la valeur `TACHE_COMMENTEE` au type des notifications.
- L'API gagne la requête `filTache`, la requête `commentairesDeLaPeriode` et trois mutations : `commenterTache`, `modifierCommentaire`, `supprimerCommentaire`.
- Le fil se lit dans une requête à part, à l'ouverture d'une tâche. Les listes de tâches ne grandissent pas : le serveur borne une requête à 100 champs. Le nombre de commentaires par tâche se lit aussi à part, par période.
- Une écriture publie le signal `TACHE` du flux des changements (ADR 0017). Le fil ouvert chez une autre personne se relit alors.
- L'espace organisateur ouvre le fil dans un volet, depuis la carte d'une tâche. La carte affiche le nombre de commentaires.
- Le fil rend au plus les 200 derniers commentaires et les 200 derniers événements d'une tâche.
- Un fil commun à une tâche partagée et à ses déclinaisons reste possible plus tard. Il demanderait une nouvelle ADR.

## Revue de sécurité

- Chaque lecture et chaque écriture part de la tâche, puis de son périmètre, dans l'organisation active. Un commentaire d'une autre organisation, d'une activité invisible ou d'un périmètre non lu reçoit le même refus qu'une tâche inconnue.
- `commentairesDeLaPeriode` ne nomme que les périmètres que la personne lit, et ne compte que leurs tâches.
- Le texte d'un commentaire s'affiche comme du texte, jamais comme du HTML. Seules les adresses `http` et `https` deviennent des liens.
- Le texte d'un commentaire n'entre ni dans le journal du serveur, ni dans une notification, ni dans la charge utile d'une file.
- La table des refus croisés couvre les deux requêtes et les trois mutations.
