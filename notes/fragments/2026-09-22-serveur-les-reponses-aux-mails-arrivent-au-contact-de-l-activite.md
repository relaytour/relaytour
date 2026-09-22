---
cible: serveur
type: fonctionnalite
audience: organisateurs
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
---

- En-tête `Reply-To` posé par `expedier()` à partir de `contactRecrutement`,
  résolu par `configurationActivite` ou `configurationOrganisation`.
- Charge utile du job : `activiteId` facultatif, posé par `inviterPersonne`
  et `renvoyerInvitation`. Une invitation liée à une seule activité en prend
  aussi le logo et les couleurs.
- Les codes de connexion et le mail d'essai n'ont pas de `Reply-To`.
- Écrans : le champ devient « Contact de l'activité » ou « Contact de
  l'organisation ». La clé `contactRecrutement` ne change pas.
