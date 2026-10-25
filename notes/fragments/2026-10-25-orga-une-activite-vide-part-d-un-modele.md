---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Une activité vide peut partir d’un modèle d’événement multisports
  texte: >-
    Dans la liste « Premiers pas », l’étape des périmètres propose un modèle de
    départ : sept périmètres d’un rassemblement sportif fictif, leurs tâches
    types et trois fiches. Les tâches de l’édition en cours sont créées dans la
    foulée. Vous renommez, archivez ou complétez ensuite chaque élément. Le
    modèle ne s’applique qu’à une activité qui n’a encore aucun périmètre.
en:
  titre: >-
    An empty activity can start from a multisport event template
  texte: >-
    In the “First steps” list, the areas step offers a starter template: seven
    areas of a fictional sports gathering, their task templates, and three
    sheets. The tasks of the current edition are created at the same time. You
    then rename, archive, or complete each item. The template only applies to an
    activity that has no areas yet.
---

ADR 0048. Requête `simulerModeleDeDepart` et mutation `appliquerModeleDeDepart`
(`packages/server/src/orga/modele-de-depart.ts`). Le modèle est l’activité
`rencontres` de `content/exemple` (ou de `content/exemple-en` pour une requête en
anglais), que le Dockerfile copie dans l’image du serveur.
