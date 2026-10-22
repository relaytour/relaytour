# ADR 0044 — Accès chez le fournisseur cloud : vérification et propositions

- **Statut** : proposée
- **Date** : 2026-10-22
- Complète l'ADR 0038 (fiches et espace de fichiers) et l'ADR 0043 (dossiers liés à plusieurs lecteurs). Remplace deux règles de l'ADR 0038 :
  - la liste fermée des autorisations demandées à Microsoft ;
  - la phrase « Relaytour n'en ajoute ni n'en retire » sur les droits d'une personne chez le fournisseur.

## Contexte

Relaytour décide de l'accès aux dossiers liés dans Relaytour (ADR 0038). La liseuse lit par le compte connecté, quels que soient les droits de la personne chez le fournisseur.

Les droits du fournisseur comptent pourtant pour le travail courant. Le lien « Ouvrir dans … » ne fonctionne que pour une personne qui a un compte avec accès au document. Un référent qui veut modifier un tableur doit aussi y avoir accès. Aujourd'hui, la coordination ouvre ces accès à la main. Dans une association, par exemple, elle les ouvre aux sections et aux contacts principaux, dans un site SharePoint rangé par pôle et par sport. Personne ne voit quelles personnes de l'équipe n'ont pas encore accès, ni quels accès restent ouverts à une personne qui a quitté l'équipe.

Deux usages coexistent selon les associations et les fournisseurs :

- **Partage direct.** L'association partage chaque dossier avec des personnes.
- **Groupe du fournisseur.** L'association gère un groupe (Microsoft 365, groupe SharePoint d'un site, groupe Nextcloud), et c'est le groupe qui a accès au dossier.

Une personne peut avoir accès par plusieurs voies à la fois : directement, par un groupe, par le domaine de l'organisation, par un lien.

## Décision

### Ce que Relaytour fait et ne fait pas

- Relaytour compare les personnes attendues pour un dossier lié aux droits de ce dossier chez le fournisseur. Il présente les écarts à un admin de l'organisation.
- Relaytour prépare des **propositions** : ajouter un accès, retirer un accès. Un admin de l'organisation les applique ou les écarte.
- Un admin de l'organisation peut rendre les ajouts automatiques, dossier lié par dossier lié. Les retraits ne sont jamais automatiques.
- **Relaytour ne retire qu'un droit qu'il a lui-même créé.** Un droit posé à la main chez le fournisseur n'est jamais retiré. Il apparaît seulement parmi les « accès en trop ».
- La lecture dans Relaytour ne change pas : la vérification ne porte que sur les droits du fournisseur.

### Les personnes attendues

- Chaque dossier lié règle qui doit avoir accès chez le fournisseur :
  - **tous les membres**, c'est-à-dire les personnes affectées aux périmètres lecteurs pour la période ;
  - **les contacts principaux seulement** (ADR 0011).
- La période est celle de l'organigramme : la période en préparation ou en cours la plus récente (ADR 0036).
- Pour un dossier de toute l'activité, les personnes attendues sont celles de tous ses périmètres, plus les admins de l'activité.

### Correspondance des comptes

- Relaytour rapproche une personne de son compte chez le fournisseur par son adresse. Il cherche une adresse à la fois, ou un lot d'adresses. Il ne liste jamais tout l'annuaire du fournisseur.
- Un admin de l'organisation saisit une autre adresse pour une personne qui utilise un compte différent chez le fournisseur.
- Un compte se présente comme **trouvé**, **invité** (compte externe déjà accueilli) ou **absent**.

### Vérification des accès

- Relaytour lit les droits du dossier lié chez le fournisseur : personnes, groupes, domaine et liens, avec leur rôle, hérités ou non.
- Un groupe se développe en ses membres quand le fournisseur le permet. Sinon, ses membres restent « composition non lisible ».
- Chaque personne attendue reçoit un état :
  - **a accès**, avec la voie (directement, par tel groupe, par le domaine) ;
  - **sans compte** dans l'annuaire du fournisseur ;
  - **sans accès** : un compte existe, mais aucun droit ne le couvre ;
  - **inconnu** : un groupe non lisible pourrait le couvrir.
- Les **accès en trop** sont les personnes qui ont un droit sans être attendues. Relaytour garde leur nom, sans leur adresse.
- Un admin de l'organisation lit la vérification dans l'écran « Fournisseur cloud », onglet « Vérification des accès », rangée par équipe de périmètre. Il la relance à la demande. Le worker la refait chaque nuit, et après un changement d'équipe quand le dossier a un mode d'accès.

### Mode d'accès d'un dossier lié

- **Aucun** (par défaut) : Relaytour vérifie seulement.
- **Partage du dossier** : une proposition d'ajout partage le dossier avec la personne, en lecture ou en écriture. L'admin choisit si le fournisseur envoie son mail d'invitation.
- **Groupe du fournisseur** : une proposition d'ajout fait entrer la personne dans le groupe choisi. L'admin choisit ce groupe parmi ceux qui ont déjà un droit sur le dossier. Une personne sans compte dans l'annuaire ne peut pas entrer dans un groupe : Relaytour ne propose rien, et la vérification la montre « sans compte ».
- Un changement d'équipe met à jour les propositions de deux façons :
  - une affectation, une désignation comme contact principal ou une extension des lecteurs crée une proposition d'ajout ;
  - un retrait d'affectation ou un archivage crée une proposition de retrait, si Relaytour avait créé le droit.
