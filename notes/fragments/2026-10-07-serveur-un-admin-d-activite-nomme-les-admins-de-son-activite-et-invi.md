---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Un admin d'activité nomme les admins de son activité et invite avec une affectation
  texte: >-
    Un admin d'activité lit désormais qui administre l'organisation. Il nomme et
    retire les admins de ses activités, parmi les personnes de son équipe. Il
    ne modifie ni les affectations ni les souhaits d'un admin de l'organisation.
    Une invitation peut porter une affectation, sans périmètre souhaité.
---

ADR 0019. Nouvelle requête `adminsOrganisation` (scope `gestion`). `estAdmin` se
lit par tout admin d'activité. `definirAdminActivite` passe au scope `gestion`,
avec `exigerAdminDe` et `exigerMembreGere` ; un admin d'activité ne retire pas son
propre rôle. `exigerMembreGere` et `refuserAdminDeLOrganisation` refusent d'agir
sur un admin de l'organisation (`SAISIE_INVALIDE`). `inviterPersonne` reçoit
`perimetresAffectes`.

