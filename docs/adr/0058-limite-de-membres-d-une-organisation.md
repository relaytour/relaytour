# ADR 0058 — Limite de membres d'une organisation

- **Statut** : proposée
- **Date** : 2026-11-03
- Complète l'ADR 0008 (limites d'une organisation), l'ADR 0030 (invitation d'un compte extérieur) et l'ADR 0031 (archivage d'une personne).

## Contexte

L'administration de l'installation fixe deux limites par organisation : le nombre d'activités et le nombre de périodes ouvertes (ADR 0008). Aucune limite ne porte sur le nombre de membres.

Un hébergeur qui fait tourner plusieurs installations sur une même machine dimensionne chaque pile pour une taille d'équipe. Le nombre de membres détermine les connexions simultanées, les flux temps réel et le volume des mails. Une organisation de plusieurs milliers de membres peut ainsi saturer une pile prévue pour quelques centaines. L'hébergeur a besoin d'une limite pour proposer une formule plus grande au-delà d'un seuil.

La colonne `Organisation.limites` ne peut pas recevoir cette limite. Son schéma refuse toute clé inconnue. Après un retour à une version antérieure, l'organisation perdrait toutes ses limites. L'ADR 0052 a écarté les modules autorisés de cette colonne pour la même raison.

## Décision

### Ce que compte la limite

- La limite `membres` plafonne les places d'une organisation. Une place est une appartenance active ou une invitation en attente d'un compte extérieur (ADR 0030).
- Une personne archivée dans l'organisation (ADR 0031) ne compte pas. Archiver une personne libère donc sa place.
- Une invitation expirée ne compte pas. Une invitation acceptée garde la place qu'elle occupait.
- Les fiches bénévoles (ADR 0041) ne comptent pas. Elles n'ouvrent aucun compte, et le plafond quotidien des mails borne déjà leur coût (ADR 0034).
- Le premier admin créé par l'administration de l'installation ne consulte pas la limite, comme les autres scripts de l'hébergeur (ADR 0008). L'import d'une équipe la consulte, depuis la commande `equipe:importer` comme depuis l'espace organisateur. L'import du contenu consulte de même la limite d'activités.

### Ce que la limite refuse

- Une entrée qui prendrait une place au-delà de la limite est refusée avec le code `LIMITE_ATTEINTE`. Le message renvoie vers `CONTACT_HEBERGEUR`, comme les autres limites.
- Les entrées refusées sont la création d'un compte par une invitation, une invitation nouvelle d'un compte extérieur, l'acceptation d'une demande, l'import d'une équipe et le rétablissement d'une personne archivée.
- Compléter une invitation en attente ne prend pas de place. Ajouter une personne déjà membre à une autre activité n'en prend pas non plus.
- L'import d'une équipe compte les places de la même façon en simulation. Une simulation refuse donc la ligne que l'import refuserait.
- Baisser la limite sous le nombre de places occupées ne retire personne. Les membres et les invitations en place restent. Seules les nouvelles entrées sont refusées.
- La limite ne bloque jamais la lecture ni l'export.

### Concurrence

- Une transaction qui fait entrer des personnes verrouille d'abord la ligne de l'organisation, puis compte les places. Deux entrées simultanées ne dépassent donc jamais la limite.
- Le comptage est une lecture ordinaire. Sous MariaDB 11.8, il fige la vue de la transaction. Un verrou de compte que la transaction prend d'emblée (`verrouillerCompte`, pour le rétablissement) le précède donc.
- Chaque entrée consomme sa place avant d'écrire. Un import de plusieurs personnes avance le compteur dans la même transaction.

### Stockage et API

- La limite vit dans la colonne nullable `Organisation.limiteMembres`. Une valeur nulle signifie qu'aucune limite ne s'applique.
- L'API d'administration la présente avec les autres limites : `limites { membres }` en lecture, et `membres` dans `LimitesOrganisationInput` en écriture. Une valeur nulle retire la limite.
- La requête `organisations` ajoute `placesMembresOccupees`, le nombre que compte la limite. `nombreMembres` garde son sens : toutes les appartenances, archivées comprises.
- La commande `organisation:creer` reçoit `--limite-membres <n>`.

## Conséquences

- Un hébergeur peut vendre des formules par taille d'équipe sans lire aucune donnée des membres. Il ne voit que des compteurs.
- Un retour à une version antérieure ignore la limite de membres et garde les autres limites.
- Une organisation auto-hébergée n'a aucune limite. Le logiciel reste le même pour tout le monde (ADR 0007).
- Toute nouvelle façon de faire entrer une personne dans une organisation doit prendre une place par `placesMembres`. Un test d'intégration couvre chaque entrée actuelle.
