---
cible: serveur
type: correctif
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Une affectation à une nouvelle activité s'affiche sans délai
  texte: >-
    Quand une autre personne vous affecte à une activité que vous ne voyiez
    pas encore, l'activité apparaît aussitôt dans votre menu. Vous n'attendez
    plus la mise à jour périodique, qui pouvait prendre cinq minutes.
en:
  titre: >-
    An appointment to a new activity shows right away
  texte: >-
    When another person appoints you to an activity you could not see yet, the
    activity appears in your menu at once. You no longer wait for the periodic
    update, which could take five minutes.
---

Un flux mémorise les droits de sa personne et ne les relisait qu'une fois par
minute au plus (`RELECTURE_DROITS_MS`). Le signal `EQUIPE` d'une activité que
la personne ne voyait pas encore était donc filtré avec ses anciens droits. Le
flux relit désormais les droits à chaque signal `EQUIPE`, avant de le trier.
Les autres signaux gardent la relecture d'une minute.
