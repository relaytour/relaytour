---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Un robot peut recevoir la lecture d'une activité
  texte: >-
    Un robot rattaché à une activité peut en recevoir la lecture. Il consulte
    alors toutes les périodes de l'activité : éditions, lieux, programme,
    agenda, fiches communes et flux des changements. Il n'écrit rien, ne lit
    aucune coordonnée et ne prend aucune place dans l'effectif. Ce réglage
    remplace l'affectation d'un robot à un périmètre pour une application
    tierce qui affiche le programme.
en:
  titre: >-
    A robot can receive read access to an activity
  texte: >-
    A robot that belongs to an activity can receive read access to it. It
    then views every period of the activity: editions, venues, schedule,
    agenda, shared sheets and change feed. It writes nothing, reads no contact
    details and takes no place in the target headcount. This setting replaces
    the assignment of a robot to an area for a third-party application that
    displays the schedule.
---

ADR 0069. Colonne `RattachementActivite.lecture` (migration additive), comptée
par `activitesVisibles` pour un robot seulement. Mutations
`donnerLectureActivite` et `retirerLectureActivite` (session d'un admin de
l'activité), argument `lectureActiviteIds` de `creerRobot`, champs
`ActiviteDuRobot.lecture`, `AttributionActivite.lecture` et
`Personne.activitesLues`. Un robot qui a la lecture ne formule aucun souhait et
lit l'organigramme réduit, sans adresse.
