---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.5.0
fr:
  titre: >-
    Les réponses aux mails arrivent au contact de l'activité
  texte: >-
    Quand un membre répond à une invitation ou à un mail de tâche, sa réponse
    arrive au contact de l'activité concernée. Les mails de toute
    l'organisation renvoient les réponses au contact de l'organisation. Sans
    contact déclaré, les réponses arrivent toujours à l'adresse d'expédition.
en:
  titre: >-
    Replies to emails reach the activity’s contact
  texte: >-
    When a member replies to an invitation or to a task email, the reply reaches
    the contact of the activity concerned. Emails for the whole organization
    send replies to the organization’s contact. With no contact declared,
    replies always reach the sending address.
---

- En-tête `Reply-To` posé par `expedier()` à partir de `contactRecrutement`,
  résolu par `configurationActivite` ou `configurationOrganisation`.
- Charge utile du job : `activiteId` facultatif, posé par `inviterPersonne`
  et `renvoyerInvitation`. Une invitation liée à une seule activité en prend
  aussi le logo et les couleurs.
- Les codes de connexion et le mail d'essai n'ont pas de `Reply-To`.
- Écrans : le champ devient « Contact de l'activité » ou « Contact de
  l'organisation ». La clé `contactRecrutement` ne change pas.
