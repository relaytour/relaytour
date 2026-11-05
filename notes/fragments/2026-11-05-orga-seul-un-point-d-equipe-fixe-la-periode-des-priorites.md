---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.28.0
fr:
  titre: >-
    Seul un point d'équipe fixe la période des priorités
  texte: >-
    Le panneau « Priorités » couvre les jours jusqu'au prochain point d'équipe. Un
    rendez-vous de l'agenda global à quelques personnes ne raccourcit plus cette
    période. Les admins de l'activité marquent une réunion comme point d'équipe
    dans son formulaire. La case est cochée d'office quand la réunion convoque
    toute l'équipe. Sans point d'équipe prévu, les priorités couvrent les 14
    prochains jours.
en:
  titre: >-
    Only a team check-in sets the priorities period
  texte: >-
    The "Priorities" panel covers the days until the next team check-in. A meeting
    of the shared calendar with only a few people no longer shortens this period.
    Activity admins mark a meeting as a team check-in in its form. The box is
    checked by default when the meeting notifies the whole team. Without a planned
    team check-in, priorities cover the next 14 days.
---

`ReunionFormulaire` reçoit la case « Point d'équipe » pour l'agenda global, qui
suit la cible tant que la personne ne l'a pas touchée. `ReunionDetail` affiche le
repère, et `SondageDetail` coche la case pour un sondage de toute l'équipe.