- Une proposition reste unique par dossier, par personne et par action. Une proposition écartée ne revient pas tant que la situation de la personne ne change pas. Une notification d'admin de l'organisation l'annonce une fois par jour au plus (ADR 0033).

### Portée de la connexion

- Une connexion garde sa portée actuelle, la lecture des fichiers et l'export des fiches. L'admin l'élargit depuis l'écran « Fournisseur cloud », par un nouveau consentement :
  - **annuaire** : correspondance des comptes et vérification ;
  - **gestion** : application des propositions.
- Chez Microsoft, chaque portée ajoute ses autorisations déléguées :
  - **annuaire** : `User.Read.All` et `GroupMember.Read.All`. La première cherche aussi les adresses secondaires et reconnaît un invité. Ces deux autorisations demandent le consentement d'un admin Microsoft Entra.
  - **gestion** : `GroupMember.ReadWrite.All` pour les groupes. Le partage d'un dossier utilise `Files.ReadWrite.All`, déjà accordé.
- Graph ne lit pas les membres d'un groupe SharePoint d'un site. Ces groupes restent d'abord « composition non lisible ». Une réalisation suivante les lira par l'API REST de SharePoint, après une recette sur un vrai locataire.
- Les autres fournisseurs déclarent leurs capacités. L'écran masque ce qu'un fournisseur ne sait pas faire :

| Fournisseur | Comptes | Droits d'un dossier | Membres d'un groupe | Partage | Gestion d'un groupe |
|---|---|---|---|---|---|
| SharePoint et OneDrive | par adresse, dans l'annuaire Entra | oui, hérités compris | groupes Microsoft 365 ; pas encore les groupes de site | oui | groupes Microsoft 365 |
| Google Drive | aucun annuaire : Relaytour compare les adresses | oui, domaine compris | non | oui | non |
| Dropbox | aucun annuaire : Relaytour compare les adresses | membres d'un dossier déjà partagé | non | dans un dossier déjà partagé | non |
| Nextcloud | par la recherche du dialogue de partage | partages du dossier lui-même | si le compte connecté administre le groupe | oui, par compte ou par adresse | si le compte connecté administre le groupe |

- Google Drive et Nextcloud activent la vérification et la gestion sans reconnexion : l'accès déjà accordé les couvre. SharePoint et Dropbox demandent une reconnexion. Chez Dropbox, l'application de l'exploitant coche `sharing.read`, puis `sharing.write` pour la gestion.
- Sans annuaire, une personne qui utilise une autre adresse chez le fournisseur paraît sans accès. L'admin saisit alors son adresse chez le fournisseur dans l'onglet « Comptes », ou partage le dossier avec son adresse Relaytour.

## Conséquences

- Une migration additive ajoute deux familles de champs et de tables.
  - **Vérification** :
    - `ConnexionFichiers.portee` ;
    - `DossierLie.attendus` ;
    - les tables `CompteFournisseur` et `EtatAccesFournisseur`.
  - **Propositions** :
    - `DossierLie.accesFournisseur`, `groupeFournisseurId`, `groupeFournisseurNom`, `roleFournisseur` et `ajoutsAutomatiques` ;
    - les tables `PropositionAcces` et `PermissionCreee`.
- Chaque contrainte d'unicité contient l'organisation (invariant 18).
- L'interface des fournisseurs reçoit un annuaire facultatif, avec ses capacités. Le fournisseur en mémoire le réalise pour les tests et la démo.
- La file `planification` reçoit le travail `acces-fournisseur`. Ce travail est regroupé par organisation et par minute, comme l'export des fiches. La tâche de nuit de l'espace de fichiers le relance.
- `creerAffectations`, le retrait d'une affectation, l'archivage d'une personne, le contact principal et la modification d'un dossier lié planifient ce travail. La planification ne lève jamais.
- La notification d'admin `ACCES_FOURNISSEUR_A_VALIDER` s'ajoute au niveau de l'organisation.
- Les comptes, les états et les propositions entrent dans l'export complet de l'organisation, jamais dans le dépôt Git.
- Le guide d'installation décrit les autorisations de chaque portée et le consentement de l'admin Entra.

## Revue de sécurité

- La vérification, la correspondance des comptes, le réglage du mode d'accès et l'application d'une proposition exigent le rôle ADMIN dans l'organisation active. Ces données citent des adresses de toute l'équipe : elles suivent la règle de l'annuaire (ADR 0018). Des tests prouvent le refus sans session, pour un admin d'activité et pour une autre organisation.
- Relaytour ne cherche chez le fournisseur que les adresses des membres de l'organisation. Il ne recopie pas l'annuaire du fournisseur. Les accès en trop gardent un nom, sans adresse, et chaque vérification les remplace.
- Une écriture chez le fournisseur ne part que d'une proposition, appliquée par un admin ou par le réglage des ajouts automatiques. Le serveur relit la proposition et les droits avant chaque écriture.
- Un retrait ne vise qu'un droit enregistré dans `PermissionCreee`. Un droit retiré ou modifié à la main chez le fournisseur sort de cette table à la vérification suivante.
- Le serveur borne chaque appel par un délai. Il respecte `Retry-After` quand le fournisseur limite le débit, et une erreur sur une personne ne bloque pas les autres.
- Le journal ne porte que des identifiants, jamais d'adresse complète (invariant 6).
- Les autorisations élargies ne se demandent qu'à l'admin qui les active. Une organisation qui ne s'en sert pas garde la portée de l'ADR 0038.
