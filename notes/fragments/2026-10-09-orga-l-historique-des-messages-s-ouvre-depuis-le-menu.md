---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    L'historique des messages s'ouvre depuis le menu
  texte: >-
    Le menu « Gérer l'activité » porte une entrée « Messages », qui liste les
    messages préparés pour l'équipe de l'activité. L'onglet « Messages » quitte
    l'écran « Personnes », et vos anciens favoris mènent au nouvel écran.
    L'écran « Équipe » y mène aussi, par le lien « Historique des messages ».
    L'annuaire garde son onglet « Messages » pour les admins de l'organisation.
    Le menu « Gérer l'activité » range ses écrans du plus fréquent au plus
    rare : Équipe, Personnes, Messages, Classement, Rédaction, puis les
    périodes.
---

Nouvelle page `pages/admin/MessagesActivite.tsx`, sur la route `admin/messages`.
Elle affiche `composants/Messages.tsx` avec les adresses de la requête
`AdressesEquipe`. `admin/personnes?onglet=messages` redirige vers cette route.
L'ADR 0027 amende l'emplacement fixé par l'ADR 0020. Le serveur ne change pas.
