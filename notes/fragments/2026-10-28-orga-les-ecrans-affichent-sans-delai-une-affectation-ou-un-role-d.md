---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.23.0
fr:
  titre: >-
    Les écrans affichent sans délai une affectation ou un rôle d'admin
  texte: >-
    Quand vous affectez une personne, vous-même compris, le menu, la liste des
    périmètres et la page du périmètre l'affichent aussitôt. Un écran que vous
    rouvrez se met à jour pendant que vous le lisez. Vous n'avez plus besoin de
    recharger la page.
en:
  titre: >-
    Screens show a new appointment or admin role right away
  texte: >-
    When you appoint someone, yourself included, the menu, the area list and
    the area page show it at once. A screen you open again updates while you
    read it. You no longer need to reload the page.
---

Un signal du flux ne relisait que les écrans affichés, et Apollo servait les
autres depuis le cache (`cache-first`) jusqu'à la relecture périodique, soit
cinq minutes flux ouvert. Le client revalide désormais chaque écran à son
ouverture (`cache-and-network`, puis `cache-first`), et les écrans qui
testaient `loading` seul testent `loading && !data`.

Les mutations d'équipe émettent un signal local (`signalerLocalement`), qui
rejoint le lot de l'écho du serveur et relit les écrans même flux fermé.
`EQUIPE` relit aussi `Activites`, `Moi`, `MesOrganisations`, l'annuaire,
l'équipe, les souhaits et les écrans « Admins ». `Messages`, signalé par
`MESSAGE`, entre dans la liste des requêtes relues : le filtre l'écartait.
`ENTITES` liste les entités du flux, et un test vérifie que chacune relit au
moins une requête connue de la relecture.

Côté serveur, `definirAdminActivite` publie `EQUIPE` pour son activité quand le
rôle change. `modifierPersonne` publie un `EQUIPE` sans activité, adressé à la
seule personne nommée ou retirée (`publierRoleOrganisation`), que
`peutRecevoir` ne livre qu'à elle.
