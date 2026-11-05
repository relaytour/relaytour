---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.28.0
fr:
  titre: >-
    Écrire ou convoquer les contacts principaux en un clic
  texte: >-
    L'écran « Équipe » reçoit le bouton « Écrire aux contacts principaux ». Il
    prépare un message aux contacts principaux de tous les périmètres pour la
    période. Dans une réunion ou un sondage qui convoque des personnes choisies,
    le lien « Ajouter les contacts principaux » ajoute ces personnes à la
    sélection.
en:
  titre: >-
    Write to or notify the main contacts in one click
  texte: >-
    The "Team" screen gets the "Write to the main contacts" button. It prepares a
    message to the main contacts of every area for the period. In a meeting or a
    poll that notifies chosen people, the "Add the main contacts" link adds these
    people to the selection.
---

La requête `personnesConvocables` rend le champ `contactPrincipal`. Le composant
`AjouterContactsPrincipaux` complète le champ `personneIds` des formulaires.
