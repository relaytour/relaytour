---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    La vérification des accès gagne Google Drive, Dropbox et Nextcloud
  texte: >-
    La vérification et la gestion des accès fonctionnent aussi avec Google
    Drive, Dropbox et Nextcloud. Google Drive et Nextcloud les activent sans
    reconnexion ; Dropbox demande une reconnexion. Google Drive et Dropbox ne
    publient pas d'annuaire : Relaytour compare alors l'adresse de chaque
    personne à celles des droits du dossier, domaine compris. Dans l'onglet
    « Comptes », vous saisissez l'adresse qu'une personne utilise chez le
    fournisseur quand elle diffère.
---

ADR 0044 : annuaires facultatifs de Google Drive (`permissions`), Dropbox
(`sharing/list_folder_members`, `add_folder_member`, `remove_folder_member`,
portées `sharing.read` et `sharing.write`) et Nextcloud (recherche `sharees`,
partages OCS, groupes OCS quand le compte les administre). Mutation
`reglerPorteeConnexion` pour Google Drive et Nextcloud. Un droit de domaine
nommé ne couvre que les adresses de ce domaine. Sans annuaire, aucun compte ne
se garde en base.
