---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Les priorités et les tâches restent lisibles dans un panneau étroit
  texte: >-
    Dans une fenêtre réduite, le titre d'une priorité ne s'affiche plus lettre
    par lettre quand les noms des personnes assignées sont longs. Les lignes de
    tâches de « Mon espace », « Rétroplanning » et « Charge » passent sur deux
    lignes dès que leur panneau devient étroit. Sur une carte de tâche étroite,
    les boutons passent sous le texte.
en:
  titre: >-
    Priorities and tasks stay readable in a narrow panel
  texte: >-
    In a small window, a priority title no longer shows one letter per line
    when the names of the assigned people are long. Task rows in "My space",
    "Timeline" and "Workload" wrap onto two lines as soon as their panel
    gets narrow. On a narrow task card, the buttons move below the
    text.
---

`LigneTache` pose un conteneur (`container: ligne-tache`) sur son `li` : la
mise en page empilée suit la largeur de la ligne (640 px) au lieu de la largeur
de l'écran (767 px). La dernière colonne passe de `auto` à `fit-content(40%)`.
`TacheCarte` reçoit une requête `@container carte-tache (max-width: 560px)` qui
place les actions sous le corps.
