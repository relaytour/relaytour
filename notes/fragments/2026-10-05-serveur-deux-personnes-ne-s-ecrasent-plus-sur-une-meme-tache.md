---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Deux personnes ne s'écrasent plus sur une même tâche
  texte: >-
    Quand une autre personne a modifié une tâche pendant votre saisie, une
    fenêtre vous le dit avant d'enregistrer. Elle nomme la personne et l'heure
    de sa modification. Vous choisissez de recharger la tâche ou d'écraser sa
    version. La même fenêtre s'ouvre quand le statut d'une tâche a changé
    depuis l'affichage de votre écran. Deux personnes qui cochent la même tâche
    en même temps ne produisent plus deux mails : la première garde les points
    de la réalisation.
---

`Tache.version` compte les modifications du contenu (migration additive
`20261004233000_version_des_taches`). `modifierTache` reçoit `versionAttendue` et
`changerStatutTache` reçoit `statutAttendu` ; un écart lève `CONFLIT_VERSION`, avec
`versionCourante`, `modifieeLe` et `modifieePar`, ou `statutCourant`. Un conflit de
statut ne nomme personne. Dans `modifierTache`, un champ absent ne change pas.
Demander le statut déjà atteint n'écrit rien. `assignerTache` n'écrit qu'une fois
deux demandes simultanées.
