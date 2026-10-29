---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Les premiers pas proposent de déclarer une adresse de contact
  texte: >-
    La liste « Premiers pas » compte une étape « Déclarer une adresse de
    contact », avant l'invitation de l'équipe. Cette adresse de rôle reçoit les
    réponses des membres aux mails de l'activité. Les écrans « Organisation » et
    « Activités » proposent aussi de reprendre votre adresse, quand elle est
    déjà une adresse de rôle de l'organisation.
en:
  titre: >-
    First steps suggest setting a contact address
  texte: >-
    The First steps list has a new step, "Set a contact address", before
    inviting the team. This role address receives members' replies to the
    activity's emails. The Organization and Activities screens also offer to
    use your address, when it is already a role address of the organization.
---

ADR 0053. L'étape `CONTACT` se coche dès que l'activité a un contact, le sien
ou celui de son organisation. Une activité qui avait terminé ses premiers pas
sans contact voit la liste revenir avec cette seule étape. Le champ
`Personne.adresseDeRole`, lu par la personne seule, conditionne le bouton
« Reprendre mon adresse ».
