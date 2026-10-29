---
cible: serveur
type: correctif
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    Les mails n'invitent plus à répondre quand personne ne reçoit la réponse
  texte: >-
    Sans adresse de contact, certaines installations envoient depuis une
    adresse qui ne reçoit pas de courrier. Le pied des mails renvoie alors vers
    l'espace organisateur au lieu d'inviter à répondre. L'écran « Organisation »
    signale l'absence de contact : déclarez une adresse de rôle pour recevoir
    les réponses des membres.
en:
  titre: >-
    Emails no longer ask for a reply when no one receives it
  texte: >-
    Without a contact address, some installations send from an address that
    does not receive mail. The email footer then points to the organizer
    workspace instead of asking for a reply. The Organization screen shows
    when no contact is set: set a role address to receive members' replies.
---

ADR 0053. `COURRIEL_EXPEDITEUR_SANS_REPONSE=true` déclare que la boîte de
l'expéditeur ne reçoit pas de courrier. Le pied propose de répondre si le mail
porte un `Reply-To` ou si l'expéditeur reçoit du courrier. L'organisateur d'une
convocation iCalendar reste le contact, sinon l'expéditeur, comme l'exige la
RFC 5546. Le formulaire d'une réunion avertit quand aucune boîte ne reçoit les
réponses (`Activite.reponsesRecues`). Le champ `IdentiteOrganisation.expediteurRecoitReponses`
expose le réglage à l'écran « Organisation ». Sans la variable, le comportement
ne change pas.
