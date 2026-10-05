---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Une référente ou un référent propose une personne, un admin décide
  texte: >-
    La page d'un périmètre porte un panneau « Proposer une personne ». Vous y
    saisissez le prénom et le nom d'une personne qui veut rejoindre votre
    périmètre, son adresse et un mot facultatif. Les admins retrouvent la
    demande dans l'onglet « Demandes » de l'écran « Personnes », et la cloche
    les prévient. Un admin accepte la demande et choisit les périmètres à
    affecter : le compte est alors créé et la personne reçoit son invitation.
    Il peut aussi la refuser, sans qu'aucun mail ne parte. Aucun compte
    n'existe avant sa décision. L'écran « Équipe » compte les demandes en
    attente de chaque périmètre.
---

`composants/ProposerPersonne.tsx` porte le panneau de la page d'un périmètre et
la liste « Vos propositions ». `composants/Demandes.tsx` porte la file de revue.
`pages/admin/Personnes.tsx` reçoit les onglets « Annuaire » et « Demandes », lus
dans `?onglet=`, et son sélecteur de période passe dans l'en-tête. ADR 0015.
