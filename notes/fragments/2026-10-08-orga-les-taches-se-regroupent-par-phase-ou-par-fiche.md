---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.14.0
fr:
  titre: >-
    Les tâches se regroupent par phase ou par fiche
  texte: >-
    La page d'un périmètre propose trois lectures de ses tâches : par échéance,
    par phase ou par fiche méthode. Le rétroplanning en propose deux : par mois,
    ou par phase puis par périmètre. Une phase est une partie de la période,
    par exemple « Préparation ». Chaque tâche s'y range par son échéance. Votre
    navigateur garde le regroupement choisi.
en:
  titre: >-
    Tasks can be grouped by phase or by sheet
  texte: >-
    An area’s page offers three ways to read its tasks: by due date, by phase,
    or by how-to sheet. The timeline offers two: by month, or by phase and then
    by area. A phase is a part of the period, for example “Preparation”. Each
    task is placed in a phase by its due date. Your browser remembers the
    grouping you chose.
---

ADR 0025. `packages/orga/src/lib/regroupement.ts` range une tâche dans une phase
à partir de son échéance et du premier jour de la période, lus comme des jours
calendaires. La requête `Activites` lit les phases de l'activité. En
consultation, le serveur ne rend pas les fiches : le regroupement par fiche
n'est proposé qu'avec un accès complet.
