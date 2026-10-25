---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Une recherche globale trouve les tâches, les fiches et les personnes
  texte: >-
    La barre haute de l'espace organisateur propose une recherche. Elle trouve
    les tâches de l'édition en cours, les fiches et les personnes de vos
    périmètres. Vous ne trouvez que ce que vous pouvez déjà consulter. La page
    d'une fiche liste aussi les tâches qui la citent.
en:
  titre: >-
    A global search finds tasks, sheets, and people
  texte: >-
    The top bar of the organizer workspace offers a search. It finds the tasks
    of the current edition and the sheets and people of your areas. You find
    only what you can already view. A sheet’s page also lists the tasks that
    cite it.
---

- Requête `recherche(texte, editionId)` : huit résultats au plus par liste, deux caractères au moins. Chaque liste suit `perimetresLisibles`.
- `Fiche.taches(editionId)` : tâches liées dans les périmètres lisibles. `Fiche.nombreVersions` : un entier pour les admins, `null` pour les autres, comme l'historique.
- Tests d'intégration : `packages/server/src/schema/recherche.integration.test.ts`.
