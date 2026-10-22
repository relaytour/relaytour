# ADR 0043 — Dossiers liés à plusieurs lecteurs et documents liés d'une fiche partagée

- **Statut** : acceptée
- **Date** : 2026-10-22
- Complète l'ADR 0038 (fiches et espace de fichiers) et l'ADR 0039 (fiches connexes). Remplace trois règles de l'ADR 0038 :
  - un dossier lié ne sert plus un seul périmètre ou toute l'activité ;
  - une ressource liée ne vient plus seulement d'un dossier du périmètre de la fiche ;
  - les noms « Espace de fichiers » et « ressource liée » changent.

## Contexte

Un admin de l'organisation lie aujourd'hui un dossier de l'espace de fichiers à un seul périmètre, ou à toute l'activité. Plusieurs problèmes en découlent :

- Un dossier qui sert neuf sports demande neuf liens. Un sport créé plus tard n'en reçoit aucun.
- La liste « Concerne aussi » d'une fiche accepte des groupes (`@groupe:sport`, ADR 0039), mais un dossier lié ne les accepte pas.
- Un lien ne se modifie pas. Changer ses lecteurs demande de le retirer, puis de le recréer, et ce retrait supprime les ressources liées des fiches.

Une fiche connexe (ADR 0039) se lit dans d'autres périmètres. Ses ressources liées gardent la règle de leur dossier lié. Un lecteur de ces périmètres voit alors « Réservée au périmètre d'origine », et la personne qui rédige la fiche n'en est pas avertie. Elle ne dispose d'aucun moyen de rendre ces ressources lisibles.

Le mot « ressource » désigne enfin deux notions différentes :
- ce qu'une fiche cite ;
- l'ensemble des fiches et des documents d'une activité.

L'écran « Espace de fichiers » porte aussi un nom technique, alors que les admins parlent de leur fournisseur cloud.

## Décision

### Les lecteurs d'un dossier lié

- Un dossier lié déclare ses **lecteurs**. Ses lecteurs sont soit toute l'activité, soit une liste de périmètres et de groupes de cette activité.
- Un groupe de la liste vaut pour tous ses périmètres non archivés, aujourd'hui et plus tard, comme dans « Concerne aussi » (ADR 0039).
- Une personne lit le dossier lié dans deux cas. Elle lit toujours un dossier de toute l'activité, sous la même condition qu'une fiche commune. Elle lit un dossier à liste quand elle lit les fiches d'au moins un périmètre concerné.
- La consultation (ADR 0014) n'ouvre toujours aucun dossier.
- La liste compte au plus cent éléments. Elle ne contient ni périmètre archivé, ni groupe que l'activité ne déclare pas. Un groupe sans périmètre est refusé.
- Ces refus ne visent que les ajouts. Une modification garde un périmètre archivé ou un groupe devenu vide que le lien nomme déjà.
- Un dossier se lie une seule fois par activité. L'admin ajoute un lecteur à ce lien au lieu d'en créer un second.

### Modifier un lien

- Un admin de l'organisation modifie les lecteurs et le nom affiché d'un dossier lié. Le dossier lui-même ne change pas : ses documents liés gardent leur chemin.
- Avant l'enregistrement, l'écran annonce les documents liés qui ne seraient plus lisibles par les lecteurs de leur fiche. Il annonce aussi les fiches qui les portent.
- Un document lié incompatible reste en base. La fiche le masque tant que son dossier ne la sert pas, comme pour une fiche déplacée (ADR 0038).

### Documents liés à une fiche

- Un document lié s'attache à une fiche quand son dossier lié sert tous les lecteurs du périmètre de la fiche. Ce dossier vaut pour toute l'activité, ou sa liste contient le périmètre de la fiche, directement ou par son groupe.
- Une fiche commune n'admet que les dossiers de toute l'activité.
- Une personne ouvre un document lié quand elle lit son dossier lié, ou quand le document est ouvert aux lecteurs de la fiche.
- Un document ouvert ne se lit que tant que son dossier lié sert encore la fiche. Après le déplacement de la fiche ou la réduction des lecteurs, Relaytour referme le document comme le reste du dossier.

### Fiche partagée et document réservé

- Une fiche qui concerne aussi d'autres périmètres peut porter un document que certains de ces périmètres ne lisent pas. L'éditeur et la fiche avertissent alors la personne qui rédige : ils nomment les périmètres qui n'ouvriront pas ce document.
- Un admin de l'organisation dispose de deux réponses :
  - **Étendre le dossier lié.** Les périmètres et les groupes de « Concerne aussi » rejoignent les lecteurs du dossier. Un groupe reste un groupe. Tout le dossier devient lisible par ces périmètres.
  - **Ouvrir ce document aux lecteurs de la fiche.** Seul ce document devient lisible, par toute personne qui lit la fiche, partage compris. Pour un sous-dossier, l'ouverture vaut pour son contenu et rien d'autre.
