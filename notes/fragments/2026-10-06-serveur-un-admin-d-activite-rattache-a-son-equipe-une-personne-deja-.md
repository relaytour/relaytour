---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Un admin d'activité rattache à son équipe une personne déjà membre
  texte: >-
    Un admin d'activité invite une personne par son adresse, avec au moins un
    périmètre souhaité. Si la personne a déjà un compte, ce compte rejoint
    l'équipe et garde son nom : aucune erreur ne s'affiche. Une personne sans
    compte reçoit son invitation par mail. Une demande s'accepte désormais avec
    au moins un périmètre, pour que la personne rejoigne l'équipe de l'activité.
---

ADR 0018. Nouvelle requête `equipe(activiteId)` : les membres qui ont une
affectation, un souhait ou un rôle d'admin dans l'activité, lus par ses admins.
`inviterPersonne` refuse un admin d'activité sans périmètre avant toute lecture de
compte, note les souhaits d'un compte déjà membre (`skipDuplicates`) et ne lui
envoie aucun mail. `accepterDemande` vérifie le lien avec l'activité en fin de
transaction. Les écrans « Équipe », « Personnes » et « Rédaction » lisent `equipe`
pour un admin d'activité.
