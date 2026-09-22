---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Les écrans de l'espace organisateur changent d'allure
  texte: >-
    Mon espace, le rétroplanning, les fiches, les périmètres et les préférences
    suivent le nouveau design system. Une colonne de droite résume l'avancement,
    vos périmètres et votre contribution. Les fiches s'affichent en cartes ou en
    liste condensée, selon votre choix. Chaque périmètre indique ses personnes
    affectées et leur nombre de tâches ouvertes.
---

- Composants partagés dans `packages/orga/src/composants` : `Panneau`, `DeuxColonnes`, `Section`, `Puces`, `PuceBascule`, `PastilleEtat`, `PastilleStatut`, `EtiquettePerimetre`, `Avatar`, `PersonneNommee`, `ChoixEdition`, `LigneTache`.
- Le choix entre cartes et liste condensée reste dans le navigateur (`localStorage`).
- Le menu « Autres actions » d'une tâche ne propose « Modifier » que sur la page du périmètre, où la modification fonctionne.
