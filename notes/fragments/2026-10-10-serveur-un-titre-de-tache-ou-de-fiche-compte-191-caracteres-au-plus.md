---
cible: serveur
type: correctif
audience: organisateurs
etat: prevu
version: 0.17.0
fr:
  titre: >-
    Un titre de tâche ou de fiche compte 191 caractères au plus
  texte: >-
    Un titre de tâche ou de fiche de 192 à 200 caractères était accepté par l'écran
    et refusé par la base, avec une erreur incompréhensible. La limite est désormais
    191 caractères, annoncée par un message clair. Le résumé d'une version de fiche
    compte 191 caractères au plus, et la description d'une tâche 5 000.
en:
  titre: >-
    A task or sheet title is at most 191 characters
  texte: >-
    A task or sheet title of 192 to 200 characters was accepted by the screen
    and rejected by the database, with an unclear error. The limit is now 191
    characters, announced by a clear message. The summary of a sheet version is
    at most 191 characters, and a task’s description at most 5,000.
---

Colonnes `VARCHAR(191)` de `Tache.titre`, `Fiche.titre` et `VersionFiche.resume`.
`texteFacultatif` (`lib/saisie.ts`) borne les champs facultatifs.
