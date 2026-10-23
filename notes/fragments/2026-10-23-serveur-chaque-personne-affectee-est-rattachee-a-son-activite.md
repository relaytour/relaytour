---
cible: serveur
type: interne
audience: interne
etat: prevu
fr:
  titre: >-
    Chaque personne affectée est rattachée à son activité
  texte: >-
    La migration rattache chaque personne à chaque activité où elle a une
    affectation, toutes périodes confondues, puis à l'activité de chaque demande
    acceptée. Une personne invitée sans périmètre avant cette version se rattache
    depuis l'annuaire.
---

Migration `20261023140922_rattachements_aux_activites` : création de la table,
colonne `InvitationOrganisation.rattachements`, reprise par `INSERT IGNORE` avec un
identifiant déduit de la personne et de l'activité.
