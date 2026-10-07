---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Un mail regroupé prévient les admins des demandes reçues
  texte: >-
    Quand une activité reçoit des demandes pour rejoindre son équipe, ses
    admins reçoivent un mail, une fois par heure au plus. Le mail donne le
    nombre de demandes en attente et un lien vers l'onglet « Demandes ». Il ne
    cite aucune personne. Chaque admin le désactive dans ses préférences.
---

`signalerDemande` (`lib/demandes.ts`) met en file un mail de sorte `demandes` par
admin, par activité et par fenêtre d'une heure, déduite de l'heure du
signalement. `composer` relit le rôle, la préférence `mailDemandes` et le nombre
de demandes en attente à l'envoi. La
migration `20261004222500_preference_mail_demandes` est additive. ADR 0016.
