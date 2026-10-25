---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.11.0
fr:
  titre: >-
    Un admin d'activité nomme les admins de son activité et invite avec une affectation
  texte: >-
    Un admin d'activité lit désormais qui administre l'organisation. Il nomme et
    retire les admins de ses activités, parmi les personnes de son équipe. Il
    ne modifie ni les affectations ni les souhaits d'un admin de l'organisation.
    Une invitation peut porter une affectation, sans périmètre souhaité.
en:
  titre: >-
    An activity admin names the admins of their activity and invites with an
    appointment
  texte: >-
    An activity admin can now read who administers the organization. They name
    and remove the admins of their activities, among the people of their team.
    They do not change the appointments or interests of an organization admin.
    An invitation can carry an appointment, without an area of interest.
---

ADR 0019. Nouvelle requête `adminsOrganisation` (scope `gestion`). `estAdmin` se
lit par tout admin d'activité. `definirAdminActivite` passe au scope `gestion`,
avec `exigerAdminDe` et `exigerMembreGere` ; un admin d'activité ne retire pas son
propre rôle. `exigerMembreGere` et `refuserAdminDeLOrganisation` refusent d'agir
sur un admin de l'organisation (`SAISIE_INVALIDE`). `inviterPersonne` reçoit
`perimetresAffectes`.

