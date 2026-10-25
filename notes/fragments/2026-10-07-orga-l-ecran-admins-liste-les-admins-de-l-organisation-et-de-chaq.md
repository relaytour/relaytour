---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.11.0
fr:
  titre: >-
    L'écran Admins liste les admins de l'organisation et de chaque activité
  texte: >-
    Le groupe « Gérer l'organisation » du menu porte un écran « Admins ». Il
    liste les admins de l'organisation, puis ceux de chaque activité, et permet
    de les nommer ou de les retirer. Le rôle d'admin de l'organisation ne se
    donne plus depuis la fenêtre d'un compte. L'écran est réservé aux admins de
    l'organisation, comme le nouvel écran Annuaire, qui liste tous les membres
    et se filtre par activité. L'écran Personnes d'une activité ne liste plus
    que son équipe, avec un filtre par périmètre. Un filtre y sépare les admins et les
    membres, et un admin d'activité nomme les admins de son activité depuis la
    fenêtre d'un compte. La fenêtre d'invitation propose les périmètres affectés
    en plus des périmètres souhaités.
en:
  titre: >-
    The Admins screen lists the admins of the organization and of each activity
  texte: >-
    The “Manage the organization” group in the menu has an “Admins” screen. It
    lists the organization’s admins, then those of each activity, and lets you
    appoint or remove them. The organization admin role can no longer be given
    from an account window. The screen is reserved for organization admins, like
    the new Directory screen, which lists all members and can be filtered by
    activity. An activity’s People screen now lists only its team, with a filter
    by area. A filter there separates admins from members, and an activity admin
    appoints the admins of their activity from an account window. The invitation
    window offers appointed areas as well as areas of interest.
---

ADR 0019. Page `admin/admins`. `Personnes.tsx` : l'interrupteur « Admin de
l'organisation » disparaît, `InviterPersonne` envoie `perimetresAffectes`, et un
admin d'activité lit les admins de l'organisation sans ouvrir leur compte.
`Redaction.tsx` lit `adminsOrganisation`.

