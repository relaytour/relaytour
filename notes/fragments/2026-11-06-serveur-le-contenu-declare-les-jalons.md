---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
version: 0.29.0
fr:
  titre: >-
    Le contenu d'une organisation déclare les jalons
  texte: >-
    Une tâche type porte la clé facultative `jalon`, une liste de modèles liés de la
    forme `perimetre/modele` (ADR 0062). La clé `declinaison.jalon` marque les
    déclinaisons d'une tâche partagée. `orga:valider` refuse un modèle lié inconnu,
    un jalon qui se lie à lui-même et une liste de plus de 100 modèles. L'import
    marque les tâches et crée les liens manquants, sans jamais en retirer. L'export
    réécrit la clé telle que le contenu la déclare.
---

`orga/taches-de-la-periode.ts` porte `creerJalonsDeLaPeriode`, qui s'exécute après
la création des tâches et des déclinaisons. Le rapport d'import gagne `jalons` et
`liens`, et le type `RapportTachesTypes` gagne `jalonsMarques` et `liensDeJalon`.
