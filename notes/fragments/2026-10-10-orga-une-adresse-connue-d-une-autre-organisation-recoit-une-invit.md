---
cible: orga
type: securite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.17.0
fr:
  titre: >-
    Une adresse connue d'une autre organisation reçoit une invitation à accepter
  texte: >-
    Quand vous invitez une adresse qui a déjà un compte hors de votre
    organisation, la personne n'entre plus d'office dans votre équipe. Les écrans
    « Personnes » et « Équipe » affichent un encadré « Invitations en attente »,
    avec le nom et l'adresse que vous avez saisis et les périmètres proposés. Vous
    relancez une invitation une fois par heure, ou vous la retirez. La personne
    apparaît dans l'équipe après son accord. Une invitation expire après 30 jours.
en:
  titre: >-
    An address known to another organization receives an invitation to accept
  texte: >-
    When you invite an email address that already has an account outside your
    organization, the person no longer joins your team automatically. The
    “People” and “Team” screens show a “Pending invitations” box, with the name
    and email address you entered and the proposed areas. You resend an
    invitation once an hour, or you withdraw it. The person appears in the team
    after they agree. An invitation expires after 30 days.
---

ADR 0030. L'invitation en attente garde le rôle d'admin de l'organisation et les
périmètres, pas le rôle d'admin d'activité : l'écran le dit à l'envoi, et l'admin
nomme la personne après son accord. Nommer d'avance un compte extérieur admin d'une
activité donnerait un droit de gestion à une personne qui n'a encore rien accepté.
