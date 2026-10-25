---
cible: orga
type: correctif
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.21.0
fr:
  titre: >-
    Le formulaire public indique l'appel à bénévoles ouvert
  texte: >-
    Le formulaire « Rejoindre l'équipe d'organisation » précise qu'il sert à
    rejoindre l'équipe qui prépare l'activité. Quand un appel à bénévoles est
    ouvert sur toute la période, le formulaire affiche son lien pour les
    personnes qui viennent aider le jour J. Sans appel ouvert, il indique
    l'adresse de contact de l'activité.
en:
  titre: >-
    The public form shows the open volunteer call
  texte: >-
    The “Join the organizing team” form states that it is for joining the team
    that prepares the activity. When a volunteer call is open for the whole
    period, the form shows its link for people who come to help on event day.
    Without an open call, it shows the activity’s contact email address.
---

ADR 0046. Champ public `FormulaireRejoindre.appelBenevoles` : le jeton de l'appel
de portée « période » ouvert le plus récemment, hors appel d'import (ADR 0041,
0042). La lecture n'écrit rien en base.
