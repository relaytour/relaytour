---
cible: serveur
type: correctif
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Un titre de tâche ou de fiche compte 191 caractères au plus
  texte: >-
    Un titre de tâche ou de fiche de 192 à 200 caractères était accepté par l'écran
    et refusé par la base, avec une erreur incompréhensible. La limite est désormais
    191 caractères, annoncée par un message clair. Le résumé d'une version de fiche
    compte 191 caractères au plus, et la description d'une tâche 5 000.
---

Colonnes `VARCHAR(191)` de `Tache.titre`, `Fiche.titre` et `VersionFiche.resume`.
`texteFacultatif` (`lib/saisie.ts`) borne les champs facultatifs.
