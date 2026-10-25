---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.15.0
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
en:
  titre: >-
    The message history opens from the menu
  texte: >-
    The “Manage the activity” menu has a “Messages” entry that lists the
    messages prepared for the activity’s team. The “Messages” tab leaves the
    “People” screen, and your old bookmarks lead to the new screen. The “Team”
    screen also leads there, through the “Message history” link. The directory
    keeps its “Messages” tab for organization admins. The “Manage the activity”
    menu lists its screens from most to least frequent: Team, People, Messages,
    Ranking, Sheet editing, then the periods.
---

Nouvelle page `pages/admin/MessagesActivite.tsx`, sur la route `admin/messages`.
Elle affiche `composants/Messages.tsx` avec les adresses de la requête
`AdressesEquipe`. `admin/personnes?onglet=messages` redirige vers cette route.
L'ADR 0027 amende l'emplacement fixé par l'ADR 0020. Le serveur ne change pas.