- Le dossier lié entier, cité par une fiche, ne s'ouvre pas comme un document. L'admin étend alors les lecteurs du dossier.
- Une personne qui rédige sans être admin de l'organisation lit l'avertissement. L'avertissement l'invite à s'adresser à un admin de l'organisation.
- Une personne qui ne peut pas ouvrir le document lit toujours « Réservée au périmètre d'origine ».
- Le document garde l'auteur et la date de son ouverture. Un admin de l'organisation la retire à tout moment.
- Cette ouverture vaut dans Relaytour seulement. Chez le fournisseur, les droits de la personne ne changent pas. Le lien « Ouvrir dans … » ne fonctionne que si elle y a accès (ADR 0044).

### Noms

- L'entrée de menu « Fiches » devient **« Ressources »**. La page garde ses deux vues, « Fiches » et « Documents ».
- Une « ressource liée » devient un **document lié**.
- L'écran « Espace de fichiers » devient **« Fournisseur cloud »**. Le glossaire nomme ainsi le service où l'association range ses documents. `espace-fichiers` reste le nom technique du code et des adresses.
- Les adresses `/fiches` et `/admin/espace-fichiers` ne changent pas, pour qu'aucun lien de mail ne casse.

## Conséquences

- Une migration additive ajoute trois éléments :
  - le champ `DossierLie.touteActivite` ;
  - la table `DossierLiePerimetre`, qui porte le dossier et le périmètre ;
  - la table `DossierLieGroupe`, qui porte le dossier et la clé du groupe.

  Elle recopie chaque lien existant : un lien sans périmètre devient un lien de toute l'activité, et un lien à un périmètre devient une liste d'un périmètre.
- `DossierLie.perimetreId` reste en base pour une version antérieure. Un nouveau lien y écrit le premier périmètre de sa liste (ou celui du premier groupe), ou rien pour toute l'activité. Après un retour arrière, une version antérieure lit donc moins de personnes, jamais davantage.
- Des liens en double d'un même dossier peuvent déjà exister. Ils restent en base, et l'admin les regroupe en modifiant l'un d'eux puis en retirant l'autre.
- `RessourceFiche` reçoit `ouverteAuxLecteurs`, avec son auteur et sa date.
- La route d'aperçu et la lecture d'un dossier acceptent un document ouvert. Le chemin demandé doit alors rester sous le chemin du document.
- `lierDossier` reçoit les lecteurs. `modifierDossierLie`, `effetsLecteursDossier` et `ouvrirDocumentLie` s'ajoutent au schéma.
- L'export des fiches et l'archive du contenu ne changent pas. L'export complet d'une organisation reprend les lecteurs des dossiers liés et l'ouverture des documents.
- Le glossaire, les modes d'emploi et leurs captures prennent les nouveaux noms.

## Revue de sécurité

- Le lien, la modification d'un lien, l'extension d'un dossier et l'ouverture d'un document exigent le rôle ADMIN dans l'organisation active, comme le lien d'un dossier (ADR 0038). L'admin d'activité et la personne qui rédige une fiche ne les obtiennent pas.
- Un groupe s'évalue à chaque lecture. Un nouveau périmètre du groupe ouvre le dossier sans autre geste, et un périmètre archivé ne l'ouvre plus par son groupe. Un périmètre archivé que la liste nomme directement garde la lecture, comme ses fiches gardent la leur. La fenêtre du lien rappelle la règle des groupes.
- Un document ouvert ne donne accès qu'à son propre sous-arbre. Le serveur vérifie que le chemin demandé commence par le chemin du document et applique les mêmes refus qu'un dossier lié (« . », « .. », séparateurs). Des tests prouvent le refus d'un fichier voisin du même dossier.
- La lecture d'un dossier lié ne passe plus par les droits de partage d'une fiche. Une fiche partagée n'ouvre que les documents ouverts à ses lecteurs.
- Des tests prouvent le refus pour chaque cas :
  - une personne d'un pôle face à un dossier lié au groupe des sports ;
  - un périmètre archivé du groupe ;
  - une personne qui rédige une fiche et tente une modification réservée aux admins de l'organisation ;
  - un document ouvert dont le dossier ne sert plus la fiche ;
  - le document ouvert d'une autre organisation ;
  - une requête sans session ;
  - une autre organisation.
