---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    L'API lit la durée estimée d'une tâche et les tâches à commencer
  texte: >-
    Une tâche porte les champs `duree` et `debutTravail`. `creerTache` et
    `modifierTache` acceptent `duree`, et null l'efface. La requête
    `tachesACommencer` et la route REST `GET /editions/{editionId}/a-commencer`
    donnent les tâches à commencer de chaque périmètre. Les tâches types
    acceptent la clé `duree` dans le contenu d'une organisation.
en:
  titre: >-
    The API reads a task's estimated duration and the tasks to start
  texte: >-
    A task has the `duree` and `debutTravail` fields. `creerTache` and
    `modifierTache` accept `duree`, and null clears it. The `tachesACommencer`
    query and the REST route `GET /editions/{editionId}/a-commencer` give the
    tasks to start in each area. Task templates accept the `duree` key in an
    organization's content.
---

ADR 0068. Migration additive `20261119120000_periodes_de_travail`.
