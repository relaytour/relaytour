---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.10.0
fr:
  titre: >-
    L'annuaire indique les activités de chaque personne
  texte: >-
    Pour un admin de l'organisation, l'écran « Personnes » gagne une colonne
    « Activités » : elle indique où chaque personne est affectée, intéressée ou
    admin, toutes périodes confondues. Un filtre isole les personnes d'une
    activité, ou celles qui ne participent à aucune. Dans l'écran « Équipe »,
    la liste d'affectation range les personnes en trois groupes : intéressées,
    équipe de l'activité, autres membres de l'organisation avec le nom de leurs
    activités. Un admin d'activité voit l'onglet « Votre équipe », avec le rôle
    de chaque personne dans son activité.
en:
  titre: >-
    The directory shows each person’s activities
  texte: >-
    For an organization admin, the “People” screen has a new “Activities”
    column. It shows where each person is appointed, interested, or admin,
    across all periods. A filter isolates the people of one activity, or those
    who take part in none. In the “Team” screen, the assignment list sorts
    people into three groups: interested, activity team, and other organization
    members with the names of their activities. An activity admin sees the “Your
    team” tab, with each person’s role in their activity.
---

ADR 0018. Champ `Personne.attributions` (scope `admin`), chargé par un mémo de la
requête : trois lectures pour toute l'organisation. La colonne « Rôle » de l'annuaire
se réduit à « Admin de l'organisation » ou « Membre » ; le rôle d'admin d'activité
se lit dans la colonne « Activités ».
