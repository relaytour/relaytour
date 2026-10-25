---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Les mails désactivables se désabonnent en un clic
  texte: >-
    Votre messagerie affiche un bouton « Se désabonner » sur les mails que vous
    pouvez désactiver : modification de vos tâches, échéances, résumé et
    demandes pour rejoindre l’équipe. Un clic coupe ce mail dans l’organisation
    qui l’a envoyé, sans connexion. Le mail de modification d’une tâche donne
    aussi le lien vers vos préférences. Vous réactivez un mail dans vos
    préférences.
---

ADR 0050. En-têtes `List-Unsubscribe` et `List-Unsubscribe-Post` (RFC 8058) sur
`tache-modifiee`, `rappels-echeance`, `resume` et `demandes`. L'adresse
`/medias/desabonnement/<jeton>` porte un jeton signé par HMAC avec le secret du
serveur ; le POST coupe la préférence, le GET affiche une confirmation. Les mails
transactionnels (code de connexion, invitation, équipe, convocations, bénévoles,
essai) restent sans en-tête de désabonnement.
