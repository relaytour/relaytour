---
cible: serveur
type: securite
audience: public
etat: prevu
fr:
  titre: >-
    Les organisations d'une installation partagée sont cloisonnées
  texte: >-
    Une adresse qui a déjà un compte hors d'une organisation n'y est plus rattachée
    d'office. Elle reçoit une invitation : aucune appartenance, aucune affectation
    et aucun souhait ne sont créés avant que la personne l'accepte, et
    l'organisation ne lit ni le nom ni aucune donnée de son compte. La règle vaut
    pour l'invitation par un admin, l'acceptation d'une demande, la commande
    `equipe-importer` et le premier admin d'une organisation. Une installation
    qui porte une seule organisation ne voit aucun changement.
---

ADR 0030. Table `InvitationOrganisation` (migration additive) : origine
obligatoire, auteur facultatif, périmètres par période, expiration à 30 jours
contrôlée à chaque lecture et à chaque mutation. `inviterPersonne` renvoie
`InvitationEnvoyee { enAttente, nom, personne }` à la place d'une personne.
Nouvelles opérations : `mesInvitations`, `invitationsEnAttente`,
`accepterInvitation`, `refuserInvitation`, `relancerInvitation`,
`retirerInvitation`. `inviterPremierAdmin` répond faux quand l'invitation attend
un accord. Le mail d'invitation annonce une invitation à accepter. La
notification `INVITATION_ACCEPTEE` prévient la personne qui a invité, ou les
admins de l'organisation pour un import. La purge nocturne efface les invitations
expirées. La table des refus croisés couvre les cinq opérations.
