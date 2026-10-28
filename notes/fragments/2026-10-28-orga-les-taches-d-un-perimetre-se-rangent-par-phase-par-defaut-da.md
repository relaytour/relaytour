---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Les tâches d'un périmètre se rangent par phase par défaut, dans des groupes repliables
  texte: >-
    Le regroupement « Par phase » vient en premier et s'applique par défaut quand l'activité déclare des phases.
    Chaque phase ou chaque fiche forme un groupe dans un cadre de verre.
    Vous repliez un groupe par sa flèche ou par son titre, et votre navigateur garde ce choix.
en:
  titre: >-
    Tasks in an area are grouped by phase by default, in collapsible groups
  texte: >-
    The "By phase" grouping comes first and applies by default when the activity declares phases.
    Each phase or sheet forms a group inside a glass frame.
    You collapse a group with its arrow or its title, and your browser remembers this choice.
---

Composant `Groupe` (`composants/Panneau.tsx`) : cadre `::before` en retrait de
28 px (10 px sous `md`), verre `--rt-verre-groupe`. Les groupes repliés se
gardent sous `relaytour.taches.groupes-replies` (`lib/groupes-replies.ts`).
La tâche visée par une notification déplie son groupe.
