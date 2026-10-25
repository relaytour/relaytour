---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.15.0
fr:
  titre: >-
    L'écran Équipe réunit l'équipe et l'avancement
  texte: >-
    L'écran « Équipe » a deux vues : « Équipe » et « Avancement ». L'entrée
    « Avancement » quitte le menu, et vos anciens favoris mènent à cette vue.
    Les deux vues partagent la période, un filtre par groupe de périmètres,
    une recherche par nom de périmètre ou de personne, et un tri. Vous gardez
    ces réglages en changeant de vue. Le nom d'une carte ouvre la page du
    périmètre, et le bouton « Gérer l'équipe » de cette page vous ramène à sa
    carte.
en:
  titre: >-
    The Team screen combines the team and progress
  texte: >-
    The “Team” screen has two views: “Team” and “Progress”. The “Progress” entry
    leaves the menu, and your old bookmarks lead to this view. Both views share
    the period, a filter by area group, a search by area or person name, and a
    sort order. You keep these settings when you switch views. The name on a
    card opens the area’s page, and the “Manage the team” button on that page
    brings you back to its card.
---

`pages/admin/AvancementGlobal.tsx` est supprimée : `pages/admin/Equipe.tsx` lit
`PostesAPourvoir` et `AvancementGlobal`, et les joint par périmètre. Les réglages
(`vue`, `edition`, `groupe`, `q`, `tri`, `filtre`) se lisent dans l'adresse par
`lib/liste-perimetres.ts`. La route `admin/avancement` redirige vers
`admin/equipe?vue=avancement`, et `admin` vers `admin/equipe`. Le serveur ne
change pas.
