---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.24.0
fr:
  titre: >-
    Un lieu archivé peut être supprimé
  texte: >-
    La fenêtre « Lieux de l'activité » propose un bouton de suppression sur chaque
    lieu archivé. Le bouton reste inactif tant qu'une séquence utilise le lieu,
    quelle que soit sa période. La suppression demande une confirmation et reste
    définitive.
en:
  titre: >-
    An archived venue can be deleted
  texte: >-
    The "Activity venues" window shows a delete button on each archived
    venue. The button stays disabled while a slot uses the venue, whatever its
    period. The deletion asks for a confirmation and is permanent.
---

`supprimerLieu` refuse un lieu non archivé et un lieu qu'une séquence utilise. Un lieu
archivé ne se choisit plus dans une séquence (`lieuValide`) : le comptage reste juste
jusqu'à la suppression. `Lieu.sequences` compte les séquences de toutes les périodes.
