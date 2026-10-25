---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.10.0
fr:
  titre: >-
    Un admin d'activité rattache à son équipe une personne déjà membre
  texte: >-
    Un admin d'activité invite une personne par son adresse, avec au moins un
    périmètre souhaité. Si la personne a déjà un compte, ce compte rejoint
    l'équipe et garde son nom : aucune erreur ne s'affiche. Une personne sans
    compte reçoit son invitation par mail. Une demande s'accepte désormais avec
    au moins un périmètre, pour que la personne rejoigne l'équipe de l'activité.
en:
  titre: >-
    An activity admin affiliates a person who is already a member to their team
  texte: >-
    An activity admin invites a person by email address, with at least one area
    of interest. If the person already has an account, that account joins the
    team and keeps its name: no error appears. A person without an account
    receives their invitation by email. A join request is now accepted with at
    least one area, so that the person joins the activity’s team.
---

ADR 0018. Nouvelle requête `equipe(activiteId)` : les membres qui ont une
affectation, un souhait ou un rôle d'admin dans l'activité, lus par ses admins.
`inviterPersonne` refuse un admin d'activité sans périmètre avant toute lecture de
compte, note les souhaits d'un compte déjà membre (`skipDuplicates`) et ne lui
envoie aucun mail. `accepterDemande` vérifie le lien avec l'activité en fin de
transaction. Les écrans « Équipe », « Personnes » et « Rédaction » lisent `equipe`
pour un admin d'activité.
