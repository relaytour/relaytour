---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Une tâche s'ouvre en grand et se partage par un lien
  texte: >-
    Le titre d'une tâche ouvre une fenêtre avec sa description complète, ses
    actions et ses commentaires à droite. L'adresse de la page désigne alors la
    tâche. Le menu « Autres actions » et la fenêtre proposent « Copier le lien »
    et « Copier le titre et le lien ». Le lien mène à la page du périmètre, tâche
    ouverte, et chaque personne y voit la tâche selon ses droits. Les fiches, les
    réunions et les séquences ont aussi un bouton « Partager ». Un soulignement
    pointillé signale les titres qui ouvrent une tâche ou un périmètre. L'écran
    « Notifications d'admin » s'appelle désormais « Notifications admin ».
en:
  titre: >-
    A task opens full size and can be shared by link
  texte: >-
    The title of a task opens a window with its full description, its actions
    and its comments on the right. The page address then points to the task.
    The “More actions” menu and the window offer “Copy link” and “Copy title and
    link”. The link leads to the area page with the task open, and each person
    sees the task according to their access. Sheets, meetings and slots also have
    a “Share” button. A dotted underline marks the titles that open a task or an
    area. The admin notifications screen keeps its English name, “Admin
    notifications”.
---

Lien court : `/<activité>/taches/<id>` (`pages/LienTache.tsx`), qui lit
`tache(id)` puis redirige vers `/perimetres/<slug>?edition=…&tache=…&detail=…`.
La fenêtre (`composants/ModaleTache.tsx`) est montée dans la coquille et s'ouvre
sur tout écran par le paramètre `detail`. Le fil (`FilTache`) s'affiche dans la
fenêtre avec `integre`. « Copier le titre et le lien » écrit un texte simple
(titre, puis adresse) et un HTML (`<a href>titre</a>`).
