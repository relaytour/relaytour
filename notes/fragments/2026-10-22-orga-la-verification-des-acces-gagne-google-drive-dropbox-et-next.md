---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.20.0
fr:
  titre: >-
    La vérification des accès fonctionne avec Google Drive, Dropbox et
    Nextcloud
  texte: >-
    La vérification et la gestion des accès fonctionnent aussi avec Google
    Drive, Dropbox et Nextcloud. Avec Google Drive et Nextcloud, un admin de
    l'organisation les active sans reconnexion. Avec Dropbox, l'activation
    passe par une reconnexion. Google Drive et Dropbox n'ont pas d'annuaire
    des comptes : Relaytour compare alors l'adresse de chaque personne à
    celles des droits du dossier, domaine compris. Dans l'onglet « Comptes »,
    vous saisissez l'adresse qu'une personne utilise chez le fournisseur quand
    elle diffère.
en:
  titre: >-
    Access check works with Google Drive, Dropbox, and Nextcloud
  texte: >-
    Access check and access management also work with Google Drive, Dropbox, and
    Nextcloud. With Google Drive and Nextcloud, an organization admin turns them
    on without reconnecting. With Dropbox, turning them on requires a
    reconnection. Google Drive and Dropbox have no account directory, so
    Relaytour compares each person’s email address with those in the folder’s
    rights, domain included. In the “Accounts” tab, you enter the email address
    a person uses at the provider when it differs.
---

ADR 0044 : annuaires facultatifs de Google Drive (`permissions`), Dropbox
(`sharing/list_folder_members`, `add_folder_member`, `remove_folder_member`,
portées `sharing.read` et `sharing.write`) et Nextcloud (recherche `sharees`,
partages OCS, groupes OCS quand le compte les administre). Mutation
`reglerPorteeConnexion` pour Google Drive et Nextcloud. Un droit de domaine
nommé ne couvre que les adresses de ce domaine. Sans annuaire, aucun compte ne
se garde en base.
