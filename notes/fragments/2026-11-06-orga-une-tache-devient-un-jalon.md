---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.29.0
fr:
  titre: >-
    Une tâche devient un jalon qui suit les tâches qui y mènent
  texte: >-
    Le menu « Autres actions » d'une tâche propose « Transformer en jalon ». Un
    jalon lie ensuite des tâches de son périmètre ou d'un autre périmètre de
    l'activité. La carte du jalon indique combien de tâches liées restent
    ouvertes, et une tâche liée indique le jalon qu'elle sert. Une tâche partagée
    peut marquer ses déclinaisons comme jalons, pour suivre chaque périmètre sans
    y être affectée. Le rétroplanning filtre les jalons.
en:
  titre: >-
    A task becomes a milestone that follows the tasks leading to it
  texte: >-
    The "More actions" menu of a task offers "Turn into a milestone". A milestone
    then links tasks of its area or of another area of the activity. The
    milestone card shows how many linked tasks are still open, and a linked task
    shows the milestone it serves. A shared task can mark its derived tasks as
    milestones, to follow each area without being appointed to it. The timeline
    filters milestones.
---

`JalonTache.tsx` porte le décompte et les tâches liées, `LierTaches.tsx` la
fenêtre de lien. La page d'un périmètre lit les jalons par une requête à part
(`JalonsDuPerimetre`), qui la garde sous le plafond de champs du serveur.
